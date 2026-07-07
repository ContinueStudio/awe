/**
 * 轻量可视化画布
 * - 节点拖拽
 * - 端口连线（点击端口起始，再点目标端口完成）
 * - 选中删除
 * - 平移 / 缩放（view state 由父组件 App.tsx 管理，实现左下角缩放控件）
 *
 * 视觉参考 lawe：
 * - 背景用点状网格（CSS radial-gradient，class .awe-canvas）
 * - 节点固定 340px 宽，NodeRender 内部按类型显示预览
 * - 选中态视觉由 NodeRender 内部 .node-card.is-selected 处理
 *   （v0.3.5 修复：去掉外层 div 的 shadow-md，避免方角阴影透过圆角"漏"出导致 4 角黑点）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** 视图状态（受控） */
  view: { x: number; y: number; scale: number };
  onViewChange: (v: { x: number; y: number; scale: number }) => void;
  /** v0.3.x 画布增强 */
  onDuplicateNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onPaste?: () => void;
  errorNodeIds?: Set<string>;
  selectMode?: boolean;
  onSelectedIdsChange?: (ids: Set<string>) => void;
}


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
  view,
  onViewChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftEdge, setDraftEdge] = useState<{ fromNode: string; x: number; y: number } | null>(null);
  const [dragNode, setDragNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);

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
    onSelectNode(id);
    const pos = getNodePos(id);
    const w = screenToWorld(e.clientX, e.clientY);
    setDragNode({ id, offsetX: w.x - pos.x, offsetY: w.y - pos.y });
  };

  // ---- 画布平移 ----
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== svgRef.current) return;
    setSelectedId(null);
    onSelectNode(null);
    setPanning({ x: e.clientX - view.x, y: e.clientY - view.y });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragNode) {
        const w = screenToWorld(e.clientX, e.clientY);
        updateNodeMeta(dragNode.id, { x: w.x - dragNode.offsetX, y: w.y - dragNode.offsetY });
      } else if (panning) {
        onViewChange({ ...view, x: e.clientX - panning.x, y: e.clientY - panning.y });
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
  }, [dragNode, panning, draftEdge, screenToWorld, updateNodeMeta, view, onViewChange]);

  // ---- 缩放 ----
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const ns = Math.max(0.3, Math.min(2.5, view.scale * factor));
    const wx = (cx - view.x) / view.scale;
    const wy = (cy - view.y) / view.scale;
    onViewChange({ x: cx - wx * ns, y: cy - wy * ns, scale: ns });
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
    onSelectNode(null);
  }, [selectedId, graph, onChange, onSelectNode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        deleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, selectedId]);

  // 自动记忆新创建的工作流 id
  useEffect(() => {
    if (workflowId) localStorage.setItem('awe:last_id', workflowId);
  }, [workflowId]);

  // ---- 渲染辅助 ----
  const NODE_W = 340;
  const FALLBACK_NODE_H = 120;
  const PORT_R = 5;
  const PORT_ROW_H = 20;
  const PORT_AREA_TOP_PAD = 8;
  const PORT_AREA_BOTTOM_PAD = 8;
  const PORT_GAP_BETWEEN = 4;
  const HEADER_H = 49;

  const portAreaStartY = HEADER_H + PORT_AREA_TOP_PAD;
  const portDotY = (nodeY: number, i: number) => nodeY + portAreaStartY + i * (PORT_ROW_H + PORT_GAP_BETWEEN) + PORT_ROW_H / 2;

  // 节点实测高度缓存
  const [nodeHeights, setNodeHeights] = useState<Record<string, number>>({});
  const measureNode = useCallback((id: string, h: number) => {
    setNodeHeights((prev) => {
      if (prev[id] === h) return prev;
      return { ...prev, [id]: h };
    });
  }, []);

  useEffect(() => {
    setNodeHeights({});
  }, [workflowId]);

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
      name: def!.inputs ? def!.outputs[i].name : '',
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

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <svg
        ref={svgRef}
        className="awe-canvas select-none"
        onMouseDown={onCanvasMouseDown}
        onWheel={onWheel}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
          {/* 已有连线（slate-400） */}
          {graph.edges.map((e) => (
            <path
              key={e.id || `${e.source}-${e.target}`}
              d={edgePath(e)}
              className="connection-path"
            />
          ))}
          {/* 正在拖拽的连线（虚线） */}
          {draftEdge && (
            <path
              d={`M ${(portPositions(draftEdge.fromNode).outs[0]?.x ?? 0)} ${(portPositions(draftEdge.fromNode).outs[0]?.y ?? 0)} L ${draftEdge.x} ${draftEdge.y}`}
              className="connection-path-dim"
            />
          )}

          {/* 节点 */}
          {graph.nodes.map((n) => {
            const def = nodeDefs[n.type];
            if (!def) return null;
            const pos = getNodePos(n.id);
            const totalPorts = def.inputs.length + def.outputs.length;
            const measured = nodeHeights[n.id];
            const h = measured && measured > 0
              ? measured
              : Math.max(FALLBACK_NODE_H, HEADER_H + PORT_AREA_TOP_PAD + PORT_AREA_BOTTOM_PAD + totalPorts * (PORT_ROW_H + PORT_GAP_BETWEEN));
            return (
              <g key={n.id} transform={`translate(${pos.x},${pos.y})`} data-node-pos={n.id}>
                <foreignObject width={NODE_W} height={h}>
                  {/* v0.3.5 修复：去掉外层 div 的 shadow-md（方角阴影透过圆角漏出导致 4 角黑点）
                      选中态视觉完全交给 NodeRender 内部 .node-card.is-selected 处理 */}
                  <div
                    onMouseDown={(e) => onNodeMouseDown(e, n.id)}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(n.id); onSelectNode(n.id); }}
                    style={{ width: '100%' }}
                    data-node-height={h}
                  >
                    <NodeRender
                      node={n}
                      def={def}
                      selected={selectedId === n.id}
                      onPointerDown={() => {}}
                      onStartEdge={(e) => startEdge(e, n.id)}
                      onCompleteEdge={(e) => completeEdge(e, n.id)}
                      onMeasured={(m) => measureNode(n.id, m)}
                    />
                  </div>
                </foreignObject>
                {/* 端口小圆点（左侧输入 / 右侧输出） */}
                {def.inputs.map((_, i) => {
                  const py = portDotY(0, i);
                  return (
                    <circle
                      key={`in-${i}`}
                      cx={0} cy={py} r={PORT_R}
                      fill="#ffffff" stroke="#475569" strokeWidth={1.5}
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => completeEdge(e, n.id)}
                    />
                  );
                })}
                {def.outputs.map((_, i) => {
                  const py = portDotY(0, i);
                  return (
                    <circle
                      key={`out-${i}`}
                      cx={NODE_W} cy={py} r={PORT_R}
                      fill="#ffffff" stroke="#475569" strokeWidth={1.5}
                      style={{ cursor: 'crosshair' }}
                      onMouseDown={(e) => startEdge(e, n.id)}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
