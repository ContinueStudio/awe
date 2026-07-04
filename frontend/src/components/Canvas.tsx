/**
 * 轻量可视化画布
 * - 节点拖拽
 * - 端口连线（点击端口起始，再点目标端口完成）
 * - 选中删除
 * - 平移 / 缩放
 *
 * 注：PRD 规划使用 @flowgram.ai；本画布为「先跑通」的轻量替代，
 * 后续可在不改 API 的前提下替换为 flowgram 的 FreeLayoutEditor。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { CanvasEdge, CanvasNode, NodeDefinition, WorkflowGraph } from '@/lib/types';
import { NodeRender } from './NodeRender';

interface Props {
  workflowId: string | null;
  workflowName: string;
  graph: WorkflowGraph;
  nodes: NodeDefinition[];
  onChange: (g: WorkflowGraph) => void;
  onWorkflowId: (id: string | null) => void;
  onWorkflowName: (name: string) => void;
  onSelectNode: (id: string | null) => void;
  onSave?: (id: string) => void;
}

interface ViewState {
  x: number;
  y: number;
  scale: number;
}

const DEFAULT_VIEW: ViewState = { x: 0, y: 0, scale: 1 };

export function Canvas({
  workflowId,
  workflowName,
  graph,
  nodes,
  onChange,
  onWorkflowId,
  onWorkflowName,
  onSelectNode,
  onSave,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftEdge, setDraftEdge] = useState<{ fromNode: string; x: number; y: number } | null>(null);
  const [dragNode, setDragNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  const [running, setRunning] = useState(false);
  // 旧字段 result 已废弃，运行由 App.tsx 协调

  const nodeDefs = useMemo(() => Object.fromEntries(nodes.map((n) => [n.type, n])), [nodes]);

  // ---- 节点位置管理 ----
  const getNodePos = useCallback(
    (id: string) => {
      const n = graph.nodes.find((x) => x.id === id);
      return { x: n?.meta?.x ?? 100, y: n?.meta?.y ?? 100 };
    },
    [graph.nodes],
  );

  const updateNodeMeta = useCallback(
    (id: string, patch: Partial<CanvasNode['meta']>) => {
      const next = {
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === id ? { ...n, meta: { ...(n.meta || {}), ...patch } } : n)),
      };
      onChange(next);
    },
    [graph, onChange],
  );

  // ---- 画布坐标转换 ----
  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (sx - rect.left - view.x) / view.scale,
        y: (sy - rect.top - view.y) / view.scale,
      };
    },
    [view],
  );

  // ---- 节点拖拽 ----
  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const pos = getNodePos(id);
    const w = screenToWorld(e.clientX, e.clientY);
    setDragNode({ id, offsetX: w.x - pos.x, offsetY: w.y - pos.y });
  };

  // ---- 画布平移 ----
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== svgRef.current) return;
    setSelectedId(null);
    setPanning({ x: e.clientX - view.x, y: e.clientY - view.y });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragNode) {
        const w = screenToWorld(e.clientX, e.clientY);
        updateNodeMeta(dragNode.id, { x: w.x - dragNode.offsetX, y: w.y - dragNode.offsetY });
      } else if (panning) {
        setView((v) => ({ ...v, x: e.clientX - panning.x, y: e.clientY - panning.y }));
      } else if (draftEdge) {
        const w = screenToWorld(e.clientX, e.clientY);
        setDraftEdge((d) => (d ? { ...d, x: w.x, y: w.y } : d));
      }
    };
    const onUp = () => {
      setDragNode(null);
      setPanning(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragNode, panning, draftEdge, screenToWorld, updateNodeMeta]);

  // ---- 缩放 ----
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setView((v) => {
      const ns = Math.max(0.3, Math.min(2.5, v.scale * factor));
      // 缩放围绕鼠标位置
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      return { x: cx - wx * ns, y: cy - wy * ns, scale: ns };
    });
  };

  // ---- 端口连线 ----
  const startEdge = (e: React.MouseEvent, fromNode: string) => {
    e.stopPropagation();
    const w = screenToWorld(e.clientX, e.clientY);
    setDraftEdge({ fromNode, x: w.x, y: w.y });
  };
  const completeEdge = (e: React.MouseEvent, toNode: string) => {
    e.stopPropagation();
    if (!draftEdge || draftEdge.fromNode === toNode) {
      setDraftEdge(null);
      return;
    }
    if (graph.edges.some((x) => x.source === draftEdge.fromNode && x.target === toNode)) {
      setDraftEdge(null);
      return;
    }
    const newEdge: CanvasEdge = {
      id: `e_${Date.now()}`,
      source: draftEdge.fromNode,
      target: toNode,
    };
    onChange({ ...graph, edges: [...graph.edges, newEdge] });
    setDraftEdge(null);
  };

  // ---- 删除 ----
  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    onChange({
      nodes: graph.nodes.filter((n) => n.id !== selectedId),
      edges: graph.edges.filter((e) => e.source !== selectedId && e.target !== selectedId),
    });
    setSelectedId(null);
  }, [selectedId, graph, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        // 在输入框中不触发
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        deleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, selectedId]);

  // ---- 保存 / 运行 ----
  const save = async () => {
    const res = await api.saveWorkflow({
      id: workflowId || undefined,
      name: workflowName || '未命名工作流',
      description: '',
      nodes: graph.nodes,
      edges: graph.edges,
    });
    onWorkflowId(res.id);
    onSave?.(res.id);
  };

  // 运行已由 App.tsx 的 RunHistoryPanel 处理
  // 旧的 run() 函数 + setRunning/setResult 已删除

  // 自动记忆新创建的工作流 id
  useEffect(() => {
    if (workflowId) localStorage.setItem('awe:last_id', workflowId);
  }, [workflowId]);

  // ---- 渲染辅助 ----
  // 节点宽度固定 220；高度按内容自适应（标题双行 + ports 行高 20px + 边距）
  // 经验值：色条 4 + header 56(双行 13/10.5px) + 端口区 count*20 + 内边距 8 = 68 + count*20
  const PORT_R = 5;
  const NODE_W = 220;
  const HEADER_H = 56; // 4 (色条) + 10 (py-2.5 上) + 32 (双行 13+10.5 + leading) + 10 (py-2.5 下) ≈ 56
  const PORT_GAP = 20; // NodeRender 内 port 行高 h-5
  const PORT_AREA_PAD = 8; // px-2 顶 padding + pb-2 底 padding 之和

  // 节点外壳高度 = header + 端口区
  // 注意：用 inputs + outputs 总数（不是 max），因为 inputs 和 outputs 都各自占行
  const nodeHeight = (totalPorts: number) =>
    Math.max(120, HEADER_H + PORT_AREA_PAD + totalPorts * PORT_GAP + 8);

  // 端口圆点中心 y：header 底部 + 端口区 padding-top + i 行 + 半行高
  const portDotY = (nodeY: number, i: number) => nodeY + HEADER_H + 8 + i * PORT_GAP + PORT_GAP / 2;

  const portPositions = (id: string) => {
    const n = graph.nodes.find((x) => x.id === id);
    if (!n) return { ins: [], outs: [] };
    const def = nodeDefs[n.type];
    const baseY = getNodePos(id).y;
    const ins = (def?.inputs || []).map((_, i) => ({
      name: def!.inputs[i].name,
      x: getNodePos(id).x,
      y: portDotY(baseY, i),
    }));
    const outs = (def?.outputs || []).map((_, i) => ({
      name: def!.outputs[i].name,
      x: getNodePos(id).x + NODE_W,
      y: portDotY(baseY, i),
    }));
    return { ins, outs };
  };

  const edgePath = (e: CanvasEdge) => {
    const sP = portPositions(e.source).outs[0];
    const tP = portPositions(e.target).ins[0];
    if (!sP || !tP) return '';
    const dx = Math.max(40, Math.abs(tP.x - sP.x) * 0.4);
    return `M ${sP.x} ${sP.y} C ${sP.x + dx} ${sP.y}, ${tP.x - dx} ${tP.y}, ${tP.x} ${tP.y}`;
  };

  const selectedNode = selectedId ? graph.nodes.find((n) => n.id === selectedId) || null : null;
  const selectedDef = selectedNode ? nodeDefs[selectedNode.type] || null : null;

  return (
    <div className="relative flex-1 flex">
      {/* 主画布 */}
      <div className="relative flex-1">
        {/* 缩放控件 */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 glass rounded-xl p-1 shadow-sm">
          <button className="awe-icon-btn" onClick={() => setView((v) => ({ ...v, scale: Math.min(2.5, v.scale * 1.2) }))}>
            <ZoomIn className="w-4 h-4" />
          </button>
          <button className="awe-icon-btn" onClick={() => setView((v) => ({ ...v, scale: Math.max(0.3, v.scale / 1.2) }))}>
            <ZoomOut className="w-4 h-4" />
          </button>
          <button className="awe-icon-btn" onClick={() => setView(DEFAULT_VIEW)}>
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* 运行历史已移到右侧 RunHistoryPanel */}

        <svg
          ref={svgRef}
          className="awe-canvas select-none"
          onMouseDown={onCanvasMouseDown}
          onWheel={onWheel}
        >
          {/* 网格背景 */}
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#cbd5e1" opacity="0.5" />
            </pattern>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
            {/* 已有的边 */}
            {graph.edges.map((e) => (
              <path
                key={e.id || `${e.source}-${e.target}`}
                d={edgePath(e)}
                fill="none"
                stroke="#64748b"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
            ))}
            {/* 正在拖拽的连线 */}
            {draftEdge && (
              <path
                d={`M ${(portPositions(draftEdge.fromNode).outs[0]?.x ?? 0)} ${(portPositions(draftEdge.fromNode).outs[0]?.y ?? 0)} L ${draftEdge.x} ${draftEdge.y}`}
                fill="none"
                stroke="#3478f6"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            )}

            {/* 节点 */}
            {graph.nodes.map((n) => {
              const def = nodeDefs[n.type];
              if (!def) return null;
              const pos = getNodePos(n.id);
              return (
                <g key={n.id} transform={`translate(${pos.x},${pos.y})`}>
                  <foreignObject width={NODE_W} height={nodeHeight(def.inputs.length + def.outputs.length)}>
                    <div
                      onMouseDown={(e) => onNodeMouseDown(e, n.id)}
                      onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); }}
                      className={cn(
                        'rounded-xl border bg-white shadow-sm cursor-grab active:cursor-grabbing transition-shadow',
                        selectedId === n.id ? 'border-brand-500 ring-2 ring-brand-200 shadow-md' : 'border-slate-200 hover:shadow-md',
                      )}
                    >
                      <NodeRender
                        node={n}
                        def={def}
                        onStartEdge={(e) => startEdge(e, n.id)}
                        onCompleteEdge={(e) => completeEdge(e, n.id)}
                      />
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
