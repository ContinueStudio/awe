/**
 * 底部悬浮工具栏（参考 lawe 风格）
 * - 白底 + 圆角 12 + 柔和阴影
 * - 居中悬浮：+ 节点 / 缩放比例 / 试运行 / 节点数
 * - 注：lawe 没有 +/- 缩放按钮，仅显示百分比
 */
interface Props {
  onTestRun: () => void;
  isRunning?: boolean;
  showNodePanel: boolean;
  onToggleNodePanel: () => void;
  zoom: number;
  nodeCount: number;
}

export function BottomToolbar({
  onTestRun,
  isRunning,
  showNodePanel,
  onToggleNodePanel,
  zoom,
  nodeCount,
}: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 25,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: '#ffffff',
        border: '1px solid #E5E6EB',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        padding: '6px 10px',
      }}
    >
      {/* 添加节点 */}
      <button
        onClick={onToggleNodePanel}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          border: 'none',
          background: showNodePanel ? '#EEF0FF' : 'transparent',
          color: showNodePanel ? '#4D53E8' : '#4E5969',
          transition: 'all 0.15s',
        }}
        title="添加节点"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      <div style={{ width: 1, height: 20, background: '#E5E6EB' }} />

      {/* 缩放比例（与 lawe 一致：纯文字） */}
      <span
        style={{
          fontSize: 12,
          color: '#86909C',
          padding: '0 4px',
          minWidth: 36,
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {Math.round(zoom * 100)}%
      </span>

      <div style={{ width: 1, height: 20, background: '#E5E6EB' }} />

      {/* 试运行 */}
      <button
        onClick={onTestRun}
        disabled={isRunning}
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isRunning ? 'wait' : 'pointer',
          border: 'none',
          background: 'transparent',
          color: isRunning ? '#9CA3AF' : '#00B42A',
          opacity: isRunning ? 0.5 : 1,
        }}
        title={isRunning ? '运行中…' : '试运行'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="8 5 19 12 8 19 8 5" />
        </svg>
      </button>

      {/* 节点数量 */}
      <span style={{ fontSize: 12, color: '#86909C', marginLeft: 4, userSelect: 'none' }}>
        {nodeCount} 节点
      </span>
    </div>
  );
}
