/**
 * 单个节点的渲染（带端口）
 * - 通过 onMeasured 回调把真实内容高度透出给父组件
 * - 父组件用 ResizeObserver + onMeasured 联动，准确设置 foreignObject.height
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Brain, Database, Globe, UserCheck, Webhook, Flag, GitBranch, Braces, Wand2, Table2, PlugZap, Code2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CanvasNode, NodeDefinition } from '@/lib/types';

const ICONS: Record<string, any> = {
  Brain, Database, Globe, UserCheck, Webhook, Flag, GitBranch, Braces, Wand2, Table2, PlugZap, Code2,
};

const COLOR_BAR: Record<string, string> = {
  emerald: 'bg-emerald-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-500',
};

export interface NodeRenderHandle {
  measure: () => void;
}

interface Props {
  node: CanvasNode;
  def: NodeDefinition;
  onStartEdge: (e: React.MouseEvent) => void;
  onCompleteEdge: (e: React.MouseEvent) => void;
  onMeasured?: (h: number) => void;
}

export const NodeRender = forwardRef<NodeRenderHandle, Props>(function NodeRender({
  node,
  def,
  onStartEdge,
  onCompleteEdge,
  onMeasured,
}, ref) {
  const Icon = ICONS[def.icon] || Code2;
  const bar = COLOR_BAR[def.color] || COLOR_BAR.slate;
  const innerRef = useRef<HTMLDivElement | null>(null);

  const measure = () => {
    if (innerRef.current && onMeasured) {
      const h = innerRef.current.getBoundingClientRect().height;
      if (h > 0) onMeasured(Math.ceil(h));
    }
  };

  useImperativeHandle(ref, () => ({ measure }), []);

  useEffect(() => {
    if (!innerRef.current || !onMeasured) return;
    // 首次 measure + ResizeObserver
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(innerRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node.id, def.inputs.length, def.outputs.length]);

  return (
    <div ref={innerRef} data-node-id={node.id} data-testid="node-render" className="rounded-xl bg-white">
      <div className={cn('h-1 w-full rounded-t-xl', bar)} />
      <div className="px-3 py-2.5 flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-slate-600" />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-slate-800 truncate">{def.name}</div>
          <div className="text-[10.5px] text-slate-500 truncate">{node.id}</div>
        </div>
      </div>
      <div className="px-2 pb-2 space-y-1">
        {def.inputs.map((p, i) => (
          <div key={`in-${i}`} className="relative flex items-center text-[11px] text-slate-600 h-5 group">
            <span
              onMouseDown={onCompleteEdge}
              onMouseUp={onCompleteEdge}
              className="absolute -left-1.5 w-3 h-3 rounded-full bg-slate-300 hover:bg-brand-500 cursor-crosshair border-2 border-white"
              title={`输入：${p.name}`}
            />
            <span className="pl-3 truncate">{p.name}</span>
            <span className="ml-auto text-[10px] text-slate-400 pr-1">{p.type}</span>
          </div>
        ))}
        {def.outputs.map((p, i) => (
          <div key={`out-${i}`} className="relative flex items-center text-[11px] text-slate-600 h-5 group">
            <span
              onMouseDown={onStartEdge}
              className="absolute -right-1.5 w-3 h-3 rounded-full bg-slate-300 hover:bg-brand-500 cursor-crosshair border-2 border-white"
              title={`输出：${p.name}`}
            />
            <span className="pl-1 truncate">{p.name}</span>
            <span className="ml-auto text-[10px] text-slate-400 pr-3">{p.type}</span>
          </div>
        ))}
      </div>
      {/* 配置预览：让用户不打开 Drawer 也能看到关键字段（避免"啥也看不到"） */}
      {(node.config && Object.keys(node.config).length > 0) && (
        <div className="px-3 pb-2.5 pt-1 border-t border-slate-100 space-y-1">
          {Object.entries(node.config).slice(0, 4).map(([k, v]) => {
            const sv = typeof v === 'string' ? v : JSON.stringify(v);
            const display = sv.length > 80 ? sv.slice(0, 80) + '…' : sv;
            return (
              <div key={k} className="text-[10.5px] text-slate-500 leading-snug">
                <span className="text-slate-400">{k}:</span> <span className="font-mono text-slate-600 break-all">{display}</span>
              </div>
            );
          })}
          {Object.keys(node.config).length > 4 && (
            <div className="text-[10px] text-slate-400 italic">+{Object.keys(node.config).length - 4} more fields</div>
          )}
        </div>
      )}
    </div>
  );
});
