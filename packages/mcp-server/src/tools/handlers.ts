import { StreamingXMLParser } from '../parser/xml-parser.js';
import { planStore } from '../store/plan-store.js';
import { wsManager } from '../websocket/ws-server.js';
import { Plan, NodeStatus, McpServer } from '../types.js';

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
  mcpServer?: McpServer & { formattedInstructions?: string };
}

/**
 * Get provider-specific MCP configuration instructions
 */
function getProviderMcpSetupInstructions(provider: string, serverName: string): string {
  const normalizedProvider = provider.toLowerCase();

  // Server name for config (use GitHub path or simple name)
  const configServerName = serverName.includes('/')
    ? serverName
    : serverName.toLowerCase().replace(/\s+/g, '-');

  switch (normalizedProvider) {
    case 'cline':
      return `
### Cline MCP Setup Instructions

**Configuration File Locations:**
- macOS: ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json
- Windows: %APPDATA%\\Code\\User\\globalStorage\\saoudrizwan.claude-dev\\settings\\cline_mcp_settings.json
- Linux: ~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json

**Steps:**
1. Open the MCP settings file at the location above
2. Add the server configuration to the "mcpServers" object
3. Save the file

**Example Configuration:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "command": "uvx",
      "args": ["mcp-server-name"],
      "disabled": false
    }
  }
}
\`\`\`

**Important:** Read the existing file first - DO NOT overwrite other servers!
`;

    case 'sixth':
    case 'sixth-ai':
      return `
### Sixth AI MCP Setup Instructions

**Configuration File Locations:**
- macOS: ~/Library/Application Support/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json
- Windows: %APPDATA%\\Code\\User\\globalStorage\\sixth.sixth-ai\\settings\\sixth-mcp-settings.json
- Linux: ~/.config/Code/User/globalStorage/sixth.sixth-ai/settings/sixth-mcp-settings.json

**Steps:**
1. Open the MCP settings file at the location above
2. Add the server configuration to the "mcpServers" object
3. Save the file

**Example Configuration:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "command": "uvx",
      "args": ["mcp-server-name"],
      "disabled": false
    }
  }
}
\`\`\`

**Important:** Read the existing file first - DO NOT overwrite other servers!
`;

    case 'cursor':
      return `
### Cursor MCP Setup Instructions

**Configuration File Locations:**
- Project-level: .cursor/mcp.json (in project root)
- Global: ~/.cursor/mcp.json (user home directory)

**Steps:**
1. Create or open the mcp.json file at one of the locations above
2. Add the server configuration
3. Save the file
4. Restart Cursor or reload the window

**Example Configuration:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "command": "uvx",
      "args": ["mcp-server-name"]
    }
  }
}
\`\`\`

**Tip:** Use project-level config for project-specific tools, global for tools you want everywhere.
`;

    case 'claude-code':
    case 'claude':
      return `
### Claude Code MCP Setup Instructions

**Option 1: Using CLI (Recommended)**
\`\`\`bash
claude mcp add ${configServerName} --scope user
\`\`\`

**Option 2: Direct Configuration**
- User scope: ~/.claude.json
- Project scope: .mcp.json (in project root)

**Steps for manual setup:**
1. Open ~/.claude.json (create if it doesn't exist)
2. Add the server configuration
3. Save the file

**Example Configuration:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "type": "stdio",
      "command": "uvx",
      "args": ["mcp-server-name"]
    }
  }
}
\`\`\`

**Verify Installation:**
\`\`\`bash
claude mcp list
claude mcp get ${configServerName}
\`\`\`
`;

    default:
      return `
### MCP Setup Instructions

Please configure the MCP server according to your AI assistant's documentation.
The server name to use: ${configServerName}

**Common Configuration Format:**
\`\`\`json
{
  "mcpServers": {
    "${configServerName}": {
      "command": "uvx",
      "args": ["mcp-server-name"]
    }
  }
}
\`\`\`
`;
  }
}

/**
 * Format MCP server info with mandatory usage instructions
 */
function formatMcpServerWithInstructions(mcpServer: McpServer | undefined, provider?: string): (McpServer & { formattedInstructions?: string }) | undefined {
  if (!mcpServer) return undefined;

  const usageDesc = (mcpServer as McpServer & { usageDescription?: string }).usageDescription || '';
  const agentProvider = provider || 'unknown';
  const providerSetupInstructions = getProviderMcpSetupInstructions(agentProvider, mcpServer.mcpId || mcpServer.name);

  const formattedInstructions = `
=== MCP SERVER INTEGRATION ===
Server: ${mcpServer.name} by ${mcpServer.author}
Description: ${mcpServer.description}
GitHub: ${mcpServer.githubUrl}

${usageDesc ? `=== USER'S INTENDED USAGE ===\n${usageDesc}\n` : ''}
=== CRITICAL INSTRUCTIONS ===
**YOU MUST** use this MCP server exactly as described by the user above.
${usageDesc ? `The user has specified their intent - follow it precisely.` : ''}

**IF THE MCP SERVER IS NOT AVAILABLE OR NOT CONFIGURED:**
You **MUST** install and configure it NOW. DO NOT skip to the next node.
DO NOT proceed with the task until the MCP server is working.

${providerSetupInstructions}

${mcpServer.requiresApiKey ? `**NOTE:** This MCP server requires an API key. Ensure the API key is configured before use.\n` : ''}
=== README / Installation Guide ===
${mcpServer.readmeContent ? mcpServer.readmeContent.substring(0, 3000) : 'Refer to the GitHub repository for setup instructions: ' + mcpServer.githubUrl}
${'='.repeat(50)}
`.trim();

  return {
    ...mcpServer,
    formattedInstructions,
  };
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
 * Each subsequent node's info is returned by update_node_status when the previous node completes
 */
export async function handleGetApproval(): Promise<{
  status: 'approved' | 'cancelled' | 'pending';
  firstNode?: NextNodeInfo;
  message: string;
}> {
  // Wait up to 60 seconds before returning 'pending'
  const result = await planStore.waitForApproval(60000);

  if (result === 'approved') {
    planStore.updatePlanStatus('executing');

    // Find the first node (node with no incoming edges)
    const plan = planStore.getPlan();
    const provider = plan?.agent || 'unknown';
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
        mcpServer: formatMcpServerWithInstructions(config.mcpServer, provider),
      };
    }

    return {
      status: 'approved',
      firstNode: firstNodeInfo,
      message: 'Plan approved by user. Execute firstNode, then call update_node_status to get the next node.',
    };
  }

  if (result === 'cancelled') {
    return {
      status: 'cancelled',
      message: 'Plan cancelled by user',
    };
  }

  // Pending - user hasn't approved yet, agent should call again
  return {
    status: 'pending',
    message: 'Waiting for user approval. Call get_approval again to continue waiting.',
  };
}

/**
 * Check if execution is paused, and optionally wait for resume
 */
export async function handleCheckPause(wait: boolean = false): Promise<{
  isPaused: boolean;
  wasResumed: boolean;
  message: string;
}> {
  const isPaused = planStore.getIsPaused();

  if (!isPaused) {
    return {
      isPaused: false,
      wasResumed: false,
      message: 'Execution is not paused',
    };
  }

  if (!wait) {
    return {
      isPaused: true,
      wasResumed: false,
      message: 'Execution is paused. Call with wait=true to block until resumed.',
    };
  }

  // Wait for resume
  await planStore.waitIfPaused();

  return {
    isPaused: false,
    wasResumed: true,
    message: 'Execution was paused and has now been resumed',
  };
}

/**
 * Update the status of a node during execution
 * When a node is completed, returns the next node's information including user inputs
 * Also returns isPaused if the user has paused execution
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
  isPaused?: boolean;
} {
  const plan = planStore.getPlan();
  const provider = plan?.agent || 'unknown';
  const nodes = planStore.getNodes();
  const edges = planStore.getEdges();
  const node = nodes.find((n) => n.id === nodeId);

  if (!node) {
    return { success: false, message: `Node ${nodeId} not found` };
  }

  planStore.updateNodeStatus(nodeId, status, output);
  wsManager.broadcast({ type: 'node_status_updated', nodeId, status, output });

  // Check if execution is paused
  const isPaused = planStore.getIsPaused();

  // If status is 'completed', find and return the next node's info
  if (status === 'completed') {
    const nextNodeInfo = findNextNode(nodeId, nodes, edges, provider);

    if (nextNodeInfo) {
      return {
        success: true,
        message: `Node ${nodeId} status updated to ${status}`,
        nextNode: nextNodeInfo,
        isPaused,
      };
    } else {
      // No next node - this was the last one
      return {
        success: true,
        message: `Node ${nodeId} status updated to ${status}. This was the last node.`,
        isLastNode: true,
        isPaused,
      };
    }
  }

  return {
    success: true,
    message: `Node ${nodeId} status updated to ${status}`,
    isPaused,
  };
}

/**
 * Find the next executable node based on edges and branch selections
 */
function findNextNode(
  currentNodeId: string,
  nodes: ReturnType<typeof planStore.getNodes>,
  edges: ReturnType<typeof planStore.getEdges>,
  provider: string
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
      mcpServer: formatMcpServerWithInstructions(config.mcpServer, provider),
    };
  }

  // No valid next node found (all branches were skipped)
  // Try to find the next node after the skipped branches
  for (const edge of outgoingEdges) {
    const skippedNode = nodes.find(n => n.id === edge.to);
    if (skippedNode) {
      // Recursively find the next node after this skipped one
      const nextAfterSkipped = findNextNode(skippedNode.id, nodes, edges, provider);
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

/**
 * Check for pending rerun requests from the user
 * Returns immediately if there's a pending request, otherwise waits up to timeout
 */
export async function handleCheckRerun(timeoutMs: number = 5000): Promise<{
  hasRerun: boolean;
  nodeId?: string;
  mode?: 'single' | 'to-bottom';
  nodeInfo?: NextNodeInfo;
  message: string;
}> {
  const rerunRequest = await planStore.waitForRerun(timeoutMs);

  if (!rerunRequest) {
    return {
      hasRerun: false,
      message: 'No rerun request pending',
    };
  }

  // Reset the nodes that need to be rerun
  const resetNodeIds = planStore.resetNodesForRerun(rerunRequest.nodeId, rerunRequest.mode);

  // Broadcast node status updates
  for (const nodeId of resetNodeIds) {
    wsManager.broadcast({ type: 'node_status_updated', nodeId, status: 'pending' });
  }

  // Update plan status back to executing
  planStore.updatePlanStatus('executing');
  const plan = planStore.getPlan();
  const provider = plan?.agent || 'unknown';
  wsManager.broadcast({ type: 'plan_started', plan: plan! });

  // Get the node info for the rerun start node
  const nodes = planStore.getNodes();
  const nodeConfigs = planStore.getNodeConfigs();
  const startNode = nodes.find(n => n.id === rerunRequest.nodeId);

  let nodeInfo: NextNodeInfo | undefined;
  if (startNode) {
    const config = nodeConfigs[startNode.id] || { fieldValues: {}, attachments: [] };
    nodeInfo = {
      id: startNode.id,
      title: startNode.title,
      type: startNode.type,
      description: startNode.description,
      fieldValues: config.fieldValues || {},
      attachments: config.attachments || [],
      metaInstructions: config.metaInstructions,
      mcpServer: formatMcpServerWithInstructions(config.mcpServer, provider),
    };
  }

  return {
    hasRerun: true,
    nodeId: rerunRequest.nodeId,
    mode: rerunRequest.mode,
    nodeInfo,
    message: `Rerun requested from node ${rerunRequest.nodeId} (${rerunRequest.mode})`,
  };
}
