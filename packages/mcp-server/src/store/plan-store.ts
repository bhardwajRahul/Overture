import { Plan, PlanNode, PlanEdge, PlanState, NodeStatus, NodeConfig } from '../types.js';

interface RerunRequest {
  nodeId: string;
  mode: 'single' | 'to-bottom';
  timestamp: number;
}

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
  private pendingRerunRequest: RerunRequest | null = null;
  private rerunResolver: ((value: RerunRequest) => void) | null = null;
  private rerunPromise: Promise<RerunRequest> | null = null;

  private isPaused: boolean = false;
  private pauseResolver: ((value: void) => void) | null = null;
  private pausePromise: Promise<void> | null = null;

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
    this.pendingRerunRequest = null;
    this.rerunResolver = null;
    this.rerunPromise = null;
  }

  // Rerun request handling
  setRerunRequest(nodeId: string, mode: 'single' | 'to-bottom'): void {
    this.pendingRerunRequest = { nodeId, mode, timestamp: Date.now() };

    // Resolve any waiting promise
    if (this.rerunResolver) {
      this.rerunResolver(this.pendingRerunRequest);
      this.rerunResolver = null;
      this.rerunPromise = null;
    }
  }

  getPendingRerun(): RerunRequest | null {
    return this.pendingRerunRequest;
  }

  clearPendingRerun(): void {
    this.pendingRerunRequest = null;
  }

  async waitForRerun(timeoutMs: number = 60000): Promise<RerunRequest | null> {
    // If there's already a pending request, return it immediately
    if (this.pendingRerunRequest) {
      const request = this.pendingRerunRequest;
      this.pendingRerunRequest = null;
      return request;
    }

    // Create a promise to wait for a rerun request
    this.rerunPromise = new Promise((resolve) => {
      this.rerunResolver = resolve;
    });

    // Race between rerun request and timeout
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });

    const result = await Promise.race([this.rerunPromise, timeoutPromise]);

    // Clear the pending request after returning it
    if (result) {
      this.pendingRerunRequest = null;
    }

    return result;
  }

  // Reset nodes for rerun
  resetNodesForRerun(startNodeId: string, mode: 'single' | 'to-bottom'): string[] {
    const nodeIds: string[] = [];

    if (mode === 'single') {
      // Only reset the specified node
      const node = this.state.nodes.find(n => n.id === startNodeId);
      if (node) {
        node.status = 'pending';
        node.output = undefined;
        nodeIds.push(node.id);
      }
    } else {
      // Reset from this node to the bottom
      const startIndex = this.state.nodes.findIndex(n => n.id === startNodeId);
      if (startIndex !== -1) {
        for (let i = startIndex; i < this.state.nodes.length; i++) {
          const node = this.state.nodes[i];
          node.status = 'pending';
          node.output = undefined;
          nodeIds.push(node.id);
        }
      }
    }

    return nodeIds;
  }

  // Pause/Resume functionality
  pause(): void {
    this.isPaused = true;
    if (this.state.plan) {
      this.state.plan.status = 'paused';
    }
  }

  resume(): void {
    this.isPaused = false;
    if (this.state.plan) {
      this.state.plan.status = 'executing';
    }
    // Resolve any waiting pause promise
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
      this.pausePromise = null;
    }
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  async waitIfPaused(): Promise<boolean> {
    if (!this.isPaused) {
      return false; // Not paused, continue immediately
    }

    // Create a promise to wait for resume
    this.pausePromise = new Promise((resolve) => {
      this.pauseResolver = resolve;
    });

    await this.pausePromise;
    return true; // Was paused, now resumed
  }

  // Insert nodes functionality
  insertNodes(
    afterNodeId: string,
    newNodes: PlanNode[],
    newEdges: PlanEdge[]
  ): { removedEdgeIds: string[] } {
    // Find edges that go FROM the afterNode
    const edgesToRemove = this.state.edges.filter(e => e.from === afterNodeId);
    const removedEdgeIds = edgesToRemove.map(e => e.id);

    // Get the target nodes that were connected to afterNode
    const targetNodeIds = edgesToRemove.map(e => e.to);

    // Remove the old edges
    this.state.edges = this.state.edges.filter(e => e.from !== afterNodeId);

    // Add the new nodes
    this.state.nodes.push(...newNodes);

    // Add the new edges (which should connect afterNode -> new nodes)
    this.state.edges.push(...newEdges);

    // Find the last new node(s) and connect them to the original targets
    // This assumes the new edges define the internal structure,
    // and we need to connect the "exit" nodes to the original targets
    const newNodeIds = new Set(newNodes.map(n => n.id));
    const exitNodeIds = newNodes
      .filter(n => !newEdges.some(e => e.from === n.id && newNodeIds.has(e.to)))
      .map(n => n.id);

    // Connect exit nodes to original targets
    let edgeCounter = Date.now();
    for (const exitNodeId of exitNodeIds) {
      for (const targetNodeId of targetNodeIds) {
        this.state.edges.push({
          id: `e_inserted_${edgeCounter++}`,
          from: exitNodeId,
          to: targetNodeId,
        });
      }
    }

    return { removedEdgeIds };
  }

  // Remove a node and reconnect edges around it
  removeNode(nodeId: string): { newEdges: PlanEdge[]; removedEdgeIds: string[] } {
    // Find edges connected to this node
    const incomingEdges = this.state.edges.filter(e => e.to === nodeId);
    const outgoingEdges = this.state.edges.filter(e => e.from === nodeId);

    const removedEdgeIds = [
      ...incomingEdges.map(e => e.id),
      ...outgoingEdges.map(e => e.id),
    ];

    // Create new edges to bridge the gap
    const newEdges: PlanEdge[] = [];
    let edgeCounter = Date.now();
    for (const incoming of incomingEdges) {
      for (const outgoing of outgoingEdges) {
        newEdges.push({
          id: `e_bridge_${edgeCounter++}`,
          from: incoming.from,
          to: outgoing.to,
        });
      }
    }

    // Remove the node
    this.state.nodes = this.state.nodes.filter(n => n.id !== nodeId);

    // Remove old edges and add new bridging edges
    this.state.edges = [
      ...this.state.edges.filter(e => e.to !== nodeId && e.from !== nodeId),
      ...newEdges,
    ];

    return { newEdges, removedEdgeIds };
  }
}

// Singleton instance
export const planStore = new PlanStore();
