// Plan types matching the UI store
export type NodeStatus = 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
export type NodeType = 'task' | 'decision';
export type FieldType = 'string' | 'secret' | 'select' | 'boolean' | 'number' | 'file';

export interface DynamicField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  title: string;
  description: string;
  value?: string;
  options?: string;
  setupInstructions?: string;
}

export interface Branch {
  id: string;
  label: string;
  description: string;
  pros?: string;
  cons?: string;
}

export interface FileAttachment {
  id: string;
  path: string;
  name: string;
  type: 'image' | 'code' | 'document' | 'other';
  description: string;
}

export interface PlanNode {
  id: string;
  type: NodeType;
  status: NodeStatus;
  title: string;
  description: string;
  complexity?: 'low' | 'medium' | 'high';
  expectedOutput?: string;
  risks?: string;
  dynamicFields: DynamicField[];
  branches?: Branch[];
  selectedBranchId?: string;
  branchParent?: string;
  branchId?: string;
  output?: string;
  attachments?: FileAttachment[];
  metaInstructions?: string;
}

export interface PlanEdge {
  id: string;
  from: string;
  to: string;
}

export interface Plan {
  id: string;
  title: string;
  agent: string;
  prompt?: string;
  createdAt: string;
  status: 'streaming' | 'ready' | 'approved' | 'executing' | 'completed' | 'failed';
}

export interface NodeConfig {
  fieldValues: Record<string, string>;
  attachments: FileAttachment[];
  metaInstructions?: string;
}

export interface PlanState {
  plan: Plan | null;
  nodes: PlanNode[];
  edges: PlanEdge[];
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, NodeConfig>; // nodeId -> config
}

// WebSocket message types
export type WSMessage =
  | { type: 'connected' }
  | { type: 'plan_started'; plan: Plan }
  | { type: 'node_added'; node: PlanNode }
  | { type: 'edge_added'; edge: PlanEdge }
  | { type: 'plan_ready' }
  | { type: 'node_status_updated'; nodeId: string; status: NodeStatus; output?: string }
  | { type: 'plan_completed' }
  | { type: 'plan_failed'; error: string }
  | { type: 'error'; message: string };

export type WSClientMessage =
  | {
      type: 'approve_plan';
      fieldValues: Record<string, string>;
      selectedBranches: Record<string, string>;
      nodeConfigs: Record<string, NodeConfig>;
    }
  | { type: 'cancel_plan' };
