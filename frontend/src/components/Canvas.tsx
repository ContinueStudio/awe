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
import { api } from '@/lib/api';
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
  /** v0.3.10: 选择模式 — true 时空闲点击进入框选，false 时空闲点击平移画布 */
  selectMode?: boolean;
  /** v0.3.11: 多选变化回调 */
  onSelectedIdsChange?: (ids: Set<string>) => void;
  /** v0.3.x: 节点复制回调 */
  onDuplicateNode?: (nodeId: string) => void;
  /** v0.3.x: 节点删除回调 */
  onDeleteNode?: (nodeId: string) => void;
  /** v0.3.x: 粘贴回调 */
  onPaste?: () => void;
  /** v0.3.x: 运行出错的节点 ID 集合 */
  errorNodeIds?: Set<string>;
}

const DEFAULT_VIEW = { x: 0, y: 0, scale: 1 };

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
  selectMode = false,
  onSelectedIdsChange,
  onDuplicateNode,
  onDeleteNode,
  onPaste,
  errorNodeIds,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // v0.3.11：多选变化通知父组件
  useEffect(() => { onSelectedIdsChange?.(selectedIds); }, [selectedIds, onSelectedIdsChange]);
  const [draftEdge, setDraftEdge] = useState<{ fromNode: string; x: number; y: number } | null>(null);
  const [dragNode, setDragNode] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [panning, setPanning] = useState<{ x: number; y: number } | null>(null);
  // 框选状态
  const [boxSelect, setBoxSelect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  // 右键菜单
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement | null>(null);

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
    if (e.shiftKey) {
      // Shift + 点击：多选切换
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
    onSelectNode(id);
    const pos = getNodePos(id);
    const w = screenToWorld(e.clientX, e.clientY);
    setDragNode({ id, offsetX: w.x - pos.x, offsetY: w.y - pos.y });
  };

  // ---- 画布平移 / 框选 / 取消连线 ----
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== svgRef.current) return;
    // 关闭右键菜单
    setCtxMenu(null);
    // 有拖拽中的连线 -> 取消
    if (draftEdge) {
      cancelDraftEdge();
      e.stopPropagation();
      return;
    }
    setSelectedIds(new Set());
    setSelectedEdgeId(null);
    onSelectNode(null);
    // 选择模式下点击空白画布 -> 框选；非选择模式 -> 平移
    if (selectMode || e.shiftKey) {
      const w = screenToWorld(e.clientX, e.clientY);
      setBoxSelect({ x1: w.x, y1: w.y, x2: w.x, y2: w.y });
      return;
    }
    setPanning({ x: e.clientX - view.x, y: e.clientY - view.y });
  };

  // ---- 画布右键菜单 ----
  const onCanvasContextMenu = (e: React.MouseEvent) => {
    if (e.target !== svgRef.current) return;
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  // 关闭右键菜单
  useEffect(() => {
    if (!ctxMenu) return;
    const onClick = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) setCtxMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [ctxMenu]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragNode) {
        const w = screenToWorld(e.clientX, e.clientY);
        updateNodeMeta(dragNode.id, { x: w.x - dragNode.offsetX, y: w.y - dragNode.offsetY });
      } else if (boxSelect) {
        const w = screenToWorld(e.clientX, e.clientY);
        setBoxSelect((bs) => bs ? { ...bs, x2: w.x, y2: w.y } : null);
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
      // 框选结束：计算哪些节点在矩形内
      if (boxSelect) {
        setBoxSelect((bs) => {
          if (!bs) return null;
          const x1 = Math.min(bs.x1, bs.x2);
          const y1 = Math.min(bs.y1, bs.y2);
          const x2 = Math.max(bs.x1, bs.x2);
          const y2 = Math.max(bs.y1, bs.y2);
          // 找出矩形内的节点
          const insideIds = graph.nodes.filter((n) => {
            const pos = getNodePos(n.id);
            const h = heightOf(n.id, (nodeDefs[n.type]?.inputs?.length || 0) + (nodeDefs[n.type]?.outputs?.length || 0));
            return pos.x + NODE_W > x1 && pos.x < x2 && pos.y + h > y1 && pos.y < y2;
          }).map((n) => n.id);
          if (insideIds.length > 0) {
            setSelectedIds(new Set(insideIds));
          }
          return null;
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragNode, boxSelect, panning, draftEdge, screenToWorld, updateNodeMeta, view, onViewChange, graph.nodes, getNodePos, nodeDefs]);

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
  // 取消拖拽连线：按 Escape 或点击空白画布
  const cancelDraftEdge = useCallback(() => {
    if (draftEdge) setDraftEdge(null);
  }, [draftEdge]);

  // ---- 选择/删除连线 ----
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const deleteEdge = useCallback((edgeId: string) => {
    onChange({ ...graph, edges: graph.edges.filter((e) => (e.id || `${e.source}-${e.target}`) !== edgeId) });
    setSelectedEdgeId(null);
  }, [graph, onChange]);

  // ---- 删除 ----
  const deleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    const idSet = new Set(selectedIds);
    onChange({
      nodes: graph.nodes.filter((n) => !idSet.has(n.id)),
      edges: graph.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
    });
    setSelectedIds(new Set());
    onSelectNode(null);
  }, [selectedIds, graph, onChange, onSelectNode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 取消正在拖拽的连线
        if (draftEdge) {
          e.preventDefault();
          cancelDraftEdge();
        }
        setSelectedEdgeId(null);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        // 优先删除选中的连线
        if (selectedEdgeId) {
          deleteEdge(selectedEdgeId);
          return;
        }
        // 再删除选中的节点
        if (selectedIds.size > 0) {
          deleteSelected();
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, selectedIds, draftEdge, cancelDraftEdge, selectedEdgeId, deleteEdge]);

  // ---- 保存 ----
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

  const heightOf = (id: string, fallbackPorts: number) => {
    const m = nodeHeights[id];
    if (m && m > 0) return m;
    return Math.max(FALLBACK_NODE_H, HEADER_H + PORT_AREA_TOP_PAD + PORT_AREA_BOTTOM_PAD + fallbackPorts * (PORT_ROW_H + PORT_GAP_BETWEEN));
  };

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
        onContextMenu={onCanvasContextMenu}
        onWheel={onWheel}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
          {/* 已有连线（slate-400） */}
          {graph.edges.map((e) => {
            const eid = e.id || `${e.source}-${e.target}`;
            const isSelected = selectedEdgeId === eid;
            return (
              <g key={eid}>
                {/* 隐形宽点击热区 */}
                <path
                  d={edgePath(e)}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={16}
                  style={{ cursor: 'pointer' }}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setSelectedEdgeId(eid);
                      setSelectedIds(new Set());
                      onSelectNode(null);
                    }}
                />
                {/* 可见连线 */}
                <path
                  d={edgePath(e)}
                  className="connection-path"
                  style={isSelected ? { stroke: 'var(--primary, #3b82f6)', strokeWidth: 2.5 } : undefined}
                />
              </g>
            );
          })}
          {/* 正在拖拽的连线（虚线） */}
          {draftEdge && (
            <path
              d={`M ${(portPositions(draftEdge.fromNode).outs[0]?.x ?? 0)} ${(portPositions(draftEdge.fromNode).outs[0]?.y ?? 0)} L ${draftEdge.x} ${draftEdge.y}`}
              className="connection-path-dim"
            />
          )}

          {/* 框选矩形 */}
          {boxSelect && (() => {
            const bx = Math.min(boxSelect.x1, boxSelect.x2);
            const by = Math.min(boxSelect.y1, boxSelect.y2);
            const bw = Math.abs(boxSelect.x2 - boxSelect.x1);
            const bh = Math.abs(boxSelect.y2 - boxSelect.y1);
            if (bw < 2 && bh < 2) return null;
            return (
              <rect
                x={bx} y={by} width={bw} height={bh}
                fill="rgba(59, 130, 246, 0.08)"
                stroke="var(--primary, #3b82f6)"
                strokeWidth={1}
                strokeDasharray="4 3"
                rx={2}
              />
            );
          })()}

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
                    onClick={(e) => { e.stopPropagation(); setSelectedIds(new Set([n.id])); setSelectedEdgeId(null); onSelectNode(n.id); }}
                    style={{ width: '100%' }}
                    data-node-height={h}
                  >
                    <NodeRender
                      node={n}
                      def={def}
                      selected={selectedIds.has(n.id)}
                      onDuplicate={() => onDuplicateNode?.(n.id)}
                      onDelete={() => onDeleteNode?.(n.id)}
                      onPointerDown={() => {}}
                      onStartEdge={(e) => startEdge(e, n.id)}
                      onCompleteEdge={(e) => completeEdge(e, n.id)}
                      onMeasured={(m) => measureNode(n.id, m)}
                      error={errorNodeIds?.has(n.id) || false}
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

      {/* 画布右键菜单 */}
      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          style={{
            position: 'fixed',
            zIndex: 50,
            top: ctxMenu.y,
            left: ctxMenu.x,
            background: '#ffffff',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            padding: '4px',
            minWidth: 140,
          }}
        >
          <button
            onClick={() => { onPaste?.(); setCtxMenu(null); }}
            style={{
              width: '100%',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', borderRadius: 4, fontSize: 13,
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: '#020617', textAlign: 'left',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 12, color: '#64748b', width: 16, textAlign: 'center' }}>📋</span>
            粘贴 Ctrl+V
          </button>
        </div>
      )}
    </div>
  );
}
