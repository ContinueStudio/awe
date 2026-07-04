/**
 * Home 页 - 工作流卡片网格（N8N / Dify 风格）
 * - 顶栏：AWE Logo + 后端状态 + 新建工作流按钮
 * - 主体：工作流卡片网格（名称 / 描述 / 状态点 / 运行数 / 最后运行时间）
 * - 卡片菜单：编辑 / 重命名 / 复制 / 导出 / 删除
 * - 卡片底部"日志"按钮 → 右侧 Drawer 显示该工作流的运行历史（不需要进 Editor）
 */
import { useEffect, useRef, useState } from 'react';
import {
  Cpu, Github, Plus, Search, MoreVertical, Pencil, Copy, Trash2, Download, Play, Loader2, FilePlus2, FolderOpen, History,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { RunHistoryDrawer } from '@/components/RunHistoryDrawer';
import type { Workflow } from '@/lib/types';

type HealthInfo = { ok: boolean; version: string };

function StatusDot({ s }: { s: Workflow['last_status'] }) {
  if (s === 'succeeded') return <span className="w-2 h-2 rounded-full bg-emerald-500" />;
  if (s === 'failed')    return <span className="w-2 h-2 rounded-full bg-rose-500" />;
  if (s === 'running')   return <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />;
  return <span className="w-2 h-2 rounded-full bg-slate-300" />;
}

function fmtTime(ts: number) {
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleDateString();
}

export function HomePage({
  onOpen,
}: {
  onOpen: (wf: Workflow) => void;
}) {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [logWf, setLogWf] = useState<Workflow | null>(null);
  const [runningIds, setRunningIds] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  // 启动拉健康
  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false, version: 'unknown' }));
  }, []);

  // 3s 自动刷新拿到最新 run_count / last_status
  useEffect(() => {
    const refresh = () => api.listWorkflows().then((d) => setWorkflows(d.workflows as any)).catch(console.error);
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  // 关闭菜单
  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menu]);

  // ---- 操作 ----
  const createNew = async () => {
    setCreating(true);
    try {
      const res = await api.saveWorkflow({
        name: '未命名工作流',
        description: '',
        nodes: [],
        edges: [],
      });
      const d = await api.listWorkflows();
      setWorkflows(d.workflows as any);
      const wf = (d.workflows as Workflow[]).find((w) => w.id === res.id);
      if (wf) onOpen(wf);
    } finally {
      setCreating(false);
    }
  };

  const deleteOne = async (id: string) => {
    if (!confirm('确定删除这个工作流？此操作不可恢复。')) return;
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
    setMenu(null);
    const d = await api.listWorkflows();
    setWorkflows(d.workflows as any);
  };

  const duplicateOne = async (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    const res = await api.saveWorkflow({
      name: wf.name + ' (副本)',
      description: wf.description || '',
      nodes: wf.graph?.nodes || [],
      edges: wf.graph?.edges || [],
    });
    setMenu(null);
    const d = await api.listWorkflows();
    setWorkflows(d.workflows as any);
    const nw = (d.workflows as Workflow[]).find((w) => w.id === res.id);
    if (nw) onOpen(nw);
  };

  const exportOne = (wf: Workflow) => {
    const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${wf.name}.json`;
    a.click();
    setMenu(null);
  };

  const commitRename = async () => {
    if (!renaming) return;
    const id = renaming.id;
    const newName = renaming.name.trim() || '未命名工作流';
    setRenaming(null);
    // 用 saveWorkflow 覆盖（PUT）
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    await api.saveWorkflow({
      id,
      name: newName,
      description: wf.description || '',
      nodes: wf.graph?.nodes || [],
      edges: wf.graph?.edges || [],
    });
    const d = await api.listWorkflows();
    setWorkflows(d.workflows as any);
  };

  // 从主界面直接运行（不跳到 Editor）
  const runFromHome = async (id: string) => {
    if (runningIds[id]) return;
    setRunningIds((m) => ({ ...m, [id]: true }));
    try {
      await api.runWorkflow(id, {});
      // 跑完立即刷新列表拿到最新 last_status
      const d = await api.listWorkflows();
      setWorkflows(d.workflows as any);
    } catch (e) {
      console.error('home run failed', e);
      alert('运行失败：' + (e as Error).message);
    } finally {
      setRunningIds((m) => ({ ...m, [id]: false }));
    }
  };

  // 把卡片列表转成 RunHistoryDrawer 期望的 current（带 graph 字段）
  const currentLogWf: Workflow | null = logWf
    ? { ...logWf, graph: logWf.graph || (workflows.find((w) => w.id === logWf.id)?.graph) || { nodes: [], edges: [] } }
    : null;

  const filtered = workflows.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="h-full w-full flex flex-col bg-slate-50">
      {/* 顶栏 */}
      <header className="h-14 shrink-0 glass border-b border-slate-200/70 flex items-center px-6 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-sm">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800 leading-tight">AWE</div>
            <div className="text-[10px] text-slate-500 leading-tight">智能体工作流引擎</div>
          </div>
        </div>
        <span className="text-[11px] text-slate-400">v0.2.2</span>
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索工作流…"
              className="pl-8 pr-3 py-1.5 text-xs bg-white/70 border border-slate-200/80 rounded-md outline-none w-56 focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {health && (
            <span className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]",
              health.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", health.ok ? "bg-emerald-500" : "bg-rose-500")} />
              {health.ok ? `已连接 · ${health.version}` : '后端离线'}
            </span>
          )}
          <a className="text-slate-400 hover:text-slate-700 flex items-center gap-1 text-xs" href="https://github.com/" target="_blank" rel="noreferrer">
            <Github className="w-4 h-4" />
          </a>
          <button
            onClick={createNew}
            disabled={creating}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white shadow-sm transition-colors",
              "bg-gradient-to-r from-brand-500 to-violet-500 hover:from-brand-600 hover:to-violet-600",
              "disabled:opacity-50",
            )}
          >
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            新建工作流
          </button>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* 标题区 */}
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800">我的工作流</h1>
              <p className="text-sm text-slate-500 mt-1">所有已经创建的工作流都在这里 · 点击卡片进入编辑</p>
            </div>
            <div className="text-xs text-slate-500">
              共 <span className="font-semibold text-slate-700">{workflows.length}</span> 个
            </div>
          </div>

          {/* 空状态 / 卡片网格 */}
          {workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 glass rounded-2xl border border-dashed border-slate-300">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-100 to-violet-100 flex items-center justify-center mb-4">
                <FolderOpen className="w-7 h-7 text-brand-500" />
              </div>
              <div className="text-base font-semibold text-slate-700 mb-1">还没有任何工作流</div>
              <div className="text-sm text-slate-500 mb-5">创建一个新的工作流开始你的第一次编排</div>
              <button
                onClick={createNew}
                disabled={creating}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm",
                  "bg-gradient-to-r from-brand-500 to-violet-500 hover:from-brand-600 hover:to-violet-600",
                  "disabled:opacity-50",
                )}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
                新建工作流
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map((wf) => (
            <WfCard
              key={wf.id}
              wf={wf}
              onOpen={() => onOpen(wf)}
              onShowLogs={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setLogWf(wf);
              }}
              onRun={(e) => {
                e.stopPropagation();
                e.preventDefault();
                runFromHome(wf.id);
              }}
              isRunning={!!runningIds[wf.id]}
              onMenu={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setMenu({ id: wf.id, x: e.clientX, y: e.clientY });
              }}
            />
          ))}
            </div>
          )}
        </div>
      </main>

      {/* 操作菜单（fixed 浮层，跟随点击位置） */}
      {menu && (
        <div
          ref={menuRef}
          className="fixed z-50 glass rounded-lg shadow-xl border border-slate-200/80 py-1 w-40"
          style={{ top: menu.y, left: menu.x }}
        >
          <MenuItem icon={Pencil} label="重命名" onClick={() => {
            const wf = workflows.find((w) => w.id === menu.id);
            if (wf) setRenaming({ id: wf.id, name: wf.name });
            setMenu(null);
          }} />
          <MenuItem icon={Copy} label="复制" onClick={() => duplicateOne(menu.id)} />
          <MenuItem icon={Download} label="导出 JSON" onClick={() => {
            const wf = workflows.find((w) => w.id === menu.id);
            if (wf) exportOne(wf);
          }} />
          <div className="h-px bg-slate-200/60 my-1" />
          <MenuItem icon={Trash2} label="删除" danger onClick={() => deleteOne(menu.id)} />
        </div>
      )}

      {/* 重命名弹窗 */}
      {renaming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm" onClick={() => setRenaming(null)}>
          <div className="glass rounded-2xl border border-slate-200/80 shadow-2xl w-96 p-5" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-semibold text-slate-800 mb-3">重命名工作流</div>
            <input
              autoFocus
              value={renaming.name}
              onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRenaming(null)} className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md">取消</button>
              <button onClick={commitRename} className="px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-brand-500 to-violet-500 hover:from-brand-600 hover:to-violet-600 rounded-md">确定</button>
            </div>
          </div>
        </div>
      )}

      {/* 全局日志 Drawer：卡片"查看日志"按钮触发，Home 页不离开就能看运行历史 */}
      <RunHistoryDrawer
        current={currentLogWf}
        open={!!logWf}
        onClose={() => setLogWf(null)}
        onRun={() => logWf && runFromHome(logWf.id)}
        isRunning={logWf ? !!runningIds[logWf.id] : false}
      />
    </div>
  );
}

function WfCard({
  wf, onOpen, onShowLogs, onRun, isRunning, onMenu,
}: {
  wf: Workflow;
  onOpen: () => void;
  onShowLogs: (e: React.MouseEvent) => void;
  onRun: (e: React.MouseEvent) => void;
  isRunning: boolean;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const status = wf.last_status;
  const runCount = wf.run_count ?? 0;
  const lastTime = wf.last_started_at;
  const total = wf.graph?.nodes?.length || 0;
  return (
    <div
      onClick={onOpen}
      className="group glass rounded-2xl border border-slate-200/80 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer overflow-hidden"
    >
      {/* 缩略图占位（Dify 用 canvas 截图，目前先用渐变占位） */}
      <div className="h-32 bg-gradient-to-br from-slate-50 via-brand-50/30 to-violet-50/40 relative flex items-center justify-center">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)', backgroundSize: '16px 16px' }} />
        {total > 0 ? (
          <div className="relative flex items-center gap-1.5">
            <div className="w-12 h-8 rounded bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[9px] text-slate-500 font-mono">webhook</div>
            <div className="w-px h-px bg-slate-300" />
            <div className="w-14 h-10 rounded bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[9px] text-slate-500 font-mono">skill</div>
            <div className="w-px h-px bg-slate-300" />
            <div className="w-10 h-8 rounded bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[9px] text-slate-500 font-mono">end</div>
          </div>
        ) : (
          <div className="relative text-slate-400 text-xs flex flex-col items-center gap-1">
            <FilePlus2 className="w-6 h-6" />
            空工作流
          </div>
        )}
        <button
          onClick={onMenu}
          className="absolute top-2 right-2 w-7 h-7 rounded-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 hover:bg-white/80"
          title="操作"
        >
          <MoreVertical className="w-3.5 h-3.5 text-slate-600" />
        </button>
      </div>

      {/* 信息 */}
      <div className="p-3.5">
        <div className="flex items-center gap-2 mb-1">
          <StatusDot s={status} />
          <div className="text-sm font-semibold text-slate-800 truncate flex-1" title={wf.name}>{wf.name}</div>
        </div>
        <div className="text-[11px] text-slate-500 line-clamp-1 min-h-[16px]">
          {wf.description || (total > 0 ? `${total} 个节点` : '空白工作流 · 点击开始编排')}
        </div>
        <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-slate-400">
          <div className="flex items-center gap-1">
            <Play className="w-3 h-3" />
            {runCount} 次运行
          </div>
          <div>
            {lastTime ? fmtTime(lastTime) : '未运行'}
          </div>
        </div>
        {/* 操作行：日志 / 运行 */}
        <div className="mt-2.5 flex items-center gap-1.5 pt-2.5 border-t border-slate-200/60">
          <button
            onClick={onShowLogs}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            title="查看运行历史"
          >
            <History className="w-3 h-3" />
            查看日志
          </button>
          <button
            onClick={onRun}
            disabled={isRunning}
            className={cn(
              "flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors",
              "bg-gradient-to-r from-brand-500 to-violet-500 text-white hover:from-brand-600 hover:to-violet-600",
              "disabled:opacity-50",
            )}
            title="直接运行此工作流"
          >
            {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
            {isRunning ? '运行中' : '运行'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-100/80 text-left",
        danger ? "text-rose-600 hover:bg-rose-50" : "text-slate-700",
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

console.log('??SELFTEST_HOMEPAGE_MARKER??');
