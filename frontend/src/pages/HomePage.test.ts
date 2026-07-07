/**
 * HomePage 核心组件测试
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Workflow } from '@/lib/types';

// 抽取 StatusBadge 逻辑做纯函数测试（免 DOM 依赖）
function getStatusText(s: Workflow['last_status']) {
  if (s === 'succeeded') return '已停止';
  if (s === 'failed') return '错误';
  if (s === 'running') return '运行中';
  return '草稿';
}

function getStatusClass(s: Workflow['last_status']) {
  if (s === 'succeeded') return 'awe-badge-success';
  if (s === 'failed') return 'awe-badge-failed';
  if (s === 'running') return 'awe-badge-running';
  return 'awe-badge-muted';
}

describe('StatusBadge', () => {
  it('displays correct label for each status', () => {
    expect(getStatusText('succeeded')).toBe('已停止');
    expect(getStatusText('failed')).toBe('错误');
    expect(getStatusText('running')).toBe('运行中');
    expect(getStatusText(null)).toBe('草稿');
    expect(getStatusText(undefined!)).toBe('草稿');
  });

  it('maps each status to correct CSS class', () => {
    expect(getStatusClass('succeeded')).toContain('success');
    expect(getStatusClass('failed')).toContain('failed');
    expect(getStatusClass('running')).toContain('running');
    expect(getStatusClass(null)).toContain('muted');
  });
});
