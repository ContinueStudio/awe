import { useCallback, useEffect, useState } from 'react';
import { Cpu, Github } from 'lucide-react';
import { api } from '@/lib/api';
import { WorkflowSidebar } from './components/WorkflowSidebar';
import { NodePalette } from './components/NodePalette';
import { Canvas } from './components/Canvas';
import { RunHistoryPanel } from './components/RunHistoryPanel';
import type { NodeDefinition, RunResult, Workflow, WorkflowGraph } from './lib/types';

const EMPTY_GRAPH: WorkflowGraph = { nodes: [], edges: [] };

export default function App() {
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [current, setCurrent] = useState<Workflow | null>(null);
  const [graph, setGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [currentName, setCurrentName] = useState('未命名工作流');
  const [health, setHealth] = useState<{ ok: boolean; version: string } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  // 启动拉节点 + 健康
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false, version: 'unknown' }));
    api.listNodes().then((d) => setNodes(d.nodes)).catch(console.error);
  }, []);

  // 左侧列表 3s 自动刷新（拿到最新 run_count / last_status）
  useEffect(() => {
    const refresh = () => api.listWorkflows().then((d) => setWorkflows(d.workflows as any)).catch(console.error);
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  // 切换 / 创建
  const selectWorkflow = (wf: Workflow) => {
    setCurrent(wf);
    setCurrentName(wf.name);
    setGraph(wf.graph || EMPTY_GRAPH);
  };
  const createNew = () => {
    setCurrent(null);
    setCurrentName('未命名工作流');
    setGraph(EMPTY_GRAPH);
  };
  const deleteWorkflow = async (id: string) => {
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
    if (current?.id === id) createNew();
    const d = await api.listWorkflows();
    setWorkflows(d.workflows as any);
  };

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
    setCurrentName((n) => (n === '未命名工作流' ? def.name + ' 工作流' : n));
  };

  /** 同步 Canvas 内部保存后拿到的 workflowId 到 current */
  const updateWorkflowId = useCallback((id: string | null) => {
    if (!id) return;
    setCurrent((prev) => (prev ? { ...prev, id } : prev));
    setWorkflows((prev) => {
      if (prev.find((w) => w.id === id)) return prev;
      // 临时占位：等左侧下次 3s 刷新会拿到真实数据
      return prev;
    });
  }, []);

  /** 保存后拿到 id，刷新左侧列表 */
  const onSave = useCallback(async (id: string) => {
    const d = await api.listWorkflows();
    setWorkflows(d.workflows as any);
    const wf = (d.workflows as Workflow[]).find((w) => w.id === id);
    if (wf) {
      setCurrent(wf);
      setCurrentName(wf.name);
    }
  }, []);

  /** 跑工作流：先确保有 id，然后调 run_workflow */
  const handleRun = useCallback(async () => {
    let id = current?.id;
    if (!id) {
      // 还没保存 → 自动 save
      const res = await api.saveWorkflow({
        name: currentName || '未命名工作流',
        description: '',
        nodes: graph.nodes,
        edges: graph.edges,
      });
      id = res.id;
      setCurrent({ id, name: currentName, description: '', graph, created_at: 0, updated_at: 0 } as Workflow);
    }
    setIsRunning(true);
    try {
      const r: RunResult = await api.runWorkflow(id, {});
      // 跑完刷新左侧列表（拿到新 run_count + last_status）
      const d = await api.listWorkflows();
      setWorkflows(d.workflows as any);
      void r; // 详情在 RunHistoryPanel 自行拉取
    } catch (e) {
      console.error('run failed', e);
    } finally {
      setIsRunning(false);
    }
  }, [current, currentName, graph]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-50">
      {/* 顶栏 */}
      <header className="h-12 shrink-0 glass border-b border-slate-200/70 flex items-center px-4 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 leading-tight">AWE</div>
            <div className="text-[10px] text-slate-500 leading-tight">智能体工作流引擎</div>
          </div>
        </div>
        <span className="ml-2 text-[11px] text-slate-400">v0.2.1</span>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-slate-500">
          {health ? (
            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${health.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${health.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              {health.ok ? `后端已连接 · ${health.version}` : '后端离线'}
            </span>
          ) : (
            <span>连接中…</span>
          )}
          <a className="hover:text-slate-800 flex items-center gap-1" href="https://github.com/" target="_blank" rel="noreferrer">
            <Github className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* 4 栏布局：左 Sidebar | NodePalette | Canvas | RunHistory */}
      <div className="flex-1 flex min-h-0">
        <WorkflowSidebar
          currentId={current?.id ?? null}
          items={workflows}
          onSelect={selectWorkflow}
          onCreate={createNew}
          onDelete={deleteWorkflow}
        />
        <NodePalette onAdd={addNode} />
        <div className="flex-1 min-w-0">
          <Canvas
            workflowId={current?.id ?? null}
            workflowName={currentName}
            graph={graph}
            nodes={nodes}
            onChange={setGraph}
            onWorkflowId={updateWorkflowId}
            onWorkflowName={setCurrentName}
            onSave={onSave}
          />
        </div>
        <RunHistoryPanel
          current={current}
          onRun={handleRun}
          isRunning={isRunning}
        />
      </div>
    </div>
  );
}
