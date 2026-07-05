/**
 * 底部悬浮工具栏（shadcn 白底黑字 PRD v2.11+）
 * - 白底 + 细边 + rounded-lg + 极轻阴影
 * - 居中悬浮：+ 节点 / 缩放比例 / 试运行 / 节点数
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
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        boxShadow: 'var(--shadow-toolbar)',
        padding: '4px 8px',
      }}
    >
      <button
        onClick={onToggleNodePanel}
        className="awe-icon-btn"
        style={{
          background: showNodePanel ? '#f1f5f9' : 'transparent',
          borderColor: showNodePanel ? '#020617' : 'transparent',
          color: showNodePanel ? '#020617' : '#64748b',
        }}
        title="添加节点"
      >
        <svg
          width="16"
          height="16"
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

      <div style={{ width: 1, height: 16, background: '#e2e8f0' }} />

      <span
        style={{
          fontSize: 12,
          color: '#64748b',
          padding: '0 8px',
          minWidth: 40,
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {Math.round(zoom * 100)}%
      </span>

      <div style={{ width: 1, height: 16, background: '#e2e8f0' }} />

      <button
        onClick={onTestRun}
        disabled={isRunning}
        className="awe-icon-btn"
        style={{
          background: 'transparent',
          borderColor: 'transparent',
          color: isRunning ? '#cbd5e1' : '#16a34a',
          cursor: isRunning ? 'wait' : 'pointer',
          opacity: isRunning ? 0.5 : 1,
        }}
        title={isRunning ? '运行中…' : '试运行'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="8 5 19 12 8 19 8 5" />
        </svg>
      </button>

      <span style={{ fontSize: 12, color: '#64748b', marginLeft: 6, marginRight: 4, userSelect: 'none' }}>
        {nodeCount} 节点
      </span>
    </div>
  );
}
