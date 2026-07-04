/**
 * 工作流侧栏 - 列表 + 新建 + 切换
 */
import { useEffect, useState } from 'react';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { Workflow } from '@/lib/types';

export function WorkflowSidebar({
  currentId,
  onSelect,
  onCreate,
  onDelete,
}: {
  currentId: string | null;
  onSelect: (wf: Workflow) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  const [items, setItems] = useState<Workflow[]>([]);

  const refresh = () => api.listWorkflows().then((d) => setItems(d.workflows as any)).catch(console.error);

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-60 glass border-r border-slate-200/70 flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200/60 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-800">工作流</div>
          <div className="text-[11px] text-slate-500 mt-0.5">本地保存于 SQLite</div>
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
              <div className="text-[13px] font-medium text-slate-800 truncate">{wf.name}</div>
              <div className="text-[10.5px] text-slate-400 truncate">{new Date(wf.updated_at * 1000).toLocaleString()}</div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm('删除该工作流？')) { onDelete(wf.id); refresh(); } }}
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
