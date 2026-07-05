/**
 * App 路由 + 整体布局（PRD v2.11/v2.12）
 *
 * 整体布局：固定 240px LeftNav + 右侧内容区
 * - 路由：workflows（Home）/ editor / nodes / history / settings
 * - Editor 顶栏：白底 + slate-200 底边（PRD §9.2）
 * - 节点面板：底部悬浮（保留 lawe 交互手感）
 * - 节点配置：右侧 Drawer
 *
 * 视觉规范（PRD §9.2 严格遵循）：
 * - 零渐变、零紫色、黑底白字主按钮
 * - 文字主色 #020617（slate-950），边框 #e2e8f0（slate-200）
 * - 字体 Inter
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Undo2, Redo2, Save, Play, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { LeftNav, NavKey } from './components/LeftNav';
import { WorkflowsPage as HomePage } from './pages/HomePage';
import { NodesPage } from './pages/NodesPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { Canvas } from './components/Canvas';
import { NodePanel } from './components/NodePanel';
import { BottomToolbar } from './components/BottomToolbar';
import { ConfigPanel } from './components/ConfigPanel';
import type { NodeDefinition, Workflow, WorkflowGraph } from '@/lib/types';

const EMPTY_GRAPH: WorkflowGraph = { nodes: [], edges: [] };

/**
 * 给没有 meta.x/meta.y 的节点自动铺开：按节点索引 3 列网格排
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

type View =
  | { kind: 'workflows' }
  | { kind: 'editor'; wf: Workflow }
  | { kind: NavKey };

export default function App() {
  // 全局：健康检查、节点定义
  const [health, setHealth] = useState<{ ok: boolean; version: string } | null>(null);
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);

  // 路由：当前显示的页面
  const [view, setView] = useState<View>({ kind: 'workflows' });

  // Editor 状态
  const [graph, setGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [currentName, setCurrentName] = useState('未命名工作流');
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
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
  const navKey: NavKey = view.kind === 'editor' ? 'workflows' : view.kind;

  const navigate = (k: NavKey) => {
    if (k === 'workflows') {
      setView({ kind: 'workflows' });
    } else {
      setView({ kind: k });
    }
    setSelectedNodeId(null);
    setConfigOpen(false);
    setShowNodePanel(false);
  };

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
    setView({ kind: 'workflows' });
    setSelectedNodeId(null);
    setConfigOpen(false);
    setShowNodePanel(false);
  };

  const createWorkflow = useCallback(async (): Promise<void> => {
    const wf = await api.saveWorkflow({
      name: '未命名工作流',
      description: '',
      nodes: [],
      edges: [],
    });
    const fresh = await api.getWorkflow(wf.id);
    openWorkflow(fresh);
  }, []);

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
  const selectedNode = useMemo(
    () => (currentWf && selectedNodeId
      ? currentWf.graph.nodes.find((n) => n.id === selectedNodeId) || null
      : null),
    [currentWf, selectedNodeId],
  );
  const selectedDef = selectedNode ? nodes.find((n) => n.type === selectedNode.type) || null : null;

  // ---- 渲染内容区 ----
  const renderContent = () => {
    if (view.kind === 'editor') {
      return (
        <div className="h-full w-full flex flex-col" style={{ background: '#f8fafc' }}>
          {/* 顶栏（PRD §9.2 shadcn 风格） */}
          <header
            style={{
              height: 44, display: 'flex', alignItems: 'center',
              padding: '0 16px', flexShrink: 0,
              background: '#ffffff', borderBottom: '1px solid #e2e8f0',
            }}
          >
            {/* 左：返回 + Logo + 名称 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={backToHome}
                className="awe-icon-btn"
                style={{ width: 'auto', height: 28, padding: '0 8px', gap: 4 }}
                title="返回工作流列表"
              >
                <ArrowLeft size={14} />
                <span style={{ fontSize: 12 }}>返回</span>
              </button>
              <div style={{ width: 1, height: 20, background: '#e2e8f0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Logo（PRD §9.2：黑底白字 + 字符 A，不用紫色） */}
                <div
                  style={{
                    width: 26, height: 26, borderRadius: 6,
                    background: '#0f172a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 700 }}>A</span>
                </div>
                <input
                  value={currentName}
                  onChange={(e) => setCurrentName(e.target.value)}
                  className="awe-input"
                  style={{
                    width: 260, height: 28, fontSize: 14, fontWeight: 600, color: '#020617',
                    border: 'none', boxShadow: 'none', background: 'transparent',
                    padding: '0 6px',
                  }}
                  onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.background = '#f1f5f9')}
                  onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.background = 'transparent')}
                  placeholder="工作流名称"
                />
              </div>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>v0.3.1</span>
            </div>

            {/* 右：撤销 / 重做 / 保存 / 运行 */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={onUndo}
                title="撤销 Ctrl+Z"
                className="awe-icon-btn"
                style={{ width: 28, height: 28 }}
              >
                <Undo2 size={13} />
              </button>
              <button
                onClick={onRedo}
                title="重做 Ctrl+Y"
                className="awe-icon-btn"
                style={{ width: 28, height: 28 }}
              >
                <Redo2 size={13} />
              </button>

              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '0 12px', height: 28, borderRadius: 6,
                  background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569',
                  fontSize: 12, fontWeight: 500, cursor: isSaving ? 'wait' : 'pointer',
                  opacity: isSaving ? 0.5 : 1,
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                title="保存 (Ctrl+S)"
                onMouseEnter={(e) => {
                  if (isSaving) return;
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#0f172a';
                  (e.currentTarget as HTMLButtonElement).style.color = '#020617';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                  (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                }}
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
                  background: '#0f172a', border: 'none', color: '#ffffff',
                  fontSize: 12, fontWeight: 600, cursor: isRunning ? 'wait' : 'pointer',
                  opacity: isRunning ? 0.5 : 1,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (isRunning) return;
                  (e.currentTarget as HTMLButtonElement).style.background = '#1e293b';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#0f172a';
                }}
              >
                {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="currentColor" />}
                {isRunning ? '运行中…' : '运行'}
              </button>
            </div>
          </header>

          {/* 主体：画布 + 悬浮工具栏 + 节点面板 */}
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

            <BottomToolbar
              onTestRun={handleRun}
              isRunning={isRunning}
              showNodePanel={showNodePanel}
              onToggleNodePanel={() => setShowNodePanel((v) => !v)}
              zoom={zoom}
              nodeCount={graph.nodes.length}
            />

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

            {!configOpen && !selectedNodeId && graph.nodes.length > 0 && (
              <div
                style={{
                  position: 'absolute', right: 20, top: 16, zIndex: 15,
                  width: 280, background: '#ffffff', border: '1px solid #e2e8f0',
                  borderRadius: 8, padding: 16, boxShadow: 'var(--shadow-float)',
                  color: '#64748b', fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 600, color: '#020617', marginBottom: 8 }}>使用提示</div>
                <ul style={{ paddingLeft: 18, lineHeight: 1.8, margin: 0 }}>
                  <li>点击底部「＋」添加节点</li>
                  <li>从节点端口拖线连接</li>
                  <li>点击节点右侧面板编辑配置</li>
                  <li>拖动画布空白处平移视角</li>
                </ul>
              </div>
            )}

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
                background: 'rgba(15,23,42,0.92)', color: '#ffffff', padding: '8px 20px',
                borderRadius: 8, fontSize: 13, zIndex: 99, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              }}
            >
              {toast}
            </div>
          )}
        </div>
      );
    }

    // 其它页面
    if (view.kind === 'workflows') {
      return <HomePage onOpen={openWorkflow} onCreate={createWorkflow} />;
    }
    if (view.kind === 'nodes') {
      return <NodesPage nodes={nodes} />;
    }
    if (view.kind === 'history') {
      return <HistoryPage />;
    }
    if (view.kind === 'settings') {
      return <SettingsPage health={health} />;
    }
    return null;
  };

  return (
    <>
      {view.kind === 'editor' ? (
        // 编辑模式：全屏（无左侧导航）
        <div style={{ height: '100%', width: '100%', background: '#ffffff' }}>
          {renderContent()}
        </div>
      ) : (
        // 其它页面：左 240 导航 + 右内容
        <div style={{ display: 'flex', height: '100%', width: '100%', background: '#ffffff' }}>
          <LeftNav active={navKey} onChange={navigate} health={health} />
          <main style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden' }}>
            {renderContent()}
          </main>
        </div>
      )}
    </>
  );
}

/* ---------- 节点配置 Drawer（PRD §9.2 shadcn 风格：白底 + 细边 + slate 配色） ---------- */

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
  // 颜色（与 NodeRender / NodePanel 保持一致 - shadcn 6 类行业色）
  const COLOR_BAR: Record<string, string> = {
    emerald: '#16a34a',
    blue:    '#2563eb',
    amber:   '#d97706',
    sky:     '#0284c7',
    rose:    '#dc2626',
    slate:   '#0f172a',
    violet:  '#7c3aed',
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
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: 'var(--shadow-float)',
        fontSize: 13,
        overflow: 'hidden',
      }}
    >
      {/* 标题栏 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 26, height: 26, borderRadius: 6, background: color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <span style={{ color: '#ffffff', fontSize: 12, fontWeight: 700 }}>
              {def.name.charAt(0)}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: '#020617',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {def.name}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{def.category} · {def.type}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onRun}
            disabled={isRunning}
            className="awe-icon-btn"
            style={{ width: 28, height: 28, color: isRunning ? '#cbd5e1' : '#16a34a' }}
            title="试运行"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="8 5 19 12 8 19 8 5" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="awe-icon-btn"
            style={{ width: 28, height: 28 }}
            title="关闭"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 配置表单 */}
      <div className="thin-scroll flex-1 overflow-y-auto" style={{ padding: '12px 14px' }}>
        <ConfigPanel node={fakeNode} def={def} onChange={onChange} />

        <div style={{ height: 1, background: '#e2e8f0', margin: '12px 0' }} />

        <div style={{ fontSize: 12, fontWeight: 600, color: '#020617', marginBottom: 6 }}>输出变量</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {def.outputs && def.outputs.length > 0 ? (
            def.outputs.map((o, i) => (
              <span
                key={i}
                className="awe-badge"
                style={{ fontSize: 11 }}
              >
                <span style={{ color: '#94a3b8' }}>{o.type}</span>
                <span style={{ color: '#020617', fontWeight: 500 }}>{o.name}</span>
              </span>
            ))
          ) : (
            <span style={{ fontSize: 12, color: '#94a3b8' }}>无输出</span>
          )}
        </div>

        <div style={{ height: 1, background: '#e2e8f0', margin: '12px 0' }} />

        <button
          onClick={onDelete}
          style={{
            width: '100%', padding: '6px 0', borderRadius: 6,
            background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
            fontSize: 12, cursor: 'pointer', fontWeight: 500,
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fee2e2')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#fef2f2')}
        >
          删除节点
        </button>
      </div>

      {/* 底部状态栏 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', padding: '6px 14px',
          borderTop: '1px solid #e2e8f0', background: '#f8fafc', flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          {def.category} · {def.type}
        </span>
      </div>
    </aside>
  );
}
