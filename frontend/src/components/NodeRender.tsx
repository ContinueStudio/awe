/**
 * 单个节点的渲染（带端口）
 */
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

export function NodeRender({
  node,
  def,
  onStartEdge,
  onCompleteEdge,
}: {
  node: CanvasNode;
  def: NodeDefinition;
  onStartEdge: (e: React.MouseEvent) => void;
  onCompleteEdge: (e: React.MouseEvent) => void;
}) {
  const Icon = ICONS[def.icon] || Code2;
  const bar = COLOR_BAR[def.color] || COLOR_BAR.slate;

  return (
    <div className="rounded-xl overflow-hidden">
      <div className={cn('h-1 w-full', bar)} />
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
    </div>
  );
}
