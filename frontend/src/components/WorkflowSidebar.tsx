/**
 * 工作流侧栏 - 列表 + 新建 + 切换 + 状态点
 * 父组件传入 items（共享 App.tsx 的 3s 刷新），避免双重 fetch。
 */
import { Plus, FileText, Trash2, Loader2 } from 'lucide-react';
import type { Workflow } from '@/lib/types';

/** 状态点颜色：succeeded=绿 / failed=红 / running=琥珀 / null=灰 */
function statusColor(s: Workflow['last_status']) {
  switch (s) {
    case 'succeeded': return 'bg-emerald-500';
    case 'failed':    return 'bg-rose-500';
    case 'running':   return 'bg-amber-500';
    default:          return 'bg-slate-300';
  }
}

export function WorkflowSidebar({
  currentId,
  items,
  onSelect,
  onCreate,
  onDelete,
}: {
  currentId: string | null;
  items: Workflow[];
  onSelect: (wf: Workflow) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="w-60 glass border-r border-slate-200/70 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200/60 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">工作流</div>
          <div className="text-[11px] text-slate-500 mt-0.5">本地保存于 SQLite · {items.length} 个</div>
        </div>
        <button onClick={onCreate} className="awe-icon-btn" title="新建">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.length === 0 && (
          <div className="text-xs text-slate-400 px-3 py-6 text-center">暂无工作流<br />点击 + 新建</div>
        )}
        {items.map((wf) => (
          <div
            key={wf.id}
            className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
              currentId === wf.id ? 'bg-brand-50 border border-brand-200' : 'hover:bg-slate-100 border border-transparent'
            }`}
            onClick={() => onSelect(wf)}
          >
            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-slate-800 truncate">{wf.name}</span>
                {wf.last_status === 'running' && <Loader2 className="w-3 h-3 text-amber-500 animate-spin shrink-0" />}
              </div>
              <div className="text-[10.5px] text-slate-400 truncate">
                {(wf.run_count ?? 0) > 0
                  ? `${wf.run_count} 次运行 · ${wf.last_status ?? '?'} · ${new Date((wf.last_started_at ?? 0) * 1000).toLocaleString()}`
                  : `未运行 · ${new Date(wf.updated_at * 1000).toLocaleString()}`}
              </div>
            </div>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${statusColor(wf.last_status)}`}
              title={wf.last_status ?? 'never'}
            />
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(`删除「${wf.name}」？`)) { onDelete(wf.id); } }}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
