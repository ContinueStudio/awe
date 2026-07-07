/**
 * 撤销/重做系统（PRD §4.2）
 *
 * - 记录工作流图拓扑的每次变化（add/delete/update/move node, add/delete edge）
 * - 历史栈上限 20 步
 * - 新操作 → 清空 redo 栈
 * - 离开编辑器 / 发版后自动清空历史
 */
import { useCallback, useRef, useState } from 'react';
import type { WorkflowGraph } from '@/lib/types';

const MAX_HISTORY = 20;

export interface UndoRedoState {
  graph: WorkflowGraph;
  push: (g: WorkflowGraph) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo(initial: WorkflowGraph): UndoRedoState {
  const [graph, setGraph] = useState<WorkflowGraph>(initial);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // 用 useRef 存栈，避免每次 push 触发不必要的渲染
  const undoStack = useRef<WorkflowGraph[]>([]);
  const redoStack = useRef<WorkflowGraph[]>([]);

  /** 跳过下一帧入栈（用于 undo/redo 触发的 setGraph，避免二次入栈） */
  const skipRef = useRef(false);

  const push = useCallback((newGraph: WorkflowGraph) => {
    if (skipRef.current) {
      skipRef.current = false;
      setGraph(newGraph);
      return;
    }

    // 当前状态入历史栈
    undoStack.current.push(graph);
    if (undoStack.current.length > MAX_HISTORY) {
      undoStack.current.shift(); // 超过上限丢弃最旧
    }

    // 清空 redo 栈（新操作中断 redo 链）
    redoStack.current = [];

    setGraph(newGraph);
    setCanUndo(true);
    setCanRedo(false);
  }, [graph]);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;

    // 当前状态入 redo 栈
    redoStack.current.push(graph);

    // 从历史栈取出上一个状态
    const prev = undoStack.current.pop()!;

    skipRef.current = true;
    setGraph(prev);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, [graph]);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;

    // 当前状态入历史栈
    undoStack.current.push(graph);

    // 从 redo 栈取出下一个状态
    const next = redoStack.current.pop()!;

    skipRef.current = true;
    setGraph(next);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, [graph]);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return { graph, push, undo, redo, clear, canUndo, canRedo };
}
