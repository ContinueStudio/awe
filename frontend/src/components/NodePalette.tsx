/**
 * 节点面板 - 列出 12 类节点，按分类分组，可拖拽到画布
 */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { NodeDefinition } from '@/lib/types';
import { Brain, Database, Globe, UserCheck, Webhook, Flag, GitBranch, Braces, Wand2, Table2, PlugZap, Code2 } from 'lucide-react';

const ICONS: Record<string, any> = {
  Brain, Database, Globe, UserCheck, Webhook, Flag, GitBranch, Braces, Wand2, Table2, PlugZap, Code2,
};

const CATEGORY_LABEL: Record<string, string> = {
  trigger: '触发 / 边界',
  ai: 'AI 与语义路由',
  knowledge: '知识 / 数据',
  external: '外部生态',
  human: '人类管理',
};

const CATEGORY_COLOR: Record<string, string> = {
  trigger: 'border-emerald-200/70 bg-emerald-50/60 text-emerald-700',
  ai: 'border-violet-200/70 bg-violet-50/60 text-violet-700',
  knowledge: 'border-amber-200/70 bg-amber-50/60 text-amber-700',
  external: 'border-sky-200/70 bg-sky-50/60 text-sky-700',
  human: 'border-rose-200/70 bg-rose-50/60 text-rose-700',
};

export function NodePalette({ onAdd }: { onAdd: (type: string) => void }) {
  const [nodes, setNodes] = useState<NodeDefinition[]>([]);

  useEffect(() => {
    api.listNodes().then((d) => setNodes(d.nodes)).catch(console.error);
  }, []);

  const groups: Record<string, NodeDefinition[]> = {};
  for (const n of nodes) {
    (groups[n.category] ||= []).push(n);
  }

  return (
    <aside className="glass w-72 border-r border-slate-200/70 flex flex-col">
      <div className="px-5 py-4 border-b border-slate-200/60">
        <div className="text-sm font-semibold text-slate-800">节点目录</div>
        <div className="text-xs text-slate-500 mt-0.5">12 大原子积木，点击添加到画布</div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <div className={cn('text-[11px] font-medium px-2 py-1 rounded-md inline-block mb-2', CATEGORY_COLOR[cat])}>
              {CATEGORY_LABEL[cat] || cat}
            </div>
            <div className="space-y-1.5">
              {items.map((n) => {
                const Icon = ICONS[n.icon] || Code2;
                return (
                  <button
                    key={n.type}
                    onClick={() => onAdd(n.type)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-slate-200/80 bg-white/60 hover:bg-white hover:border-brand-300 hover:shadow-sm transition-all text-left group"
                  >
                    <span className="w-7 h-7 rounded-md bg-slate-100 group-hover:bg-brand-50 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-slate-600 group-hover:text-brand-600" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{n.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{n.type}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
