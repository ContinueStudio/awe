/**
 * App 路由：Home（卡片网格） / Editor（点开某个工作流后）
 *
 * N8N / Dify 范式：
 * - 默认显示所有工作流卡片
 * - 点击卡片进入编辑页
 * - 运行历史 / 节点配置 都是右侧 Drawer
 */
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Cpu, Save, Play, Loader2, History, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { HomePage } from './pages/HomePage';
import { NodePalette } from './components/NodePalette';
import { Canvas } from './components/Canvas';
import { RunHistoryDrawer } from './components/RunHistoryDrawer';
import { ConfigPanel } from './components/ConfigPanel';
import type { NodeDefinition, Workflow, WorkflowGraph } from './lib/types';

const EMPTY_GRAPH: WorkflowGraph = { nodes: [], edges: [] };

type View = { kind: 'home' } | { kind: 'editor'; wf: Workflow };

export default function App() {
  const [view, setView] = useState<View>({ kind: 'home' });
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);
  const [graph, setGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [currentName, setCurrentName] = useState('未命名工作流');
  const [health, setHealth] = useState<{ ok: boolean; version: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Drawers
  const [historyOpen, setHistoryOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  // 当前选中节点
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // ---- 启动 ----
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false, version: 'unknown' }));
    api.listNodes().then((d) => setNodes(d.nodes)).catch(console.error);
  }, []);

  // ---- 路由 ----
  const openWorkflow = async (wf: Workflow) => {
    // 重新拉最新 graph（如果旧卡片里没有 graph）
    let graphData = wf.graph;
    if (!graphData) {
      try {
        const fresh = await api.getWorkflow(wf.id);
        graphData = fresh.graph;
      } catch (e) { graphData = EMPTY_GRAPH; }
    }
    setView({ kind: 'editor', wf: { ...wf, graph: graphData } });
    setGraph(graphData);
    setCurrentName(wf.name);
    setSelectedNodeId(null);
    setConfigOpen(false);
    setHistoryOpen(false);
  };

  const backToHome = () => {
    setView({ kind: 'home' });
    setSelectedNodeId(null);
    setConfigOpen(false);
    setHistoryOpen(false);
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
          meta: { title: def.name, x: 140 + (step % 6) * 260, y: 160 + Math.floor(step / 6) * 180 },
        },
      ],
      edges: [...graph.edges],
    });
    if (currentName === '未命名工作流') setCurrentName(def.name + ' 工作流');
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
    // 没保存过就先保存
    if (!view.wf.id) {
      await handleSave();
    }
    const targetWfId = view.wf.id;
    setIsRunning(true);
    setHistoryOpen(true);
    try {
      await api.runWorkflow(targetWfId, {});
    } catch (e) {
      console.error('run failed', e);
      alert('运行失败：' + (e as Error).message);
    } finally {
      setIsRunning(false);
    }
  }, [view, handleSave]);

  // ---- 当前 wf 用于历史 / 配置 ----
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
    <div className="h-full w-full flex flex-col bg-slate-50">
      {/* 顶栏 */}
      <header className="h-12 shrink-0 glass border-b border-slate-200/70 flex items-center px-3 gap-3">
        <button
          onClick={backToHome}
          className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100"
          title="返回工作流列表"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>返回</span>
        </button>
        <div className="w-px h-5 bg-slate-200" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-white" />
          </div>
          <input
            value={currentName}
            onChange={(e) => setCurrentName(e.target.value)}
            className="bg-transparent text-sm font-semibold text-slate-800 outline-none w-64 focus:bg-white/60 px-1.5 py-0.5 rounded transition-colors"
            placeholder="工作流名称"
          />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100"
            title="运行历史"
          >
            <History className="w-3.5 h-3.5" />
            <span>历史</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
              "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50",
              "disabled:opacity-50",
            )}
            title="保存 (Ctrl+S)"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            保存
          </button>
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white shadow-sm",
              "bg-gradient-to-r from-brand-500 to-violet-500 hover:from-brand-600 hover:to-violet-600",
              "disabled:opacity-50",
            )}
          >
            {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {isRunning ? '运行中…' : '运行'}
          </button>
        </div>
      </header>

      {/* 主体：左 NodePalette + 中 Canvas */}
      <div className="flex-1 flex min-h-0">
        <NodePalette onAdd={addNode} />
        <div className="flex-1 min-w-0">
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
        </div>
      </div>

      {/* Drawer: 节点配置 */}
      {selectedNode && selectedDef && (
        <NodeConfigDrawer
          open={configOpen}
          node={selectedNode}
          defName={selectedDef.name}
          nodeType={selectedNode.type}
          onClose={() => { setConfigOpen(false); setSelectedNodeId(null); }}
          onDelete={deleteSelectedNode}
          onChange={updateNodeConfig}
        />
      )}

      {/* Drawer: 运行历史 */}
      <RunHistoryDrawer
        current={currentWf}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRun={handleRun}
        isRunning={isRunning}
      />
    </div>
  );
}

/* ---------- 节点配置 Drawer ---------- */

function NodeConfigDrawer({
  open, node, defName, nodeType, onClose, onDelete, onChange,
}: {
  open: boolean;
  node: { id: string; config?: any };
  defName: string;
  nodeType: string;
  onClose: () => void;
  onDelete: () => void;
  onChange: (cfg: any) => void;
}) {
  // 借 ConfigPanel 复用：传入简化版 def（让 ConfigPanel 渲染通用 schema 表单）
  const fakeDef: NodeDefinition = {
    type: nodeType,
    name: defName,
    category: 'ai',
    description: '',
    icon: 'Box',
    color: 'slate',
    inputs: [],
    outputs: [],
    config_schema: {},
  };
  const fakeNode = { id: node.id, type: nodeType, config: node.config || {} } as any;
  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[380px] max-w-[95vw] glass border-l border-slate-200/70 flex flex-col shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between shrink-0">
          <div>
            <div className="text-sm font-semibold text-slate-800">{defName}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">类型：{nodeType}</div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              title="删除节点"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConfigPanel node={fakeNode} def={fakeDef} onChange={onChange} />
        </div>
      </aside>
    </>
  );
}
