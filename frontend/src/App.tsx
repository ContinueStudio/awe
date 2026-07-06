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
import React from 'react';
import { ArrowLeft, Undo2, Redo2, History as HistoryIcon, Loader2, Rocket } from 'lucide-react';
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
import { ZoomControls } from './components/ZoomControls';
import { RunHistoryDrawer } from './components/RunHistoryDrawer';
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
  // v0.3.10：画布选择模式（true=框选/false=平移）
  const [selectMode, setSelectMode] = useState(false);
  const [showRunHistory, setShowRunHistory] = useState(false);
  // v0.3.11：画布多选节点 id 集合
  const [selectedNodeIds, setSelectedNodeIdsState] = useState<Set<string>>(new Set());
  // v0.3.5 升级：zoom (scalar) → canvasView ({ x, y, scale })，由父组件管理，传递给 Canvas 实现左下角缩放控件
  const [canvasView, setCanvasView] = useState<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });
  const [toast, setToast] = useState<string | null>(null);

  // v2.37：frameless 模式下整栏拖动 handler，主标题栏和编辑器顶栏共用
  const onWindowDragMouseDown = useWindowDrag();

  // 编辑器顶栏内部按钮/输入框阻止 drag 冒泡，避免点击它们时误拖动窗口
  const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

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

  // v0.3.11：单节点测试运行
  const handleRunSingleNode = useCallback(async () => {
    if (view.kind !== 'editor' || !selectedNodeId) return;
    if (!view.wf.id) { await handleSave(); }
    const targetWfId = view.wf.id;
    setIsRunning(true);
    try {
      await api.runSingleNode(targetWfId, selectedNodeId, {});
      setToast(`节点 ${selectedNodeId.slice(0, 6)} 试运行完成，查看日志`);
      setShowRunHistory(true);
    } catch (e) {
      console.error('single run failed', e);
      alert('试运行失败：' + (e as Error).message);
    } finally {
      setIsRunning(false);
    }
  }, [view, selectedNodeId, handleSave]);

  // v0.3.11：框选运行
  const handleRunSelectedNodes = useCallback(async (nodeIds: string[]) => {
    if (view.kind !== 'editor') return;
    if (!view.wf.id) { await handleSave(); }
    const targetWfId = view.wf.id;
    setIsRunning(true);
    try {
      await api.runSelectedNodes(targetWfId, nodeIds, {});
      setToast(`框选 ${nodeIds.length} 个节点运行完成，查看日志`);
      setShowRunHistory(true);
    } catch (e) {
      console.error('selected run failed', e);
      alert('框选运行失败：' + (e as Error).message);
    } finally {
      setIsRunning(false);
    }
  }, [view, handleSave]);

  // 撤销 / 重做（占位 - 后续接入 Command 模式）
  const onUndo = () => setToast('撤销（待接入）');
  const onRedo = () => setToast('重做（待接入）');

  // 版本历史（占位 - 后续接入版本管理）
  const onOpenVersionHistory = () => setToast('版本历史（待接入）');

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
          {/* 顶栏（v0.3.6 - 严格按 lawe 风格：紧凑 + 精致 + 黑白灰） */}
          {/* v2.37：加整栏拖动，但内部按钮/输入框阻止冒泡避免误触发 */}
          <header
            onMouseDown={onWindowDragMouseDown}
            style={{
              height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 12px 0 8px', flexShrink: 0,
              background: '#ffffff', borderBottom: '1px solid #e2e8f0',
            }}
          >
            {/* 左：返回 + Logo + 工作流名 + 版本 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <button
                onClick={backToHome}
                onMouseDown={stopDrag}
                title="返回工作流列表"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none',
                  color: '#475569', cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
                  (e.currentTarget as HTMLButtonElement).style.color = '#020617';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                }}
              >
                <ArrowLeft size={15} />
              </button>

              <div style={{ width: 1, height: 18, background: '#e2e8f0' }} />

              {/* Logo（品牌蓝底白字方块 + 字符 A） */}
              <div
                style={{
                  width: 22, height: 22, borderRadius: 5,
                  background: 'var(--primary, #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 700, letterSpacing: -0.2 }}>A</span>
              </div>

              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary, #3b82f6)', flexShrink: 0, letterSpacing: 0.2 }}>
                AWE
              </span>

              <span style={{ width: 1, height: 14, background: '#e2e8f0' }} />

              {/* 标题输入（v0.3.6 加宽到 380px，支持长标题不截断） */}
              <input
                value={currentName}
                onChange={(e) => setCurrentName(e.target.value)}
                onMouseDown={stopDrag}
                style={{
                  flex: 1,
                  maxWidth: 380,
                  minWidth: 120,
                  height: 28,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#020617',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  background: 'transparent',
                  padding: '0 8px',
                  borderRadius: 4,
                  transition: 'background 0.15s',
                }}
                onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.background = '#f1f5f9')}
                onBlur={(e) => ((e.currentTarget as HTMLInputElement).style.background = 'transparent')}
                placeholder="工作流名称"
              />

              <span style={{
                fontSize: 10, color: '#94a3b8', fontWeight: 500,
                padding: '1px 6px', background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 4, flexShrink: 0,
              }}>
                v0.3.6
              </span>
            </div>

            {/* 右：撤销 / 重做 / 版本历史 / 发版 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <button
                onClick={onUndo}
                onMouseDown={stopDrag}
                title="撤销 Ctrl+Z"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none',
                  color: '#475569', cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
                  (e.currentTarget as HTMLButtonElement).style.color = '#020617';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                }}
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={onRedo}
                onMouseDown={stopDrag}
                title="重做 Ctrl+Y"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'transparent', border: 'none',
                  color: '#475569', cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
                  (e.currentTarget as HTMLButtonElement).style.color = '#020617';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                }}
              >
                <Redo2 size={14} />
              </button>

              <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 4px' }} />

              {/* 版本历史按钮（次按钮样式 - lawe 风格细边白底） */}
              <button
                onClick={onOpenVersionHistory}
                onMouseDown={stopDrag}
                title="版本历史"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '0 10px', height: 28, borderRadius: 6,
                  background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary, #3b82f6)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#020617';
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-light, #eff6ff)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                  (e.currentTarget as HTMLButtonElement).style.color = '#475569';
                  (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
                }}
              >
                <HistoryIcon size={13} />
                版本历史
              </button>

              {/* 发版按钮（品牌蓝底白字 + Rocket 图标） */}
              <button
                onClick={handleSave}
                onMouseDown={stopDrag}
                disabled={isSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '0 12px', height: 28, borderRadius: 6,
                  background: 'var(--primary, #3b82f6)', border: '1px solid var(--primary, #3b82f6)', color: '#ffffff',
                  fontSize: 12, fontWeight: 600, cursor: isSaving ? 'wait' : 'pointer',
                  opacity: isSaving ? 0.6 : 1,
                  transition: 'background 0.15s, border-color 0.15s',
                  marginLeft: 4,
                }}
                title="发版 (Ctrl+S)"
                onMouseEnter={(e) => {
                  if (isSaving) return;
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-hover, #2563eb)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary-hover, #2563eb)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary, #3b82f6)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary, #3b82f6)';
                }}
              >
                {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Rocket size={13} />}
                发版
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
              view={canvasView}
              onViewChange={setCanvasView}
              selectMode={selectMode}
              onSelectedIdsChange={setSelectedNodeIdsState}
            />

            <BottomToolbar
              onTestRun={handleRun}
              isRunning={isRunning}
              showNodePanel={showNodePanel}
              onToggleNodePanel={() => setShowNodePanel((v) => !v)}
              zoom={canvasView.scale}
              nodeCount={graph.nodes.length}
              selectMode={selectMode}
              onToggleSelectMode={() => setSelectMode((v) => !v)}
              onShowLogs={() => setShowRunHistory(true)}
              selectedNodeIds={selectedNodeIds}
              onRunSelected={() => handleRunSelectedNodes(Array.from(selectedNodeIds))}
            />

            {/* v0.3.5 新增：左下角缩放控件（fixed 视口定位，不受 Canvas 缩放影响） */}
            <ZoomControls
              scale={canvasView.scale}
              onChange={(s) => setCanvasView((v) => ({ ...v, scale: s }))}
              onReset={() => setCanvasView((v) => ({ ...v, x: 0, y: 0 }))}
            />

            {showNodePanel && (
              <>
                <div
                  onClick={() => setShowNodePanel(false)}
                  style={{ position: 'absolute', inset: 0, zIndex: 24 }}
                />
                <div
                  // v0.3.6 加固：absolute + flex 居中，替代 left:50% + transform:translateX(-50%)
                  // 避免父容器在某些缩放渲染场景下 transform 影响此 absolute 定位
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 72,
                    display: 'flex',
                    justifyContent: 'center',
                    zIndex: 30,
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ pointerEvents: 'auto' }}>
                    <NodePanel onAdd={addNode} />
                  </div>
                </div>
              </>
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
                onRun={handleRunSingleNode}
              />
            )}

            {/* v0.3.10：运行日志抽屉 */}
            <RunHistoryDrawer
              current={currentWf}
              open={showRunHistory}
              onClose={() => setShowRunHistory(false)}
              isRunning={isRunning}
            />
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
        // 整层背景用 #f8fafc（侧栏色），与 WebView2 边框色一致 → 消除"顶部黑色边框"
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: '#f8fafc' }}>
          {/* v2.27：frameless 模式下的自定义标题栏 */}
          <CustomTitleBar onMouseDown={onWindowDragMouseDown} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%' }}>
            <LeftNav active={navKey} onChange={navigate} health={health} />
            <main style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', background: '#ffffff' }}>
              {renderContent()}
            </main>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- 窗口拖动 hook（v2.37 抽出复用） ----------
   frameless 模式下整栏拖动：mousedown 同步初始化 Python 端权威位置，
   mousemove 发送 CSS 逻辑像素增量给 move_window_delta。 */
function useWindowDrag() {
  const inPywebview = typeof (window as any).pywebview !== 'undefined';
  const api = inPywebview ? (window as any).pywebview.api : null;

  const dragRef = React.useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false, lastX: 0, lastY: 0,
  });

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    // 同步初始化 Python 端权威窗口位置（GetWindowRect，不 await）
    api?.start_drag?.();
    dragRef.current = {
      active: true,
      lastX: e.screenX,
      lastY: e.screenY,
    };
  };

  // 全局 mousemove / mouseup
  React.useEffect(() => {
    if (!inPywebview) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const dx = e.screenX - dragRef.current.lastX;
      const dy = e.screenY - dragRef.current.lastY;
      if (dx === 0 && dy === 0) return;
      dragRef.current.lastX = e.screenX;
      dragRef.current.lastY = e.screenY;
      api?.move_window_delta?.(dx, dy);
    };
    const onUp = () => {
      dragRef.current.active = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [inPywebview, api]);

  return onMouseDown;
}

/* ---------- 自定义标题栏 (v2.27 frameless 模式) ----------
   pywebview 6.x 没有 title_bar_color / icon 参数
   → 用 frameless=True 去掉原生 chrome
   → 前端自绘标题栏：slate-50 背景 + 拖动区 + 最小/最大/关闭
   → 通过 window.pywebview.api.{minimize,close}() 与 Python 通讯 */
function CustomTitleBar({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const inPywebview = typeof (window as any).pywebview !== 'undefined';
  const api = inPywebview ? (window as any).pywebview.api : null;

  // 整栏可拖动（PyWebview frameless 模式）
  // v2.28：用 CSS class 替代 React style，避免 -webkit-app-region 类型问题
  const baseStyle: React.CSSProperties = {
    height: 32,
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 8px 0 12px',
    flexShrink: 0,
  };

  return (
    <div
      className="awe-titlebar"
      style={baseStyle}
      onMouseDown={onMouseDown}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b' }}>
        <span style={{ fontWeight: 600, color: '#020617' }}>AWE</span>
        <span style={{ color: '#cbd5e1' }}>·</span>
        <span>智能体工作流引擎</span>
      </div>

      <div style={{ display: 'flex' }}>
        <button
          onClick={() => api?.minimize?.()}
          title="最小化"
          style={{
            width: 32, height: 32, border: 'none', background: 'transparent',
            color: '#64748b', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = '#e2e8f0')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = 'transparent')}
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><line x1="2" y1="6" x2="10" y2="6" stroke="currentColor" strokeWidth="1.5" /></svg>
        </button>
        <button
          onClick={() => api?.close_window?.()}
          title="关闭"
          style={{
            width: 32, height: 32, border: 'none', background: 'transparent',
            color: '#64748b', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#dc2626';
            (e.currentTarget as HTMLButtonElement).style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
            <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
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
  // 颜色（与 NodeRender / NodePanel 保持一致 - 现代轻盈配色）
  const COLOR_BAR: Record<string, string> = {
    emerald: '#10b981',
    blue:    '#3b82f6',
    amber:   '#f59e0b',
    sky:     '#0ea5e9',
    rose:    '#f43f5e',
    slate:   '#475569',
    violet:  '#8b5cf6',
  };
  const color = COLOR_BAR[def.color] || COLOR_BAR.slate;

  if (!open) return null;

  return (
    <aside
      // v0.3.5 修复：absolute → fixed，避免缩放时 Drawer 跑到视口外
      className="fixed right-4 z-30 flex flex-col"
      style={{
        top: 60, // 顶栏 44px + 16px 间距
        width: 380,
        height: 'calc(100vh - 76px)', // 视口高度 - 顶栏 44 - 上下 16 间距
        maxHeight: 800,
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
