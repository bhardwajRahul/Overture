import { Plan, PlanNode, PlanEdge, PlanState, NodeStatus, NodeConfig } from '../types.js';

class PlanStore {
  private state: PlanState = {
    plan: null,
    nodes: [],
    edges: [],
    fieldValues: {},
    selectedBranches: {},
    nodeConfigs: {},
  };

  private approvalResolver: ((value: boolean) => void) | null = null;
  private approvalPromise: Promise<boolean> | null = null;

  // Getters
  getPlan(): Plan | null {
    return this.state.plan;
  }

  getNodes(): PlanNode[] {
    return this.state.nodes;
  }

  getEdges(): PlanEdge[] {
    return this.state.edges;
  }

  getState(): PlanState {
    return this.state;
  }

  getFieldValues(): Record<string, string> {
    return this.state.fieldValues;
  }

  getSelectedBranches(): Record<string, string> {
    return this.state.selectedBranches;
  }

  getNodeConfigs(): Record<string, NodeConfig> {
    return this.state.nodeConfigs;
  }

  // Mutations
  startPlan(plan: Plan): void {
    this.state = {
      plan,
      nodes: [],
      edges: [],
      fieldValues: {},
      selectedBranches: {},
      nodeConfigs: {},
    };

    // Create a new approval promise
    this.approvalPromise = new Promise((resolve) => {
      this.approvalResolver = resolve;
    });
  }

  addNode(node: PlanNode): void {
    this.state.nodes.push(node);
  }

  addEdge(edge: PlanEdge): void {
    this.state.edges.push(edge);
  }

  updatePlanStatus(status: Plan['status']): void {
    if (this.state.plan) {
      this.state.plan.status = status;
    }
  }

  updateNodeStatus(nodeId: string, status: NodeStatus, output?: string): void {
    const node = this.state.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = status;
      if (output) {
        node.output = output;
      }
    }
  }

  setApproval(
    fieldValues: Record<string, string>,
    selectedBranches: Record<string, string>,
    nodeConfigs: Record<string, NodeConfig> = {}
  ): void {
    this.state.fieldValues = fieldValues;
    this.state.selectedBranches = selectedBranches;
    this.state.nodeConfigs = nodeConfigs;
    this.updatePlanStatus('approved');

    // Resolve the approval promise
    if (this.approvalResolver) {
      this.approvalResolver(true);
      this.approvalResolver = null;
    }
  }

  cancelApproval(): void {
    if (this.approvalResolver) {
      this.approvalResolver(false);
      this.approvalResolver = null;
    }
  }

  async waitForApproval(timeoutMs: number = 60000): Promise<'approved' | 'cancelled' | 'pending'> {
    if (!this.approvalPromise) {
      return 'cancelled';
    }

    // Race between approval and timeout
    const timeoutPromise = new Promise<'pending'>((resolve) => {
      setTimeout(() => resolve('pending'), timeoutMs);
    });

    const result = await Promise.race([
      this.approvalPromise.then((approved) => (approved ? 'approved' : 'cancelled')),
      timeoutPromise,
    ]);

    return result;
  }

  clear(): void {
    this.state = {
      plan: null,
      nodes: [],
      edges: [],
      fieldValues: {},
      selectedBranches: {},
      nodeConfigs: {},
    };
    this.approvalResolver = null;
    this.approvalPromise = null;
  }
}

// Singleton instance
export const planStore = new PlanStore();
