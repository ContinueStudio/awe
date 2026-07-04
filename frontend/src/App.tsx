/**
 * App 路由：Home（卡片网格） / Editor（点开某个工作流后）
 *
 * 视觉风格参考 lawe：
 * - 顶栏：白底 44px、L logo + AWE + 版本号 + 返回/撤销/重做/保存/运行
 * - 主体：纯画布（无左侧固定面板）
 * - 底部：悬浮工具栏（+ 节点 / 缩放 / 试运行 / 节点数）
 * - 节点面板：点击底部 + 按钮弹出（悬浮在工具栏上方）
 * - 右侧：节点配置 Drawer
 *
 * 保留不变：Home 页、RunHistoryDrawer、后端 API
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Undo2, Redo2, Save, Play, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { HomePage } from './pages/HomePage';
import { Canvas } from './components/Canvas';
import { NodePanel } from './components/NodePanel';
import { BottomToolbar } from './components/BottomToolbar';
import { ConfigPanel } from './components/ConfigPanel';
import type { NodeDefinition, Workflow, WorkflowGraph } from '@/lib/types';

const EMPTY_GRAPH: WorkflowGraph = { nodes: [], edges: [] };

/**
 * 给没有 meta.x/meta.y 的节点自动铺开：按节点索引 3 列网格排（lawe 风格）
 * - 已有坐标的节点不动
 * - 没坐标的节点按 "出现的顺序" 排成 3 列网格
 */
function autoLayoutNodes(g: WorkflowGraph): WorkflowGraph {
  const COLS = 3;
  const X0 = 200;
  const Y0 = 120;
  const DX = 380;
  const DY = 200;
  let freeIdx = 0;
  return {
    ...g,
    nodes: g.nodes.map((n) => {
      const hasPos = n.meta && typeof n.meta.x === 'number' && typeof n.meta.y === 'number';
      if (hasPos) return n;
      const col = freeIdx % COLS;
      const row = Math.floor(freeIdx / COLS);
      freeIdx += 1;
      return {
        ...n,
        meta: { ...(n.meta || {}), x: X0 + col * DX, y: Y0 + row * DY, title: n.meta?.title },
      };
    }),
  };
}

type View = { kind: 'home' } | { kind: 'editor'; wf: Workflow };

export default function App() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);
  const [graph, setGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [currentName, setCurrentName] = useState('未命名工作流');
  const [health, setHealth] = useState<{ ok: boolean; version: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 选中节点
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  // UI 状态
  const [showNodePanel, setShowNodePanel] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [toast, setToast] = useState<string | null>(null);

  // ---- 启动 ----
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false, version: 'unknown' }));
    api.listNodes().then((d) => setNodes(d.nodes)).catch(console.error);
  }, []);

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- 路由 ----
  const openWorkflow = async (wf: Workflow) => {
    let graphData = wf.graph;
    if (!graphData || (graphData.nodes?.length === 0 && !graphData.edges?.length)) {
      try {
        const fresh = await api.getWorkflow(wf.id);
        graphData = fresh.graph;
      } catch (e) { graphData = EMPTY_GRAPH; }
    }
    setView({ kind: 'editor', wf: { ...wf, graph: graphData } });
    setGraph(autoLayoutNodes(graphData));
    setCurrentName(wf.name);
    setSelectedNodeId(null);
    setConfigOpen(false);
    setShowNodePanel(false);
  };

  const backToHome = () => {
    setView({ kind: 'home' });
    setSelectedNodeId(null);
    setConfigOpen(false);
    setShowNodePanel(false);
  };

  // ---- 编辑 ----
  const addNode = (type: string) => {
    const def = nodes.find((n) => n.type === type);
    if (!def) return;
    const id = `n_${Date.now().toString(36)}`;
    const step = graph.nodes.length;
    setGraph({
      nodes: [
        ...graph.nodes,
        {
          id,
          type,
          config: {},
          meta: { title: def.name, x: 200 + (step % 3) * 380, y: 120 + Math.floor(step / 3) * 200 },
        },
      ],
      edges: [...graph.edges],
    });
    if (currentName === '未命名工作流') setCurrentName(def.name + ' 工作流');
    setShowNodePanel(false);
    setToast(`已添加 ${def.name}`);
  };

  const updateNodeConfig = (cfg: any) => {
    if (!selectedNodeId) return;
    setGraph({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === selectedNodeId ? { ...n, config: cfg } : n)),
    });
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setGraph({
      nodes: graph.nodes.filter((n) => n.id !== selectedNodeId),
      edges: graph.edges.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
    });
    setSelectedNodeId(null);
    setConfigOpen(false);
  };

  // ---- 保存 / 运行 ----
  const handleSave = useCallback(async () => {
    if (view.kind !== 'editor') return;
    setIsSaving(true);
    try {
      await api.saveWorkflow({
        id: view.wf.id,
        name: currentName || '未命名工作流',
        description: '',
        nodes: graph.nodes,
        edges: graph.edges,
      });
      setToast('已保存');
    } catch (e) {
      console.error(e);
      alert('保存失败：' + (e as Error).message);
    } finally {
      setIsSaving(false);
    }
  }, [view, currentName, graph]);

  // Ctrl+S 保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (view.kind === 'editor') handleSave();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave, view]);

  const handleRun = useCallback(async () => {
    if (view.kind !== 'editor') return;
    if (!view.wf.id) {
      await handleSave();
    }
    const targetWfId = view.wf.id;
    setIsRunning(true);
    try {
      await api.runWorkflow(targetWfId, {});
      setToast('已触发运行，查看 Home 页日志');
    } catch (e) {
      console.error('run failed', e);
      alert('运行失败：' + (e as Error).message);
    } finally {
      setIsRunning(false);
    }
  }, [view, handleSave]);

  // 撤销 / 重做（占位 - 后续接入 Command 模式）
  const onUndo = () => setToast('撤销（待接入）');
  const onRedo = () => setToast('重做（待接入）');

  // ---- 当前 wf 用于配置 ----
  const currentWf: Workflow | null = view.kind === 'editor'
    ? { ...view.wf, name: currentName, graph }
    : null;
  const selectedNode = currentWf && selectedNodeId
    ? currentWf.graph.nodes.find((n) => n.id === selectedNodeId) || null
    : null;
  const selectedDef = selectedNode ? nodes.find((n) => n.type === selectedNode.type) || null : null;

  // ---- 渲染 ----
  if (view.kind === 'home') {
    return <HomePage onOpen={openWorkflow} />;
  }

  // ---- Editor ----
  return (
    <div className="h-full w-full flex flex-col" style={{ background: '#F2F3F5' }}>
      {/* 顶栏（lawe 风格：白底 44px） */}
      <header className="editor-header">
        {/* 左：返回 + Logo + 名称 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={backToHome}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 6,
              background: 'transparent', border: 'none',
              color: '#4E5969', fontSize: 12, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
            title="返回工作流列表"
          >
            <ArrowLeft size={14} />
            <span>返回</span>
          </button>
          <div style={{ width: 1, height: 20, background: '#E5E6EB' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* logo 字符 'A'（lawe 风格：纯色方块 + 字符） */}
            <div
              style={{
                width: 26, height: 26, borderRadius: 6,
                background: '#4D53E8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>A</span>
            </div>
            <input
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 14, fontWeight: 600, color: '#1D2129',
                width: 240,
                padding: '4px 6px',
                borderRadius: 4,
                transition: 'background 0.15s',
              }}
              onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.background = '#F7F8FA')}
              onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.background = 'transparent')}
              placeholder="工作流名称"
            />
          </div>
          <span style={{ fontSize: 11, color: '#C9CDD4', fontWeight: 500 }}>v0.2.9</span>
        </div>

        {/* 右：撤销 / 重做 / 保存 / 运行 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onUndo}
            title="撤销 Ctrl+Z"
            style={{
              width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #E5E6EB', background: '#fff', cursor: 'pointer', color: '#4E5969',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#4D53E8';
              (e.currentTarget as HTMLButtonElement).style.color = '#4D53E8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E6EB';
              (e.currentTarget as HTMLButtonElement).style.color = '#4E5969';
            }}
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={onRedo}
            title="重做 Ctrl+Y"
            style={{
              width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #E5E6EB', background: '#fff', cursor: 'pointer', color: '#4E5969',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#4D53E8';
              (e.currentTarget as HTMLButtonElement).style.color = '#4D53E8';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E6EB';
              (e.currentTarget as HTMLButtonElement).style.color = '#4E5969';
            }}
          >
            <Redo2 size={13} />
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 12px', height: 28, borderRadius: 6,
              background: '#fff', border: '1px solid #E5E6EB', color: '#4E5969',
              fontSize: 12, fontWeight: 500, cursor: isSaving ? 'wait' : 'pointer',
              opacity: isSaving ? 0.5 : 1,
            }}
            title="保存 (Ctrl+S)"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            保存
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '0 12px', height: 28, borderRadius: 6,
              background: '#4D53E8', border: 'none', color: '#fff',
              fontSize: 12, fontWeight: 600, cursor: isRunning ? 'wait' : 'pointer',
              opacity: isRunning ? 0.5 : 1,
            }}
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
            {isRunning ? '运行中…' : '运行'}
          </button>
        </div>
      </header>

      {/* 主体：纯画布（无左侧固定面板） */}
      <div className="flex-1 flex min-h-0 relative">
        <Canvas
          workflowId={view.wf.id}
          workflowName={currentName}
          graph={graph}
          nodes={nodes}
          onChange={setGraph}
          onWorkflowId={() => {}}
          onWorkflowName={setCurrentName}
          onSelectNode={(id) => { setSelectedNodeId(id); setConfigOpen(!!id); }}
          onSave={() => {}}
        />

        {/* 底部悬浮工具栏（lawe 风格） */}
        <BottomToolbar
          onTestRun={handleRun}
          isRunning={isRunning}
          showNodePanel={showNodePanel}
          onToggleNodePanel={() => setShowNodePanel((v) => !v)}
          zoom={zoom}
          nodeCount={graph.nodes.length}
        />

        {/* 节点面板（悬浮在工具栏上方） */}
        {showNodePanel && (
          <>
            <div
              onClick={() => setShowNodePanel(false)}
              style={{ position: 'absolute', inset: 0, zIndex: 24 }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 72,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 30,
                pointerEvents: 'auto',
              }}
            >
              <NodePanel onAdd={addNode} />
            </div>
          </>
        )}

        {/* 使用提示卡片（无选中节点时） */}
        {!configOpen && !selectedNodeId && graph.nodes.length > 0 && (
          <div
            style={{
              position: 'absolute', right: 20, top: 16, zIndex: 15,
              width: 280, background: '#fff', border: '1px solid #E5E6EB',
              borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-float)',
              color: '#6b7280', fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600, color: '#111827', marginBottom: 8 }}>使用提示</div>
            <ul style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
              <li>点击底部「＋」添加节点</li>
              <li>从节点端口拖线连接</li>
              <li>点击节点右侧面板编辑配置</li>
              <li>拖动画布空白处平移视角</li>
            </ul>
          </div>
        )}

        {/* 节点配置面板（lawe 风格：右侧悬浮，无遮罩） */}
        {selectedNode && selectedDef && configOpen && (
          <NodeConfigDrawer
            open={configOpen}
            node={selectedNode}
            def={selectedDef}
            onClose={() => { setConfigOpen(false); setSelectedNodeId(null); }}
            onDelete={deleteSelectedNode}
            onChange={updateNodeConfig}
            isRunning={isRunning}
            onRun={handleRun}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed', left: '50%', bottom: 100, transform: 'translateX(-50%)',
            background: 'rgba(17,24,39,0.92)', color: '#fff', padding: '8px 20px',
            borderRadius: 8, fontSize: 13, zIndex: 99, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- 节点配置 Drawer（lawe 风格：右侧悬浮，绝对定位，无遮罩） ---------- */

function NodeConfigDrawer({
  open, node, def, onClose, onDelete, onChange, isRunning, onRun,
}: {
  open: boolean;
  node: { id: string; config?: any; type: string };
  def: NodeDefinition;
  onClose: () => void;
  onDelete: () => void;
  onChange: (cfg: any) => void;
  isRunning: boolean;
  onRun: () => void;
}) {
  const fakeNode = { id: node.id, type: node.type, config: node.config || {} } as any;
  // 颜色：与 NodeRender 中 COLOR_BAR 一致
  const COLOR_BAR: Record<string, string> = {
    emerald: '#00B42A',
    violet: '#7C3AED',
    amber: '#FF7D00',
    sky: '#0EA5E9',
    rose: '#F53F3F',
    slate: '#4D53E8',
  };
  const color = COLOR_BAR[def.color] || COLOR_BAR.slate;

  if (!open) return null;

  return (
    <aside
      className="absolute right-4 top-4 z-30 flex flex-col"
      style={{
        width: 380,
        maxHeight: 'calc(100% - 80px)',
        background: '#ffffff',
        border: '1px solid #E5E6EB',
        borderRadius: 12,
        boxShadow: 'var(--shadow-float)',
        fontSize: 13,
        overflow: 'hidden',
      }}
    >
      {/* 标题栏（lawe 风格：图标 + 名称 + 类型副标题 + 运行/关闭） */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid #F3F4F6', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {/* 首字母字符图标（与 lawe 一致） */}
          <div
            style={{
              width: 26, height: 26, borderRadius: 6, background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
              {def.name.charAt(0)}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: '#111827',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {def.name}
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{def.category} · {def.type}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onRun}
            disabled={isRunning}
            title="试运行"
            style={{
              width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #E5E6EB', background: '#fff',
              cursor: isRunning ? 'wait' : 'pointer', opacity: isRunning ? 0.5 : 1,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#4D53E8">
              <polygon points="8 5 19 12 8 19 8 5" />
            </svg>
          </button>
          <button
            onClick={onClose}
            title="关闭"
            style={{
              width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid #E5E6EB', background: '#fff', cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 配置表单 */}
      <div className="thin-scroll flex-1 overflow-y-auto" style={{ padding: '12px 14px' }}>
        <ConfigPanel node={fakeNode} def={def} onChange={onChange} />

        {/* 分隔线 */}
        <div style={{ height: 1, background: '#ECEEF0', margin: '12px 0' }} />

        {/* 输出变量 */}
        <div style={{ fontSize: 12, fontWeight: 600, color: '#0D1D32', marginBottom: 6 }}>输出变量</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {def.outputs && def.outputs.length > 0 ? (
            def.outputs.map((o, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 2,
                  background: '#EEF0FF', padding: '2px 8px', borderRadius: 4,
                  fontSize: 11,
                }}
              >
                <span style={{ color: '#86909C' }}>{o.type}</span>
                <span style={{ color: '#1D2129', fontWeight: 500 }}>{o.name}</span>
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12, color: '#9CA3AF' }}>无输出</span>
          )}
        </div>

        {/* 分隔线 */}
        <div style={{ height: 1, background: '#ECEEF0', margin: '12px 0' }} />

        {/* 删除 */}
        <button
          onClick={onDelete}
          style={{
            width: '100%', padding: '6px 0', borderRadius: 6,
            background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
            fontSize: 12, cursor: 'pointer', fontWeight: 500,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#FEF2F2')}
        >
          删除节点
        </button>
      </div>

      {/* 底部状态栏 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', padding: '6px 14px',
          borderTop: '1px solid #F3F4F6', background: '#FAFBFC', flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: '#86909C' }}>
          {def.category} · {def.type}
        </span>
      </div>
    </aside>
  );
}
