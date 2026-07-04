import { useEffect, useState } from 'react';
import { Cpu, Github, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { WorkflowSidebar } from './components/WorkflowSidebar';
import { NodePalette } from './components/NodePalette';
import { Canvas } from './components/Canvas';
import type { NodeDefinition, Workflow, WorkflowGraph } from './lib/types';

const EMPTY_GRAPH: WorkflowGraph = { nodes: [], edges: [] };

export default function App() {
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState('未命名工作流');
  const [graph, setGraph] = useState<WorkflowGraph>(EMPTY_GRAPH);
  const [health, setHealth] = useState<{ ok: boolean; version: string } | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false, version: 'unknown' }));
    api.listNodes().then((d) => setNodes(d.nodes)).catch(console.error);
    api.listWorkflows().then((d) => setWorkflows(d.workflows as any)).catch(console.error);
  }, []);

  // 加载工作流
  const selectWorkflow = async (wf: Workflow) => {
    setCurrentId(wf.id);
    setCurrentName(wf.name);
    setGraph(wf.graph || EMPTY_GRAPH);
  };

  const createNew = () => {
    setCurrentId(null);
    setCurrentName('未命名工作流');
    setGraph(EMPTY_GRAPH);
  };

  const deleteWorkflow = async (id: string) => {
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
    if (currentId === id) createNew();
  };

  // 添加节点 - 错开排布避免重叠
  const addNode = (type: string) => {
    const id = `n_${Date.now().toString(36)}`;
    const def = nodes.find((n) => n.type === type);
    if (!def) return;
    // 按现有节点数计算阶梯式偏移 (每加一个新节点右移 30、下移 20)
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
        <span className="ml-2 text-[11px] text-slate-400">v0.1.0</span>
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

      {/* 三栏布局 */}
      <div className="flex-1 flex min-h-0">
        <WorkflowSidebar
          currentId={currentId}
          onSelect={selectWorkflow}
          onCreate={createNew}
          onDelete={deleteWorkflow}
        />
        <NodePalette onAdd={addNode} />
        <Canvas
          workflowId={currentId}
          workflowName={currentName}
          graph={graph}
          nodes={nodes}
          onChange={setGraph}
          onWorkflowId={setCurrentId}
          onWorkflowName={setCurrentName}
        />
      </div>
    </div>
  );
}
