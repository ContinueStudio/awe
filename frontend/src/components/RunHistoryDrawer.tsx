/**
 * 运行历史 - 左侧悬浮面板
 * - 通过 open/onClose 受控
 * - 列出当前工作流的所有运行（按时间倒序）
 * - 状态点 + 耗时
 * - 选中某次 run 后显示 logs + outputs + 错误
 * - 3s 自动刷新
 *
 * v0.3.10：改为左侧悬浮面板（与右侧 ConfigPanel 对应），非全高侧滑抽屉
 */
import { useEffect, useState } from 'react';
import { X, History, Loader2, CheckCircle2, XCircle, ChevronRight, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import type { RunLog, RunRecord, Workflow } from '@/lib/types';
import { cn } from '@/lib/utils';

function statusBadge(s: RunRecord['status']) {
  if (s === 'succeeded') return { color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2, label: 'succeeded' };
  if (s === 'failed')    return { color: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle, label: 'failed' };
  return { color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Loader2, label: 'running' };
}

function fmt(ts: number) {
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function fmtDuration(start: number, end?: number | null) {
  if (!end) return '…';
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.floor((ms % 60_000) / 1000)}s`;
}

export function RunHistoryDrawer({
  current,
  open,
  onClose,
  isRunning,
}: {
  current: Workflow | null;
  open: boolean;
  onClose: () => void;
  isRunning: boolean;
}) {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunRecord | null>(null);
  const [showOutputs, setShowOutputs] = useState(true);
  const [showLogs, setShowLogs] = useState(true);
  const [showInputs, setShowInputs] = useState(false);

  // 切换工作流时重置选中
  useEffect(() => { setSelected(null); setDetail(null); }, [current?.id]);

  // 拉取当前工作流的运行列表
  const refresh = async () => {
    if (!current?.id) { setRuns([]); return; }
    try {
      const d = await api.listRuns(current.id, 50);
      setRuns(d.runs);
      const last = d.runs.find((r) => r.status !== 'running') ?? d.runs[0];
      const id = selected ?? last?.id ?? null;
      if (id && id !== selected) setSelected(id);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [current?.id]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [current?.id, selected, open]);

  // 拉取详情
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    api.getRun(selected).then(setDetail).catch(console.error);
  }, [selected]);

  return (
    <aside
      className={cn(
        "fixed left-4 z-40 flex flex-col bg-white border border-slate-200 rounded-lg",
        "shadow-[0_8px_32px_rgba(15,23,42,0.15)] transition-all duration-200",
        !open && "opacity-0 pointer-events-none scale-95",
      )}
      style={{
        top: 60,
        width: 380,
        height: 'calc(100vh - 76px)',
        maxHeight: 800,
        fontSize: 13,
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <History className="w-4 h-4 text-slate-500 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800">运行历史</div>
            <div className="text-[11px] text-slate-500 mt-0.5 truncate">
              {current ? current.name : '请先选择工作流'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {!current && (
            <div className="text-xs text-slate-400 px-4 py-8 text-center">
              <Sparkles className="w-5 h-5 mx-auto mb-2 text-slate-300" />
              请先选择工作流
            </div>
          )}
          {current && runs.length === 0 && (
            <div className="text-xs text-slate-400 px-4 py-8 text-center">
              还没有运行过<br />点击「运行」开始
            </div>
          )}
          {current && runs.length > 0 && (
            <ul className="p-2 space-y-1">
              {runs.map((r) => {
                const badge = statusBadge(r.status);
                const Icon = badge.icon;
                const isSel = r.id === selected;
                return (
                  <li
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={cn(
                      "flex items-start gap-2 px-2.5 py-2 rounded-lg cursor-pointer border transition-colors",
                      isSel ? "bg-brand-50 border-brand-200" : "hover:bg-slate-100 border-transparent",
                    )}
                  >
                    <Icon className={cn(
                      "w-3.5 h-3.5 mt-0.5 shrink-0",
                      r.status === 'succeeded' && "text-emerald-500",
                      r.status === 'failed' && "text-rose-500",
                      r.status === 'running' && "text-amber-500 animate-spin",
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-mono text-slate-700 truncate">{r.id.slice(0, 8)}</span>
                        <span className={cn("text-[10px] px-1.5 py-0 rounded border", badge.color)}>{badge.label}</span>
                      </div>
                      <div className="text-[10.5px] text-slate-400 mt-0.5">
                        {fmt(r.started_at)} · {fmtDuration(r.started_at, r.finished_at)}
                      </div>
                      {r.error && <div className="text-[10.5px] text-rose-600 mt-0.5 truncate" title={r.error}>{r.error}</div>}
                    </div>
                    {isSel && <ChevronRight className="w-3.5 h-3.5 text-slate-400 mt-0.5" />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 详情 */}
        {detail && (
          <div className="border-t border-slate-200/60 max-h-[55%] overflow-y-auto bg-white/40 shrink-0">
            <Section
              title={`Logs (${detail.state?.logs?.length ?? 0})`}
              open={showLogs}
              onToggle={() => setShowLogs((v) => !v)}
            >
              {(detail.state?.logs ?? []).map((lg, i) => (
                <LogRow key={i} log={lg} />
              ))}
            </Section>
            <Section
              title="Outputs"
              open={showOutputs}
              onToggle={() => setShowOutputs((v) => !v)}
            >
              <pre className="allow-select text-[10.5px] text-slate-700 whitespace-pre-wrap break-all font-mono leading-relaxed">
                {JSON.stringify(detail.state?.outputs ?? {}, null, 2)}
              </pre>
            </Section>
            {detail.inputs && Object.keys(detail.inputs).length > 0 && (
              <Section
                title="Inputs"
                open={showInputs}
                onToggle={() => setShowInputs((v) => !v)}
              >
                <pre className="allow-select text-[10.5px] text-slate-700 whitespace-pre-wrap break-all font-mono leading-relaxed">
                  {JSON.stringify(detail.inputs, null, 2)}
                </pre>
              </Section>
            )}
            {detail.error && (
              <div className="px-3 py-2 bg-rose-50 border-t border-rose-200">
                <div className="text-[10.5px] font-semibold text-rose-700 mb-1">Error</div>
                <div className="allow-select text-[10.5px] text-rose-700 break-all">{detail.error}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200/60 last:border-b-0">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100/60">
        {title}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && <div className="px-3 py-2">{children}</div>}
    </div>
  );
}

function LogRow({ log }: { log: RunLog }) {
  return (
    <div className="flex flex-col text-[10.5px] py-0.5 allow-select">
      <div className="flex items-center gap-2">
        <span className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          log.ok ? "bg-emerald-500" : "bg-rose-500",
        )} />
        <span className="font-mono text-slate-500 shrink-0">{new Date(log.ts * 1000).toLocaleTimeString()}</span>
        <span className="font-mono text-slate-700 shrink-0">{log.node}</span>
        <span className="text-slate-500 shrink-0">{log.type}</span>
        <span className="ml-auto font-mono text-slate-400 shrink-0">{log.ms ?? 0}ms</span>
      </div>
      {log.desc && <div className="text-[10px] text-slate-400 ml-[26px] mt-0.5 italic">{log.desc}</div>}
    </div>
  );
}
