export interface PortSpec {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'any';
  description?: string;
  required?: boolean;
}

export interface NodeDefinition {
  type: string;
  name: string;
  category: 'trigger' | 'ai' | 'knowledge' | 'external' | 'human';
  description: string;
  icon: string;
  color: string;
  inputs: PortSpec[];
  outputs: PortSpec[];
  config_schema: Record<string, unknown>;
}

export interface CanvasNode {
  id: string;
  type: string;
  config?: Record<string, unknown>;
  meta?: { title?: string; description?: string; x?: number; y?: number };
}

export interface CanvasEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface WorkflowGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  graph: WorkflowGraph;
  workspace_id?: string;
  version?: number;
  status?: 'draft' | 'published' | 'deleted';
  created_at: number;
  updated_at: number;
  run_count?: number;
  last_status?: 'running' | 'succeeded' | 'failed' | null;
  last_started_at?: number | null;
}

export interface RunRecord {
  id: string;
  workflow_id: string;
  status: 'running' | 'succeeded' | 'failed';
  started_at: number;
  finished_at?: number | null;
  error?: string;
  inputs?: Record<string, unknown>;
  state?: { outputs?: Record<string, unknown>; logs?: RunLog[] };
}

export interface RunLog {
  node: string;
  type: string;
  ok: boolean;
  ms?: number;
  error?: string;
  trace?: string;
  desc?: string;
  ts: number;
}

export interface RunResult {
  run_id: string;
  status: 'running' | 'succeeded' | 'failed';
  outputs: Record<string, Record<string, unknown>>;
  logs: RunLog[];
  error?: string;
}
