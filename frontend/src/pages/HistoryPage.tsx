/**
 * 执行历史页（PRD §4.4 v3.0）
 *
 * - 全局所有工作流的执行历史，按时间倒序
 * - 点击单条记录 → 右侧展开详情面板：原生日志 + Traceback + Outputs + Inputs
 * - 3s 自动刷新
 */
import { useEffect, useState, useCallback } from 'react';
import {
  History, X, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { RunLog, RunRecord } from '@/lib/types';

function fmtTime(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function fmtDuration(start: number, end?: number | null) {
  if (!end) return '…';
  const ms = (end - start) * 1000;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60 * 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60 / 1000)}m${Math.floor((ms % (60 * 1000)) / 1000)}s`;
}

function StatusBadge({ s }: { s: RunRecord['status'] }) {
  if (s === 'succeeded') return <span className="awe-badge awe-badge-success">成功</span>;
  if (s === 'failed')    return <span className="awe-badge awe-badge-failed">失败</span>;
  return <span className="awe-badge awe-badge-running">运行中</span>;
}

export function HistoryPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RunRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 拉取运行列表
  const refresh = useCallback(async () => {
    try {
      const d = await api.listRuns(undefined, 100);
      setRuns(d.runs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 拉取运行详情
  const loadDetail = useCallback(async (runId: string) => {
    setDetailLoading(true);
    try {
      const d = await api.getRun(runId);
      setDetail(d);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  // 选中一条记录时加载详情
  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      setDetail(null);
    }
  }, [selectedId, loadDetail]);

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      <header
        style={{
          height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
          borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#020617', lineHeight: 1.2 }}>执行历史</h1>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            最近 <span style={{ color: '#020617', fontWeight: 500 }}>{runs.length}</span> 条运行记录
          </p>
        </div>
      </header>

      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex' }}>
        {/* 列表 */}
        <div style={{
          flex: 1, minWidth: 0, padding: 24,
          borderRight: selectedId ? '1px solid #e2e8f0' : 'none',
        }}>
          <div style={{ maxWidth: selectedId ? '100%' : 1100, margin: selectedId ? '0' : '0 auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>
                加载中…
              </div>
            ) : runs.length === 0 ? (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px dashed #e2e8f0',
                  borderRadius: 8,
                  padding: '60px 0',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: 13,
                }}
              >
                <History className="w-5 h-5 mx-auto mb-2 text-slate-300" />
                <div style={{ marginBottom: 6, color: '#475569', fontWeight: 500 }}>
                  还没有执行记录
                </div>
                <div>在工作流列表点击 运行，会在这里生成一条历史</div>
              </div>
            ) : (
              <div style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                overflow: 'hidden',
              }}>
                {/* 表头 */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: selectedId
                    ? 'minmax(180px, 1fr) 80px 160px'
                    : 'minmax(280px, 1fr) 120px 180px 140px',
                  alignItems: 'center', height: 36, padding: '0 16px',
                  background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
                  fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase',
                }}>
                  <div>Run ID</div>
                  <div>状态</div>
                  <div>开始时间</div>
                  {!selectedId && <div>耗时</div>}
                </div>

                {runs.map((r) => {
                  const isSel = r.id === selectedId;
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleSelect(r.id)}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: selectedId
                          ? 'minmax(180px, 1fr) 80px 160px'
                          : 'minmax(280px, 1fr) 120px 180px 140px',
                        alignItems: 'center', height: 44, padding: '0 16px',
                        borderBottom: '1px solid #f1f5f9', fontSize: 13,
                        cursor: 'pointer',
                        background: isSel ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSel) (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#020617',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {r.id.slice(0, 12)}…
                      </div>
                      <div><StatusBadge s={r.status} /></div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{fmtTime(r.started_at)}</div>
                      {!selectedId && (
                        <div style={{
                          fontSize: 11, color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {fmtDuration(r.started_at, r.finished_at)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 详情右侧面板 */}
        {selectedId && (
          <aside
            className="thin-scroll"
            style={{
              width: 440, flexShrink: 0, background: '#f8fafc',
              overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column',
            }}
          >
            {/* 关闭按钮 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#020617' }}>运行详情</div>
              <button
                onClick={() => setSelectedId(null)}
                style={{
                  width: 28, height: 28, borderRadius: 6, border: 'none',
                  background: 'transparent', color: '#64748b', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>

            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
                <Loader2 className="w-4 h-4 mx-auto animate-spin" />
              </div>
            ) : detail ? (
              <>
                {/* 状态 + 时间 */}
                <div style={{
                  padding: 12, background: '#ffffff', borderRadius: 8,
                  border: '1px solid #e2e8f0', marginBottom: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#64748b' }}>状态</span>
                    <StatusBadge s={detail.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', rowGap: 4, fontSize: 11 }}>
                    <span style={{ color: '#94a3b8' }}>启动</span>
                    <span style={{ color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmtTime(detail.started_at)}
                    </span>
                    <span style={{ color: '#94a3b8' }}>耗时</span>
                    <span style={{ color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                      {fmtDuration(detail.started_at, detail.finished_at)}
                    </span>
                  </div>
                </div>

                {/* 运行日志（原生文本，含 Traceback） */}
                {detail.state?.logs && detail.state.logs.length > 0 && (
                  <DetailSection title={`Logs (${detail.state.logs.length})`} defaultOpen>
                    <div style={{
                      background: '#1e293b', color: '#e2e8f0', borderRadius: 6,
                      padding: 10, fontSize: 11, fontFamily: "'JetBrains Mono','SF Mono',monospace",
                      lineHeight: 1.6, maxHeight: 360, overflowY: 'auto',
                    }}>
                      {detail.state.logs.map((log: RunLog, i: number) => (
                        <LogLine key={i} log={log} />
                      ))}
                    </div>
                  </DetailSection>
                )}

                {/* Outputs */}
                {detail.state?.outputs && Object.keys(detail.state.outputs).length > 0 && (
                  <DetailSection title="Outputs" defaultOpen>
                    <pre style={{
                      background: '#1e293b', color: '#94e2b6', borderRadius: 6,
                      padding: 10, fontSize: 11, fontFamily: "'JetBrains Mono','SF Mono',monospace",
                      lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      maxHeight: 300, overflowY: 'auto', margin: 0,
                    }}>
                      {JSON.stringify(detail.state.outputs, null, 2)}
                    </pre>
                  </DetailSection>
                )}

                {/* Inputs */}
                {detail.inputs && Object.keys(detail.inputs).length > 0 && (
                  <DetailSection title="Inputs">
                    <pre style={{
                      background: '#1e293b', color: '#cbd5e1', borderRadius: 6,
                      padding: 10, fontSize: 11, fontFamily: "'JetBrains Mono','SF Mono',monospace",
                      lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      maxHeight: 200, overflowY: 'auto', margin: 0,
                    }}>
                      {JSON.stringify(detail.inputs, null, 2)}
                    </pre>
                  </DetailSection>
                )}

                {/* Error + Traceback */}
                {detail.error && (
                  <div style={{
                    marginTop: 12, padding: 12,
                    background: '#fef2f2', border: '1px solid #fecaca',
                    borderRadius: 8,
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: '#dc2626', marginBottom: 6,
                    }}>
                      Error / Traceback
                    </div>
                    <pre style={{
                      fontSize: 11, fontFamily: "'JetBrains Mono','SF Mono',monospace",
                      color: '#991b1b', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      lineHeight: 1.5, margin: 0, maxHeight: 400, overflowY: 'auto',
                    }}>
                      {detail.error}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
                加载详情失败
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

/* ---------- 内部组件 ---------- */

function DetailSection({
  title, children, defaultOpen,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 0', border: 'none', background: 'transparent', cursor: 'pointer',
          fontSize: 12, fontWeight: 600, color: '#475569',
        }}
      >
        {title}
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {open && children}
    </div>
  );
}

function LogLine({ log }: { log: RunLog }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '2px 0' }}>
      {/* 状态点 */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%', marginTop: 4, flexShrink: 0,
        background: log.ok ? '#22c55e' : '#ef4444',
      }} />

      {/* 时间戳 */}
      <span style={{ color: '#64748b', flexShrink: 0, marginRight: 2 }}>
        {new Date(log.ts * 1000).toLocaleTimeString('zh-CN')}
      </span>

      {/* 节点 */}
      <span style={{ color: '#7dd3fc', flexShrink: 0, minWidth: 90 }}>
        {log.node || '—'}
      </span>

      {/* 类型 */}
      <span style={{ color: '#94a3b8', flexShrink: 0, marginRight: 4 }}>
        {log.type}
      </span>

      {/* 描述 */}
      {log.desc && (
        <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {log.desc}
        </span>
      )}

      {/* trace */}
      {log.trace && (
        <span style={{ color: '#fca5a5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {log.trace}
        </span>
      )}

      {/* 耗时 */}
      {log.ms != null && (
        <span style={{ color: '#64748b', flexShrink: 0, marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace" }}>
          {log.ms}ms
        </span>
      )}
    </div>
  );
}
