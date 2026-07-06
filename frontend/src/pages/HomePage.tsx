/**
 * Home 页 - 工作流详情行列表（PRD §9.1 v2.11+）
 * - 两栏布局：左 240px 导航 + 右自适应内容
 * - 详情行形式（非卡片网格）：名称 / 状态 / 更新时间 3 列
 * - 每行右侧：右键菜单（编辑/重命名/复制/导出/删除）、运行按钮、分享按钮
 * - 顶部：搜索框 + 新建按钮 + 分页器
 *
 * 视觉：shadcn 白底 + 细边 + 圆角 lg，零渐变零紫色
 */
import { useEffect, useRef, useState } from 'react';
import {
  Plus, Search, MoreVertical, Pencil, Copy, Trash2, Download, Play, Loader2, Share2, ChevronLeft, ChevronRight, FilePlus2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { RunHistoryDrawer } from '@/components/RunHistoryDrawer';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Workflow } from '@/lib/types';

type HealthInfo = { ok: boolean; version: string };

function StatusDot({ s }: { s: Workflow['last_status'] }) {
  if (s === 'succeeded') return <span className="status-dot status-dot-success" />;
  if (s === 'failed')    return <span className="status-dot status-dot-failed" />;
  if (s === 'running')   return <span className="status-dot status-dot-running" />;
  return <span className="status-dot status-dot-muted" />;
}

function StatusBadge({ s }: { s: Workflow['last_status'] }) {
  if (s === 'succeeded') return <span className="awe-badge awe-badge-success">已停止</span>;
  if (s === 'failed')    return <span className="awe-badge awe-badge-failed">错误</span>;
  if (s === 'running')   return <span className="awe-badge awe-badge-running">运行中</span>;
  return <span className="awe-badge awe-badge-muted">草稿</span>;
}

function fmtTime(ts: number | null | undefined) {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const PAGE_SIZE = 15;

export function WorkflowsPage({
  onOpen,
  onCreate,
}: {
  onOpen: (wf: Workflow) => void;
  onCreate: () => Promise<void>;
}) {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [logWf, setLogWf] = useState<Workflow | null>(null);
  const [runningIds, setRunningIds] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // v0.3.x: 页面轻量 toast（替代 alert）
  const [pageToast, setPageToast] = useState<{ message: string; type: 'info' | 'error' } | null>(null);
  useEffect(() => {
    if (!pageToast) return;
    const t = setTimeout(() => setPageToast(null), 2500);
    return () => clearTimeout(t);
  }, [pageToast]);

  // v0.3.x: 自定义确认对话框状态
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmDanger, setConfirmDanger] = useState(false);
  const confirmCallbackRef = useRef<(() => void) | null>(null);

  const showConfirm = (title: string, message: string, danger = false, onConfirm: () => void) => {
    setConfirmTitle(title);
    setConfirmMessage(message);
    setConfirmDanger(danger);
    confirmCallbackRef.current = onConfirm;
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    if (confirmCallbackRef.current) {
      const cb = confirmCallbackRef.current;
      confirmCallbackRef.current = null;
      cb();
    }
  };

  const handleConfirmCancel = () => {
    setConfirmOpen(false);
    confirmCallbackRef.current = null;
  };

  useEffect(() => {
    const refresh = () => api.listWorkflows().then((d) => setWorkflows(d.workflows as any)).catch(console.error);
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menu]);

  const handleCreate = async () => {
    setCreating(true);
    try { await onCreate(); } finally { setCreating(false); }
  };

  const deleteOne = async (id: string) => {
    showConfirm(
      '删除工作流',
      '确定删除这个工作流？此操作不可恢复。',
      true,
      async () => {
        await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
        setMenu(null);
        const d = await api.listWorkflows();
        setWorkflows(d.workflows as any);
      }
    );
  };

  // 智能删除：多选时按选择删除；右键菜单则按 menu.id 扩展为选中范围
  const smartDelete = async (primaryId: string) => {
    setMenu(null);
    // 如果当前 primaryId 已在 selectedIds 中 → 沿用 selectedIds；否则退化为单删
    if (selectedIds.has(primaryId) && selectedIds.size > 1) {
      await batchDelete();
    } else {
      await deleteOne(primaryId);
    }
  };

  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
    showConfirm(
      '批量删除工作流',
      `确定删除选中的 ${selectedIds.size} 个工作流？此操作不可恢复。`,
      true,
      async () => {
        setDeleting(true);
        try {
          await api.batchDeleteWorkflows(Array.from(selectedIds));
          setSelectedIds(new Set());
          setLastSelectedId(null);
          const d = await api.listWorkflows();
          setWorkflows(d.workflows as any);
        } catch (e) {
          console.error('batch delete failed', e);
          showConfirm('删除失败', '批量删除失败：' + (e as Error).message, false, () => {});
        } finally {
          setDeleting(false);
        }
      }
    );
  };

  // 名称点击：支持 Shift 多选 + Ctrl/Cmd 多选 + 范围选择
  const handleRowClick = (id: string, event: React.MouseEvent) => {
    const isShift = event.shiftKey;
    const isMeta = event.metaKey || event.ctrlKey;

    if (isShift && lastSelectedId) {
      // Shift+点击：范围选择 (从 lastSelectedId 到当前 id)
      const visibleIds = pageItems.map((w) => w.id);
      const startIdx = visibleIds.indexOf(lastSelectedId);
      const endIdx = visibleIds.indexOf(id);
      if (startIdx >= 0 && endIdx >= 0) {
        const [a, b] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const rangeIds = visibleIds.slice(a, b + 1);
        setSelectedIds(new Set(rangeIds));
      }
    } else if (isMeta) {
      // Ctrl/Cmd+点击：多选切换
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
      setLastSelectedId(id);
    } else {
      // 普通点击：单选（双击才进入编辑）
      setSelectedIds(new Set([id]));
      setLastSelectedId(id);
    }
  };

  // 双击行 → 打开编辑器
  const handleRowDoubleClick = (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    if (wf) onOpen(wf);
  };

  // ESC 清除选择
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
        setLastSelectedId(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        // Delete 直接触发批量删除（不阻止，否则影响工作流编辑器的 Delete 行为）
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
        batchDelete();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  const duplicateOne = async (id: string) => {
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    await api.saveWorkflow({
      name: wf.name + ' (副本)',
      description: wf.description || '',
      nodes: wf.graph?.nodes || [],
      edges: wf.graph?.edges || [],
    });
    setMenu(null);
    const d = await api.listWorkflows();
    setWorkflows(d.workflows as any);
  };

  const exportOne = (wf: Workflow) => {
    const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${wf.name}.json`;
    a.click();
    setMenu(null);
  };

  const shareOne = (wf: Workflow) => {
    const url = `${location.origin}/api/workflows/${wf.id}/share`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setPageToast({ message: '分享链接已复制到剪贴板', type: 'info' });
      });
    } else {
      showConfirm('复制分享链接', url, false, () => {});
    }
    setMenu(null);
  };

  const commitRename = async () => {
    if (!renaming) return;
    const id = renaming.id;
    const newName = renaming.name.trim() || '未命名工作流';
    setRenaming(null);
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

  const runFromHome = async (id: string) => {
    if (runningIds[id]) return;
    setRunningIds((m) => ({ ...m, [id]: true }));
    try {
      await api.runWorkflow(id, {});
      const d = await api.listWorkflows();
      setWorkflows(d.workflows as any);
    } catch (e) {
      console.error('home run failed', e);
      setPageToast({ message: '运行失败：' + (e as Error).message, type: 'error' });
    } finally {
      setRunningIds((m) => ({ ...m, [id]: false }));
    }
  };

  const currentLogWf: Workflow | null = logWf
    ? { ...logWf, graph: logWf.graph || (workflows.find((w) => w.id === logWf.id)?.graph) || { nodes: [], edges: [] } }
    : null;

  const filtered = workflows.filter((w) => w.name.toLowerCase().includes(query.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      {/* 顶部工具条（搜索 + 新建） */}
      <header
        className="glass"
        style={{
          height: 56,
          display: 'flex', alignItems: 'center',
          padding: '0 24px',
          gap: 12,
          borderBottom: '1px solid #e2e8f0',
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#020617', lineHeight: 1.2 }}>工作流列表</h1>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            共 <span style={{ color: '#020617', fontWeight: 500 }}>{workflows.length}</span> 个工作流
            {selectedIds.size > 1 && <span style={{ color: 'var(--primary, #3b82f6)', fontWeight: 500 }}> · 已选 {selectedIds.size}</span>}
            {selectedIds.size > 0 && (
              <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 10 }}>
                Shift/Ctrl+点击名称多选 · Delete 批量删除 · ESC 取消
              </span>
            )}
          </p>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              placeholder="搜索工作流…"
              className="awe-input"
              style={{ width: 240, paddingLeft: 32 }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="awe-btn-primary"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '0 12px', height: 32, borderRadius: 6,
              background: 'var(--primary, #3b82f6)', color: '#ffffff', border: 'none',
              fontSize: 13, fontWeight: 500, cursor: creating ? 'wait' : 'pointer',
              opacity: creating ? 0.5 : 1,
            }}
            title="新建工作流"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            新建工作流
          </button>
        </div>
      </header>

      {/* 列表区 */}
      <main className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {workflows.length === 0 ? (
            <EmptyState onCreate={handleCreate} creating={creating} />
          ) : (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {/* 表头 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(280px, 1fr) 120px 180px 200px',
                  alignItems: 'center',
                  height: 36,
                  padding: '0 16px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                <div>名称</div>
                <div>状态</div>
                <div>更新时间</div>
                <div style={{ textAlign: 'right' }}>操作</div>
              </div>

              {pageItems.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  没有匹配的工作流
                </div>
              ) : (
                pageItems.map((wf) => (
                  <WfRow
                    key={wf.id}
                    wf={wf}
                    selected={selectedIds.has(wf.id)}
                    onRowClick={(e) => handleRowClick(wf.id, e)}
                    onRowDoubleClick={() => handleRowDoubleClick(wf.id)}
                    onShowLogs={(e) => { e.stopPropagation(); e.preventDefault(); setLogWf(wf); }}
                    onRun={(e) => { e.stopPropagation(); e.preventDefault(); runFromHome(wf.id); }}
                    onShare={(e) => { e.stopPropagation(); e.preventDefault(); shareOne(wf); }}
                    isRunning={!!runningIds[wf.id]}
                    onMenu={(e) => { e.stopPropagation(); e.preventDefault(); setMenu({ id: wf.id, x: e.clientX, y: e.clientY }); }}
                  />
                ))
              )}
            </div>
          )}

          {/* 分页器 */}
          {workflows.length > 0 && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                第 {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} 条 / 共 {filtered.length} 条
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="awe-icon-btn"
                  style={{ opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronLeft size={14} />
                </button>
                <span style={{ fontSize: 12, color: '#475569', padding: '0 8px' }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="awe-icon-btn"
                  style={{ opacity: page === totalPages - 1 ? 0.4 : 1, cursor: page === totalPages - 1 ? 'not-allowed' : 'pointer' }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 操作菜单（fixed 浮层，跟随点击位置） */}
      {menu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed', zIndex: 50,
            top: menu.y, left: menu.x,
            background: '#ffffff',
            borderRadius: 8, border: '1px solid #e2e8f0',
            boxShadow: 'var(--shadow-float)',
            padding: '4px', width: 160,
          }}
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
          <MenuItem icon={Share2} label="复制分享链接" onClick={() => {
            const wf = workflows.find((w) => w.id === menu.id);
            if (wf) shareOne(wf);
          }} />
          <div style={{ height: 1, background: '#e2e8f0', margin: '4px 0' }} />
          <MenuItem
            icon={Trash2}
            label={selectedIds.size > 1 ? `删除选中 (${selectedIds.size})` : '删除'}
            danger
            onClick={() => smartDelete(menu.id)}
          />
        </div>
      )}

      {/* 重命名弹窗 */}
      {renaming && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.4)' }}
          onClick={() => setRenaming(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0',
              boxShadow: 'var(--shadow-panel)', width: 380, padding: 20,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#020617', marginBottom: 12 }}>重命名工作流</div>
            <input
              autoFocus
              value={renaming.name}
              onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
              className="awe-input"
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button
                onClick={() => setRenaming(null)}
                style={{ padding: '0 12px', height: 32, borderRadius: 6, background: '#ffffff', border: '1px solid #e2e8f0', color: '#475569', fontSize: 13, cursor: 'pointer' }}
              >
                取消
              </button>
              <button
                onClick={commitRename}
                style={{ padding: '0 12px', height: 32, borderRadius: 6, background: 'var(--primary, #3b82f6)', border: 'none', color: '#ffffff', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 全局日志 Drawer */}
      <RunHistoryDrawer
        current={currentLogWf}
        open={!!logWf}
        onClose={() => setLogWf(null)}
        isRunning={logWf ? !!runningIds[logWf.id] : false}
      />

      {/* 自定义确认对话框 */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        danger={confirmDanger}
        onConfirm={handleConfirm}
        onCancel={handleConfirmCancel}
      />

      {/* 页面轻量 Toast（替代 alert） */}
      {pageToast && (
        <div
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 100,
            transform: 'translateX(-50%)',
            background: pageToast.type === 'error' ? 'rgba(220, 38, 38, 0.92)' : 'rgba(15, 23, 42, 0.92)',
            color: '#ffffff',
            padding: '8px 20px',
            borderRadius: 8,
            fontSize: 13,
            zIndex: 99,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          }}
        >
          {pageToast.message}
        </div>
      )}
    </div>
  );
}

/* -------------------- 列表行 -------------------- */
function WfRow({
  wf, selected, onRowClick, onRowDoubleClick, onShowLogs, onRun, onShare, isRunning, onMenu,
}: {
  wf: Workflow;
  selected: boolean;
  onRowClick: (e: React.MouseEvent) => void;
  onRowDoubleClick: () => void;
  onShowLogs: (e: React.MouseEvent) => void;
  onRun: (e: React.MouseEvent) => void;
  onShare: (e: React.MouseEvent) => void;
  isRunning: boolean;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const lastTime = wf.last_started_at;
  return (
    <div
      onClick={onRowClick}
      onDoubleClick={onRowDoubleClick}
      onContextMenu={(e) => { e.preventDefault(); onMenu(e); }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) 120px 180px 200px',
        alignItems: 'center',
        height: 48,
        padding: '0 16px',
        borderBottom: '1px solid #f1f5f9',
        cursor: 'pointer',
        transition: 'background 0.12s',
        background: selected ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (selected) return;
        (e.currentTarget as HTMLDivElement).style.background = '#f8fafc';
      }}
      onMouseLeave={(e) => {
        if (selected) return;
        (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* 名称列：状态点 + 名称 + 节点数 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <StatusDot s={wf.last_status} />
        <span style={{ fontSize: 13, fontWeight: 500, color: '#020617', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {wf.name}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
          {wf.graph?.nodes?.length || 0} 节点
        </span>
      </div>

      {/* 状态列 */}
      <div><StatusBadge s={wf.last_status} /></div>

      {/* 更新时间列 */}
      <div style={{ fontSize: 12, color: '#64748b' }}>{fmtTime(lastTime)}</div>

      {/* 操作列：运行 / 分享 / 更多 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onShowLogs}
          className="awe-icon-btn"
          title="查看运行历史"
          style={{ width: 28, height: 28 }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: '#475569' }}>{wf.run_count ?? 0}</span>
        </button>
        <button
          onClick={onRun}
          disabled={isRunning}
          className="awe-icon-btn"
          style={{ width: 28, height: 28, color: isRunning ? '#cbd5e1' : '#16a34a', borderColor: isRunning ? '#e2e8f0' : '#e2e8f0' }}
          title="直接运行"
        >
          {isRunning ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
        </button>
        <button
          onClick={onShare}
          className="awe-icon-btn"
          style={{ width: 28, height: 28 }}
          title="复制分享链接"
        >
          <Share2 size={12} />
        </button>
        <button
          onClick={onMenu}
          className="awe-icon-btn"
          style={{ width: 28, height: 28 }}
          title="更多操作"
        >
          <MoreVertical size={12} />
        </button>
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 10px', borderRadius: 4, fontSize: 13,
        border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
        color: danger ? '#dc2626' : '#020617',
        transition: 'background 0.12s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = danger ? '#fef2f2' : '#f1f5f9';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
      }}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

function EmptyState({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '80px 0', background: '#ffffff',
        border: '1px dashed #e2e8f0', borderRadius: 8,
      }}
    >
      <div style={{
        width: 56, height: 56, borderRadius: 8,
        background: '#f8fafc', border: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 12,
      }}>
        <FilePlus2 size={22} color="#94a3b8" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#020617', marginBottom: 4 }}>还没有任何工作流</div>
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>创建一个新的工作流开始你的第一次编排</div>
      <button
        onClick={onCreate}
        disabled={creating}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '0 14px', height: 32, borderRadius: 6,
          background: 'var(--primary, #3b82f6)', color: '#ffffff', border: 'none',
          fontSize: 13, fontWeight: 500, cursor: creating ? 'wait' : 'pointer',
          opacity: creating ? 0.5 : 1,
        }}
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        新建工作流
      </button>
    </div>
  );
}
