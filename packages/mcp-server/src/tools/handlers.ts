import { StreamingXMLParser } from '../parser/xml-parser.js';
import { planStore } from '../store/plan-store.js';
import { wsManager } from '../websocket/ws-server.js';
import { Plan, NodeStatus } from '../types.js';

let currentParser: StreamingXMLParser | null = null;

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
 * Submit a complete plan XML at once (alternative to streaming)
 */
export function handleSubmitPlan(planXml: string): { success: boolean; message: string } {
  // Reset any existing parser
  currentParser = null;

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
    return { success: true, message: 'Plan submitted successfully' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message };
  }
}

/**
 * Wait for user approval of the plan
 * Returns status: 'approved', 'cancelled', or 'pending'
 * If 'pending', the agent should call this again to continue waiting
 */
export async function handleGetApproval(): Promise<{
  status: 'approved' | 'cancelled' | 'pending';
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, { fieldValues: Record<string, string>; attachments: { path: string; name: string; type: string }[]; metaInstructions?: string }>;
  message: string;
}> {
  // Wait up to 60 seconds before returning 'pending'
  const result = await planStore.waitForApproval(60000);

  if (result === 'approved') {
    planStore.updatePlanStatus('executing');
    return {
      status: 'approved',
      fieldValues: planStore.getFieldValues(),
      selectedBranches: planStore.getSelectedBranches(),
      nodeConfigs: planStore.getNodeConfigs(),
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
 */
export function handleUpdateNodeStatus(
  nodeId: string,
  status: NodeStatus,
  output?: string
): { success: boolean; message: string } {
  const nodes = planStore.getNodes();
  const node = nodes.find((n) => n.id === nodeId);

  if (!node) {
    return { success: false, message: `Node ${nodeId} not found` };
  }

  planStore.updateNodeStatus(nodeId, status, output);
  wsManager.broadcast({ type: 'node_status_updated', nodeId, status, output });

  return { success: true, message: `Node ${nodeId} status updated to ${status}` };
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
