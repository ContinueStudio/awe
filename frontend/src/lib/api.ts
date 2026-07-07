/**
 * 统一后端 API 客户端
 */
import type { NodeDefinition, RunRecord, RunResult, Workflow, WorkflowGraph } from './types';

const BASE = '/api';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`${r.status} ${text}`);
  }
  return r.json() as Promise<T>;
}

export const api = {
  health: () => http<{ ok: boolean; version: string }>('/health'),
  listNodes: () => http<{ nodes: NodeDefinition[]; prompt: string }>('/nodes'),
  listWorkflows: () => http<{ workflows: Workflow[] }>('/workflows'),
  getWorkflow: (id: string) => http<Workflow>(`/workflows/${id}`),
  saveWorkflow: (body: Partial<WorkflowGraph> & { id?: string; name: string; description?: string }) =>
    http<{ id: string }>('/workflows', {
      method: 'POST',
      body: JSON.stringify({
        id: body.id,
        name: body.name,
        description: body.description ?? '',
        graph: { nodes: body.nodes, edges: body.edges },
      }),
    }),
  validate: (body: { name: string; graph: { nodes: unknown[]; edges: unknown[] } }) =>
    http<{ ok: boolean; errors: string[] }>('/workflows/validate', {
      method: 'POST',
      body: JSON.stringify({ name: body.name, description: '', graph: body.graph }),
    }),
  runWorkflow: (id: string, inputs: Record<string, unknown> = {}) =>
    http<RunResult>(`/workflows/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    }),
  /** 单节点测试运行 */
  runSingleNode: (workflowId: string, nodeId: string, inputs: Record<string, unknown> = {}) =>
    http<RunResult>(`/workflows/${workflowId}/nodes/${nodeId}/run`, {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    }),
  /** 框选节点运行 */
  runSelectedNodes: (workflowId: string, nodeIds: string[], inputs: Record<string, unknown> = {}) =>
    http<RunResult>(`/workflows/${workflowId}/run-selected`, {
      method: 'POST',
      body: JSON.stringify({ node_ids: nodeIds, inputs }),
    }),
  listRuns: (workflowId?: string, limit = 50) =>
    http<{ runs: RunRecord[] }>(
      `/runs?workflow_id=${workflowId ?? ''}&limit=${limit}`,
    ),
  getRun: (runId: string) => http<RunRecord>(`/runs/${runId}`),
  batchDeleteWorkflows: (ids: string[]) =>
    http<{ ok: boolean; deleted: number; total: number }>('/workflows/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  /** 列出回收站中已软删除的工作流 */
  listTrashWorkflows: () => http<{ workflows: Workflow[] }>('/workflows/trash'),
  /** 从回收站还原工作流 */
  restoreWorkflow: (id: string) =>
    http<{ ok: boolean }>(`/workflows/${id}/restore`, { method: 'PUT' }),
  /** 物理删除（彻底清除）*/
  permanentDeleteWorkflow: (id: string) =>
    http<{ ok: boolean }>(`/workflows/${id}/permanent`, { method: 'DELETE' }),
};
