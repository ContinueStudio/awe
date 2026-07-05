/**
 * 设置页（PRD §9.1 占位）
 * - 后端连接信息（健康状态、版本号）
 * - 后续：MCP 服务配置、模型密钥、主题切换等
 */
export function SettingsPage({ health }: { health: { ok: boolean; version: string } | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      <header
        style={{
          height: 56, display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12,
          borderBottom: '1px solid #e2e8f0', flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#020617', lineHeight: 1.2 }}>设置</h1>
          <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>系统配置与连接信息</p>
        </div>
      </header>

      <main className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 16,
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#020617', background: '#f8fafc' }}>
              后端连接
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, fontSize: 13 }}>
              <div style={{ color: '#64748b' }}>服务地址</div>
              <div style={{ color: '#020617', fontFamily: "'JetBrains Mono', monospace" }}>http://127.0.0.1:8765</div>

              <div style={{ color: '#64748b' }}>健康状态</div>
              <div>
                {health ? (
                  <span className={`status-dot ${health.ok ? 'status-dot-success' : 'status-dot-failed'}`} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                ) : null}
                {health ? (health.ok ? '在线' : '离线') : '检测中…'}
              </div>

              <div style={{ color: '#64748b' }}>后端版本</div>
              <div style={{ color: '#020617', fontFamily: "'JetBrains Mono', monospace" }}>{health?.version || '—'}</div>
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#020617', background: '#f8fafc' }}>
              前端
            </div>
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: 8, fontSize: 13 }}>
              <div style={{ color: '#64748b' }}>前端版本</div>
              <div style={{ color: '#020617', fontFamily: "'JetBrains Mono', monospace" }}>v0.3.0</div>
              <div style={{ color: '#64748b' }}>UI 规范</div>
              <div style={{ color: '#020617' }}>shadcn/ui 白底黑字（PRD v2.11+）</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
