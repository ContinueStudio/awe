/**
 * 统一后端 API 客户端
 */
import type { NodeDefinition, RunResult, Workflow, WorkflowGraph } from './types';

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
  listRuns: (workflowId?: string) =>
    http<{ runs: Array<{ id: string; workflow_id: string; status: string; started_at: number; finished_at: number | null }> }>(
      workflowId ? `/runs?workflow_id=${workflowId}` : '/runs',
    ),
};
