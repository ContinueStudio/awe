/**
 * 执行历史页（PRD §9.1 占位）
 * - 全局所有工作流的执行历史
 * - 后续：可按工作流 / 状态 / 时间筛选
 */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { RunRecord } from '@/lib/types';

function fmtTime(ts: number | null | undefined) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ s }: { s: RunRecord['status'] }) {
  if (s === 'succeeded') return <span className="awe-badge awe-badge-success">成功</span>;
  if (s === 'failed')    return <span className="awe-badge awe-badge-failed">失败</span>;
  return <span className="awe-badge awe-badge-running">运行中</span>;
}

export function HistoryPage() {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 占位：尝试调 list_runs，如果后端没提供则展示空态
    (async () => {
      try {
        const r: any = await (api as any).listRuns?.();
        setRuns(r?.runs || []);
      } catch {
        setRuns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

      <main className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>加载中…</div>
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
              <div style={{ marginBottom: 6, color: '#475569', fontWeight: 500 }}>还没有执行记录</div>
              <div>在工作流列表点击 ▶ 运行，会在这里生成一条历史</div>
            </div>
          ) : (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {runs.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 120px 160px',
                    alignItems: 'center',
                    height: 48, padding: '0 16px',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: 13,
                  }}
                >
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#020617' }}>
                    {r.id.slice(0, 12)}…
                  </div>
                  <div><StatusBadge s={r.status} /></div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{fmtTime(r.started_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
