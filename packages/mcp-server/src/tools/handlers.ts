import { StreamingXMLParser } from '../parser/xml-parser.js';
import { planStore } from '../store/plan-store.js';
import { wsManager } from '../websocket/ws-server.js';
import { Plan, NodeStatus } from '../types.js';

let currentParser: StreamingXMLParser | null = null;

/**
 * Information about the next node to execute, including user inputs
 */
export interface NextNodeInfo {
  id: string;
  title: string;
  type: string;
  description: string;
  fieldValues: Record<string, string>;
  attachments: { path: string; name: string; type: string }[];
  metaInstructions?: string;
}

/**
 * Handle streaming plan chunks from the AI agent
 */
export function handleStreamPlanChunk(xmlChunk: string): { success: boolean; message: string } {
  // Initialize parser if needed
  if (!currentParser) {
    currentParser = new StreamingXMLParser((event) => {
      switch (event.type) {
        case 'plan':
          const plan: Plan = {
            id: event.plan.id || `plan_${Date.now()}`,
            title: event.plan.title || 'Untitled Plan',
            agent: event.plan.agent || 'unknown',
            createdAt: new Date().toISOString(),
            status: 'streaming',
          };
          planStore.startPlan(plan);
          wsManager.broadcast({ type: 'plan_started', plan });
          break;

        case 'node':
          planStore.addNode(event.node);
          wsManager.broadcast({ type: 'node_added', node: event.node });
          break;

        case 'edge':
          planStore.addEdge(event.edge);
          wsManager.broadcast({ type: 'edge_added', edge: event.edge });
          break;

        case 'complete':
          planStore.updatePlanStatus('ready');
          wsManager.broadcast({ type: 'plan_ready' });
          currentParser = null;
          break;

        case 'error':
          console.error('[Overture] XML parse error:', event.error);
          wsManager.broadcast({ type: 'error', message: event.error.message });
          break;
      }
    });
  }

  try {
    currentParser.write(xmlChunk);
    return { success: true, message: 'Chunk processed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

/**
 * Submit a complete plan XML at once
 */
export function handleSubmitPlan(planXml: string): { success: boolean; message: string } {
  // Reset any existing parser for a fresh plan
  currentParser = null;

  console.error('[Overture] submit_plan called, XML length:', planXml.length);
  console.error('[Overture] Connected clients:', wsManager.getClientCount());

  const parser = new StreamingXMLParser((event) => {
    switch (event.type) {
      case 'plan':
        const plan: Plan = {
          id: event.plan.id || `plan_${Date.now()}`,
          title: event.plan.title || 'Untitled Plan',
          agent: event.plan.agent || 'unknown',
          createdAt: new Date().toISOString(),
          status: 'streaming',
        };
        console.error('[Overture] Broadcasting plan_started:', plan.title);
        planStore.startPlan(plan);
        wsManager.broadcast({ type: 'plan_started', plan });
        break;

      case 'node':
        console.error('[Overture] Broadcasting node_added:', event.node.id);
        planStore.addNode(event.node);
        wsManager.broadcast({ type: 'node_added', node: event.node });
        break;

      case 'edge':
        console.error('[Overture] Broadcasting edge_added:', event.edge.id);
        planStore.addEdge(event.edge);
        wsManager.broadcast({ type: 'edge_added', edge: event.edge });
        break;

      case 'complete':
        console.error('[Overture] Broadcasting plan_ready');
        planStore.updatePlanStatus('ready');
        wsManager.broadcast({ type: 'plan_ready' });
        break;

      case 'error':
        console.error('[Overture] XML parse error:', event.error);
        wsManager.broadcast({ type: 'error', message: event.error.message });
        break;
    }
  });

  try {
    parser.write(planXml);
    parser.close();
    console.error('[Overture] Plan parsing complete. Nodes:', planStore.getNodes().length, 'Edges:', planStore.getEdges().length);
    return { success: true, message: 'Plan submitted successfully' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Overture] Plan parsing failed:', message);
    return { success: false, message };
  }
}

/**
 * Wait for user approval of the plan
 * Returns status: 'approved', 'cancelled', or 'pending'
 * If 'pending', the agent should call this again to continue waiting
 * When approved, includes the first node's information to start execution
 */
export async function handleGetApproval(): Promise<{
  status: 'approved' | 'cancelled' | 'pending';
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, { fieldValues: Record<string, string>; attachments: { path: string; name: string; type: string }[]; metaInstructions?: string }>;
  firstNode?: NextNodeInfo;
  message: string;
}> {
  // Wait up to 60 seconds before returning 'pending'
  const result = await planStore.waitForApproval(60000);

  if (result === 'approved') {
    planStore.updatePlanStatus('executing');

    // Find the first node (node with no incoming edges)
    const nodes = planStore.getNodes();
    const edges = planStore.getEdges();
    const nodeConfigs = planStore.getNodeConfigs();

    const nodesWithIncomingEdges = new Set(edges.map(e => e.to));
    const firstNode = nodes.find(n => !nodesWithIncomingEdges.has(n.id));

    let firstNodeInfo: NextNodeInfo | undefined;
    if (firstNode) {
      const config = nodeConfigs[firstNode.id] || { fieldValues: {}, attachments: [] };
      firstNodeInfo = {
        id: firstNode.id,
        title: firstNode.title,
        type: firstNode.type,
        description: firstNode.description,
        fieldValues: config.fieldValues || {},
        attachments: config.attachments || [],
        metaInstructions: config.metaInstructions,
      };
    }

    return {
      status: 'approved',
      fieldValues: planStore.getFieldValues(),
      selectedBranches: planStore.getSelectedBranches(),
      nodeConfigs: planStore.getNodeConfigs(),
      firstNode: firstNodeInfo,
      message: 'Plan approved by user',
    };
  }

  if (result === 'cancelled') {
    return {
      status: 'cancelled',
      fieldValues: {},
      selectedBranches: {},
      nodeConfigs: {},
      message: 'Plan cancelled by user',
    };
  }

  // Pending - user hasn't approved yet, agent should call again
  return {
    status: 'pending',
    fieldValues: {},
    selectedBranches: {},
    nodeConfigs: {},
    message: 'Waiting for user approval. Call get_approval again to continue waiting.',
  };
}

/**
 * Update the status of a node during execution
 * When a node is completed, returns the next node's information including user inputs
 */
export function handleUpdateNodeStatus(
  nodeId: string,
  status: NodeStatus,
  output?: string
): {
  success: boolean;
  message: string;
  nextNode?: NextNodeInfo;
  isLastNode?: boolean;
} {
  const nodes = planStore.getNodes();
  const edges = planStore.getEdges();
  const node = nodes.find((n) => n.id === nodeId);

  if (!node) {
    return { success: false, message: `Node ${nodeId} not found` };
  }

  planStore.updateNodeStatus(nodeId, status, output);
  wsManager.broadcast({ type: 'node_status_updated', nodeId, status, output });

  // If status is 'completed', find and return the next node's info
  if (status === 'completed') {
    const nextNodeInfo = findNextNode(nodeId, nodes, edges);

    if (nextNodeInfo) {
      return {
        success: true,
        message: `Node ${nodeId} status updated to ${status}`,
        nextNode: nextNodeInfo
      };
    } else {
      // No next node - this was the last one
      return {
        success: true,
        message: `Node ${nodeId} status updated to ${status}. This was the last node.`,
        isLastNode: true
      };
    }
  }

  return { success: true, message: `Node ${nodeId} status updated to ${status}` };
}

/**
 * Find the next executable node based on edges and branch selections
 */
function findNextNode(
  currentNodeId: string,
  nodes: ReturnType<typeof planStore.getNodes>,
  edges: ReturnType<typeof planStore.getEdges>
): NextNodeInfo | null {
  const selectedBranches = planStore.getSelectedBranches();
  const nodeConfigs = planStore.getNodeConfigs();

  // Find edges going out from the current node
  const outgoingEdges = edges.filter(e => e.from === currentNodeId);

  if (outgoingEdges.length === 0) {
    return null;
  }

  // Find the next valid node (considering branch selections)
  for (const edge of outgoingEdges) {
    const nextNode = nodes.find(n => n.id === edge.to);

    if (!nextNode) continue;

    // Check if this node belongs to a branch that wasn't selected
    if (nextNode.branchParent && nextNode.branchId) {
      const selectedBranch = selectedBranches[nextNode.branchParent];
      if (selectedBranch && selectedBranch !== nextNode.branchId) {
        // This node's branch wasn't selected, skip it
        continue;
      }
    }

    // Found a valid next node - get its config
    const config = nodeConfigs[nextNode.id] || { fieldValues: {}, attachments: [] };

    return {
      id: nextNode.id,
      title: nextNode.title,
      type: nextNode.type,
      description: nextNode.description,
      fieldValues: config.fieldValues || {},
      attachments: config.attachments || [],
      metaInstructions: config.metaInstructions,
    };
  }

  // No valid next node found (all branches were skipped)
  // Try to find the next node after the skipped branches
  for (const edge of outgoingEdges) {
    const skippedNode = nodes.find(n => n.id === edge.to);
    if (skippedNode) {
      // Recursively find the next node after this skipped one
      const nextAfterSkipped = findNextNode(skippedNode.id, nodes, edges);
      if (nextAfterSkipped) {
        return nextAfterSkipped;
      }
    }
  }

  return null;
}

/**
 * Mark the plan as completed
 */
export function handlePlanCompleted(): { success: boolean; message: string } {
  planStore.updatePlanStatus('completed');
  wsManager.broadcast({ type: 'plan_completed' });
  return { success: true, message: 'Plan completed' };
}

/**
 * Mark the plan as failed
 */
export function handlePlanFailed(error: string): { success: boolean; message: string } {
  planStore.updatePlanStatus('failed');
  wsManager.broadcast({ type: 'plan_failed', error });
  return { success: true, message: 'Plan failed' };
}
