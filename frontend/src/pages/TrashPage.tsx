/**
 * 回收站页面（PRD §4.1）
 * - 展示所有已软删除的工作流
 * - 支持一键还原 / 彻底删除
 * - 3 秒自动刷新
 */
import { useCallback, useEffect, useState } from 'react';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import type { Workflow } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';

export function TrashPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    wf: Workflow;
    action: 'restore' | 'permanent';
  } | null>(null);

  const fetchTrash = useCallback(() => {
    setLoading(true);
    api
      .listTrashWorkflows()
      .then((d) => {
        setWorkflows(d.workflows);
        setError(null);
      })
      .catch((e) => setError(`加载失败: ${e.message}`))
      .finally(() => setLoading(false));
  }, []);

  // 首次加载 + 3s 轮询
  useEffect(() => {
    fetchTrash();
    const interval = setInterval(fetchTrash, 3000);
    return () => clearInterval(interval);
  }, [fetchTrash]);

  const handleRestore = async (wf: Workflow) => {
    try {
      await api.restoreWorkflow(wf.id);
      await fetchTrash();
    } catch (e) {
      alert(`还原失败: ${(e as Error).message}`);
    }
  };

  const handlePermanentDelete = async (wf: Workflow) => {
    try {
      await api.permanentDeleteWorkflow(wf.id);
      await fetchTrash();
    } catch (e) {
      alert(`删除失败: ${(e as Error).message}`);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleString('zh-CN');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      {/* 顶栏 */}
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          gap: 12,
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#020617', lineHeight: 1.2 }}>
            回收站
          </h1>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            已删除的工作流，可还原或彻底清除
          </p>
        </div>
        <span
          style={{
            fontSize: 12,
            color: '#94a3b8',
            padding: '2px 8px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 4,
          }}
        >
          {workflows.length} 个
        </span>
      </header>

      {/* 内容区 */}
      <main className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          {loading && workflows.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>
              加载中...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '12px 16px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                color: '#dc2626',
                fontSize: 13,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          {!loading && workflows.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Trash2 size={40} style={{ color: '#cbd5e1', marginBottom: 12 }} />
              <div style={{ fontSize: 14, color: '#64748b' }}>回收站为空</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                删除的工作流会出现在这里
              </div>
            </div>
          )}

          {workflows.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ ...thStyle, textAlign: 'left', width: '40%' }}>名称</th>
                  <th style={{ ...thStyle, width: '20%' }}>删除时间</th>
                  <th style={{ ...thStyle, width: '10%' }}>运行次数</th>
                  <th style={{ ...thStyle, width: '30%', textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {workflows.map((wf) => (
                  <tr
                    key={wf.id}
                    style={{ borderBottom: '1px solid #f1f5f9' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <td style={{ ...tdStyle, fontWeight: 500, color: '#020617' }}>
                      {wf.name}
                      {wf.description && (
                        <span style={{ display: 'block', fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>
                          {wf.description}
                        </span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: '#64748b', fontSize: 12 }}>
                      {formatTime(wf.updated_at)}
                    </td>
                    <td style={{ ...tdStyle, color: '#64748b', fontSize: 12, textAlign: 'center' }}>
                      {wf.run_count ?? 0}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleRestore(wf)}
                          title="还原"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            height: 28,
                            borderRadius: 6,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: '#16a34a',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = '#16a34a';
                            (e.currentTarget as HTMLElement).style.background = '#f0fdf4';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                            (e.currentTarget as HTMLElement).style.background = '#ffffff';
                          }}
                        >
                          <RotateCcw size={12} />
                          还原
                        </button>
                        <button
                          onClick={() => setConfirmAction({ wf, action: 'permanent' })}
                          title="彻底删除"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 10px',
                            height: 28,
                            borderRadius: 6,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: '#dc2626',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'border-color 0.15s, background 0.15s',
                          }}
                          onMouseEnter={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = '#dc2626';
                            (e.currentTarget as HTMLElement).style.background = '#fef2f2';
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                            (e.currentTarget as HTMLElement).style.background = '#ffffff';
                          }}
                        >
                          <Trash2 size={12} />
                          彻底删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* 确认对话框 */}
      {confirmAction && (
        <ConfirmDialog
          open={true}
          title={
            <span>
              <AlertTriangle size={16} style={{ color: '#dc2626', verticalAlign: 'middle', marginRight: 6 }} />
              确认彻底删除
            </span>
          }
          message={
            <span>
              此操作将<strong style={{ color: '#dc2626' }}>永久删除</strong> "
              <strong>{confirmAction.wf.name}</strong>
              " 及其所有运行记录。<br />
              此操作不可恢复。
            </span>
          }
          confirmText="彻底删除"
          danger
          onConfirm={() => {
            handlePermanentDelete(confirmAction.wf);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 11,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  textAlign: 'center',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: '#475569',
};
