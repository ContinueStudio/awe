/**
 * 底部工具栏（PRD v2.31 - 2026-07-06）
 *
 * 左工具栏（6 图标 + 1 分割线）：
 *   [加号圆] [注释文档] | [指针选择] [手掌拖拽] [自动排版] [更多]
 *
 * 视觉规范（PRD §9.2 严格遵循）：
 * - 零渐变、零紫色、白底 + slate-200 细边
 * - 主文字 #020617（slate-950），次文字 #64748b（slate-500）
 * - 手工具激活态：图标 #2563EB + 背景 #DBEAFE
 * - 小按钮：白底 hover 浅灰（#f1f5f9）
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  onTestRun: () => void;
  isRunning?: boolean;
  showNodePanel: boolean;
  onToggleNodePanel: () => void;
  zoom: number;
  nodeCount: number;
  /** v0.3.10：选择模式（false=抓手平移，true=指针选择） */
  selectMode: boolean;
  onToggleSelectMode: () => void;
  onShowLogs: () => void;
  /** v0.3.11：框选运行 */
  selectedNodeIds: Set<string>;
  onRunSelected: () => void;
  /** v0.3.9：RPA 录制 */
  onRecord?: () => void;
  isRecording?: boolean;
}

/* ---- 工具栏容器 ---- */
const TOOLBAR_BASE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
  display: 'flex',
  alignItems: 'center',
  padding: '0 6px',
  gap: 4,
  pointerEvents: 'auto',
};

const SMALL_BTN: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 6,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'transparent', border: 'none',
  color: '#475569', cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
};

/* 分割线：浅灰色 #E5E7EB，垂直细线，不贴顶底 */
const DIVIDER: React.CSSProperties = {
  width: 1, height: 20, background: '#E5E7EB',
  margin: '0 2px', flexShrink: 0,
};

const BIG_BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  gap: 6, height: 36, padding: '0 16px', borderRadius: 8,
  fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
  transition: 'background 0.15s',
};

export function BottomToolbar({
  onTestRun, isRunning,
  showNodePanel, onToggleNodePanel,
  zoom, nodeCount,
  selectMode, onToggleSelectMode,
  onShowLogs,
  selectedNodeIds, onRunSelected,
}: Props) {
  const selCount = selectedNodeIds.size;

  // --- 更多菜单 ---
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const [moreRect, setMoreRect] = useState<DOMRect | null>(null);
  useEffect(() => { if (!showMore) setMoreRect(null); }, [showMore]);

  const openMore = () => {
    const r = moreRef.current?.getBoundingClientRect();
    if (r) setMoreRect(r);
    setShowMore(true);
  };

  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 16, zIndex: 25,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, pointerEvents: 'none',
    }}>
      {/* ===== 左工具栏 ===== */}
      <div style={TOOLBAR_BASE}>
        {/* 1. 圆形加号按钮 — 新建节点 */}
        <button
          onClick={onToggleNodePanel}
          title="添加节点"
          style={{
            ...SMALL_BTN,
            background: showNodePanel ? '#374151' : '#4B5563',
            color: '#FFFFFF',
            borderRadius: '50%',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = showNodePanel ? '#4B5563' : '#374151';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = showNodePanel ? '#374151' : '#4B5563';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* 2. 带加号文档 — 添加注释 */}
        <button
          title="添加注释"
          style={SMALL_BTN}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </button>

        {/* 分割线 — 左侧（创建/注释）与右侧（画布操作）的分界 */}
        <div style={DIVIDER} />

        {/* 3. 鼠标指针选择工具 */}
        <button
          onClick={onToggleSelectMode}
          title={selectMode ? '选择模式（点击空白框选，点击节点选中）' : '切换到选择模式'}
          style={{
            ...SMALL_BTN,
            background: selectMode ? '#DBEAFE' : 'transparent',
            color: selectMode ? '#2563EB' : '#374151',
            borderRadius: 6,
          }}
          onMouseEnter={(e) => {
            if (!selectMode) (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            if (!selectMode) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            <path d="M13 13l6 6" />
          </svg>
        </button>

        {/* 4. 手掌拖拽工具 — 默认激活 */}
        <button
          onClick={onToggleSelectMode}
          title={selectMode ? '切换到抓手平移模式' : '抓手模式（拖动画布平移，默认激活）'}
          style={{
            ...SMALL_BTN,
            background: !selectMode ? '#DBEAFE' : 'transparent',
            color: !selectMode ? '#2563EB' : '#374151',
            borderRadius: 6,
          }}
          onMouseEnter={(e) => {
            if (selectMode) (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            if (selectMode) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11.5V6a2 2 0 0 0-4 0v4" />
            <path d="M14 12V4a2 2 0 0 0-4 0v8" />
            <path d="M10 13V8a2 2 0 0 0-4 0v6" />
            <path d="M6 14v-3a2 2 0 0 0-4 0v7a2 2 0 0 0 2 2h9.5a2 2 0 0 0 1.8-1.1l2.5-5a1 1 0 0 0-.9-1.4h-3.5" />
          </svg>
        </button>

        {/* 5. 四宫格加号 — 自动排版 */}
        <button
          title="自动排版节点"
          style={SMALL_BTN}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="8" height="8" rx="1" />
            <rect x="13" y="3" width="8" height="8" rx="1" />
            <line x1="15" y1="7" x2="19" y2="7" />
            <line x1="17" y1="5" x2="17" y2="9" />
            <rect x="3" y="13" width="8" height="8" rx="1" />
            <rect x="13" y="13" width="8" height="8" rx="1" />
          </svg>
        </button>

        {/* 6. 三点更多 */}
        <button
          ref={moreRef}
          onClick={openMore}
          title="更多"
          style={{
            ...SMALL_BTN,
            background: showMore ? '#f1f5f9' : 'transparent',
          }}
          onMouseEnter={(e) => {
            if (!showMore) (e.currentTarget as HTMLElement).style.background = '#f1f5f9';
          }}
          onMouseLeave={(e) => {
            if (!showMore) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
            <circle cx="6" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {/* ===== 右工具栏 ===== */}
      <div style={TOOLBAR_BASE}>
        {/* 日志按钮 */}
        <button
          onClick={onShowLogs}
          title="运行日志"
          style={SMALL_BTN}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </button>

        <div style={DIVIDER} />

        {/* 框选运行 */}
        {selCount >= 2 && (
          <>
            <button
              onClick={onRunSelected}
              disabled={isRunning}
              title={`运行选中的 ${selCount} 个节点`}
              style={{
                ...BIG_BTN,
                background: isRunning ? '#334155' : '#10b981',
                color: '#ffffff', cursor: isRunning ? 'wait' : 'pointer',
                opacity: isRunning ? 0.85 : 1,
              }}
              onMouseEnter={(e) => {
                if (isRunning) return;
                (e.currentTarget as HTMLElement).style.background = '#059669';
              }}
              onMouseLeave={(e) => {
                if (isRunning) return;
                (e.currentTarget as HTMLElement).style.background = '#10b981';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
              运行选中 ({selCount})
            </button>
            <div style={DIVIDER} />
          </>
        )}

        {/* 运行 */}
        <button
          onClick={onTestRun}
          disabled={isRunning}
          title={isRunning ? '运行中…' : '运行'}
          style={{
            ...BIG_BTN,
            background: isRunning ? '#334155' : 'var(--primary, #3b82f6)',
            color: '#ffffff', opacity: isRunning ? 0.85 : 1,
            cursor: isRunning ? 'wait' : 'pointer',
            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)',
          }}
          onMouseEnter={(e) => {
            if (isRunning) return;
            (e.currentTarget as HTMLElement).style.background = 'var(--primary-hover, #2563eb)';
          }}
          onMouseLeave={(e) => {
            if (isRunning) return;
            (e.currentTarget as HTMLElement).style.background = 'var(--primary, #3b82f6)';
          }}
        >
          {isRunning ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
          )}
          {isRunning ? '运行中…' : '运行'}
        </button>
      </div>

      {/* 更多菜单弹窗 */}
      {showMore && moreRect && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowMore(false)}>
          <div
            style={{
              position: 'fixed',
              bottom: moreRect.top - 8,
              left: moreRect.left + moreRect.width / 2,
              transform: 'translate(-50%, -100%)',
              background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10,
              boxShadow: '0 6px 24px rgba(15,23,42,0.12)', padding: 6,
              minWidth: 180, zIndex: 51,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { label: '导出画布为图片', action: () => { setShowMore(false); } },
              { label: '撤销 / 重做', action: () => { setShowMore(false); } },
              { label: '全局设置', action: () => { setShowMore(false); } },
              { label: '快捷键说明', action: () => { setShowMore(false); } },
              { label: '清空画布', action: () => { setShowMore(false); } },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '7px 10px', borderRadius: 6, border: 'none',
                  background: 'transparent', color: '#374151',
                  fontSize: 13, cursor: 'pointer',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f1f5f9'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export type { Props as BottomToolbarProps };
