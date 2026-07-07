/**
 * API 层类型结构验证（免服务端）
 */
import { describe, it, expect } from 'vitest';
import { api } from '@/lib/api';

describe('api', () => {
  it('exports core workflow CRUD methods', () => {
    expect(typeof api.listWorkflows).toBe('function');
    expect(typeof api.getWorkflow).toBe('function');
    expect(typeof api.saveWorkflow).toBe('function');
  });

  it('exports execution methods', () => {
    expect(typeof api.runWorkflow).toBe('function');
    expect(typeof api.listRuns).toBe('function');
    expect(typeof api.getRun).toBe('function');
  });

  it('exports node registry access', () => {
    expect(typeof api.listNodes).toBe('function');
  });
});
