/**
 * 底部工具栏（PRD v2.13 - 2026-07-05）
 *
 * 用户截图描述复刻：
 * - 底部悬浮，左右两个并行的工具栏
 * - **左工具栏**：5 个小图标按钮（注释/优化/排版/导出为图片/设置）+ 1 个大图标按钮（添加节点）
 * - **右工具栏**：1 个大图标按钮（运行）
 *
 * 视觉规范（PRD §9.2 严格遵循）：
 * - 零渐变、零紫色、白底 + slate-200 细边
 * - 主文字 #020617（slate-950），次文字 #64748b（slate-500）
 * - 大按钮：黑底白字（#0f172a）+ 白字
 * - 小按钮：白底 hover 浅灰（#f1f5f9），激活 indigo 态
 */
import { useState } from 'react';
import { Radio } from 'lucide-react';

interface Props {
  onTestRun: () => void;
  isRunning?: boolean;
  showNodePanel: boolean;
  onToggleNodePanel: () => void;
  zoom: number;
  nodeCount: number;
  /** RPA 录制相关 */
  onRecord?: () => void;
  isRecording?: boolean;
  /** 从 App.tsx 透传 */
  selectMode?: boolean;
  onToggleSelectMode?: () => void;
  onShowLogs?: () => void;
  selectedNodeIds?: Set<string>;
  onRunSelected?: () => void;
}

type SmallToolId = 'comment' | 'optimize' | 'layout' | 'export' | 'settings';

/* ---- 5 个小图标按钮 ---- */
const SMALL_TOOLS: { id: SmallToolId; title: string; svg: React.ReactNode }[] = [
  {
    id: 'comment',
    title: '注释',
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    id: 'optimize',
    title: '优化',
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3l1.9 5.85h6.1l-4.95 3.6 1.9 5.85L12 14.7l-4.95 3.6 1.9-5.85L4 8.85h6.1L12 3z" />
      </svg>
    ),
  },
  {
    id: 'layout',
    title: '排版',
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    id: 'export',
    title: '导出为图片',
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ),
  },
  {
    id: 'settings',
    title: '设置',
    svg: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

/* ---- 工具栏容器（白底圆角卡） ---- */
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

/* ---- 小图标按钮 ---- */
const SMALL_BTN: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: '#475569',
  cursor: 'pointer',
  transition: 'background 0.15s, color 0.15s',
};

const DIVIDER: React.CSSProperties = {
  width: 1,
  height: 20,
  background: '#e2e8f0',
  margin: '0 2px',
  flexShrink: 0,
};

/* ---- 大图标按钮基础 ---- */
const BIG_BTN: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 36,
  padding: '0 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  border: 'none',
  transition: 'background 0.15s',
};

export function BottomToolbar({
  onTestRun,
  isRunning,
  showNodePanel,
  onToggleNodePanel,
  zoom: _zoom,
  nodeCount: _nodeCount,
  onRecord,
  isRecording,
}: Props) {
  const [activeTool, setActiveTool] = useState<SmallToolId | null>(null);
  return (
    <div
      style={{
        // v0.3.6 加固：定位改用 flex 全屏容器 + 内部 toolbar 居中
        //  - 外层 fixed inset:0 + flex bottom/center，无 transform，fixed 严格相对视口
        //  - 内部 toolbar 不带任何 transform，pointer-events: auto 接收点击
        //  - 之前用 transform: translateX(-50%) 实现居中，会让此 div 自己变成 fixed containing block
        //    在某些嵌套 transform / will-change 场景下会受父容器变换影响导致 toolbar 偏移
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 16,
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {/* ===== 左工具栏：5 小图标 + 1 大图标（添加节点） ===== */}
      <div style={{ ...TOOLBAR_BASE, paddingLeft: 6, paddingRight: 6 }}>
        {/* 5 个小图标按钮 */}
        {SMALL_TOOLS.map((t) => {
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              title={t.title}
              style={{
                ...SMALL_BTN,
                background: isActive ? 'var(--primary, #3b82f6)' : 'transparent',
                color: isActive ? '#ffffff' : '#475569',
              }}
              onClick={() => setActiveTool((cur) => (cur === t.id ? null : t.id))}
              onMouseEnter={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              {t.svg}
            </button>
          );
        })}

        <div style={DIVIDER} />

        {/* 大图标按钮：添加节点（品牌蓝底白字） */}
        <button
          onClick={onToggleNodePanel}
          title="添加节点"
          style={{
            ...BIG_BTN,
            background: showNodePanel ? 'var(--primary-hover, #2563eb)' : 'var(--primary, #3b82f6)',
            color: '#ffffff',
            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-hover, #2563eb)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = showNodePanel ? 'var(--primary-hover, #2563eb)' : 'var(--primary, #3b82f6)';
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          添加节点
        </button>
      </div>

      {/* ===== 录制按钮（PRD §4.6）===== */}
      {onRecord && (
        <button
          onClick={onRecord}
          title={isRecording ? '停止录制' : '开始录制浏览器操作'}
          style={{
            width: 40, height: 40, borderRadius: 20,
            border: isRecording ? '2px solid #ef4444' : '2px solid #e2e8f0',
            background: isRecording ? '#fef2f2' : '#ffffff',
            color: isRecording ? '#ef4444' : '#64748b',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)',
            transition: 'border-color 0.2s, background 0.2s, color 0.2s',
            pointerEvents: 'auto',
          }}
        >
          <Radio size={18} className={isRecording ? 'animate-pulse' : ''} />
        </button>
      )}

      {/* ===== 右工具栏：1 大图标（运行） ===== */}
      <div style={{ ...TOOLBAR_BASE, paddingLeft: 6, paddingRight: 6 }}>
        {/* 大图标按钮：运行（品牌蓝底白字 + 三角播放图标） */}
        <button
          onClick={onTestRun}
          disabled={isRunning}
          title={isRunning ? '运行中…' : '运行'}
          style={{
            ...BIG_BTN,
            background: isRunning ? '#334155' : 'var(--primary, #3b82f6)',
            color: '#ffffff',
            opacity: isRunning ? 0.85 : 1,
            cursor: isRunning ? 'wait' : 'pointer',
            boxShadow: '0 2px 6px rgba(59, 130, 246, 0.25)',
          }}
          onMouseEnter={(e) => {
            if (isRunning) return;
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary-hover, #2563eb)';
          }}
          onMouseLeave={(e) => {
            if (isRunning) return;
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--primary, #3b82f6)';
          }}
        >
          {isRunning ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="6 4 20 12 6 20 6 4" />
            </svg>
          )}
          {isRunning ? '运行中…' : '运行'}
        </button>
      </div>
    </div>
  );
}

/* 让 zoom / nodeCount prop 避免 unused warning（同时暴露给未来用） */
export type { Props as BottomToolbarProps };
