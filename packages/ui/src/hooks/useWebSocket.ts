import { useEffect, useRef, useCallback } from 'react';
import { usePlanStore, PlanNode, PlanEdge, Plan } from '@/stores/plan-store';
import {
  useMultiProjectStore,
  ProjectContext,
  HistoryEntry,
  PersistedPlan,
} from '@/stores/multi-project-store';
import { historyCache } from '@/utils/history-cache';

const WS_URL = 'ws://localhost:3030';

// History polling interval (3 seconds)
const HISTORY_POLL_INTERVAL = 3000;

// Resume plan info type (matching server)
interface ResumePlanInfo {
  planId: string;
  planTitle: string;
  agent: string;
  status: Plan['status'];
  projectId: string;
  workspacePath: string;
  currentNodeId: string | null;
  currentNodeTitle: string | null;
  currentNodeStatus: PlanNode['status'] | null;
  completedNodes: Array<{ id: string; title: string; output?: string }>;
  pendingNodes: Array<{ id: string; title: string; description: string }>;
  failedNodes: Array<{ id: string; title: string; output?: string }>;
  fieldValues: Record<string, string>;
  selectedBranches: Record<string, string>;
  nodeConfigs: Record<string, unknown>;
  createdAt: string;
  pausedAt?: string;
}

type MessageType =
  | { type: 'connected' }
  | { type: 'plan_started'; plan: Plan; projectId?: string }
  | { type: 'node_added'; node: PlanNode; projectId?: string }
  | { type: 'edge_added'; edge: PlanEdge; projectId?: string }
  | { type: 'plan_ready'; projectId?: string }
  | { type: 'node_status_updated'; nodeId: string; status: PlanNode['status']; output?: string; structuredOutput?: PlanNode['structuredOutput']; projectId?: string }
  | { type: 'plan_completed'; projectId?: string }
  | { type: 'plan_failed'; error: string; projectId?: string }
  | { type: 'plan_paused'; projectId?: string }
  | { type: 'plan_resumed'; projectId?: string }
  | { type: 'nodes_inserted'; nodes: PlanNode[]; edges: PlanEdge[]; removedEdgeIds: string[]; projectId?: string }
  | { type: 'node_removed'; nodeId: string; newEdges: PlanEdge[]; removedEdgeIds: string[]; projectId?: string }
  | { type: 'error'; message: string }
  // Multi-project messages
  | { type: 'project_registered'; projectId: string; projectName: string; workspacePath: string }
  | { type: 'projects_list'; projects: ProjectContext[] }
  | { type: 'history_entries'; entries: HistoryEntry[] }
  | { type: 'plan_loaded'; plan: PersistedPlan; projectId: string }
  | { type: 'resume_plan_info'; resumeInfo: ResumePlanInfo }
  | { type: 'plan_saved'; projectId: string; planId: string }
  // Plan update messages
  | { type: 'plan_updated'; plan: PersistedPlan; previousPlan: PersistedPlan; diff: PlanDiff; projectId: string }
  | { type: 'new_plan_created'; planId: string; projectId: string }
  | { type: 'plan_updated_incrementally'; operationCount: number; successCount: number; failCount: number; projectId: string }
  | { type: 'node_replaced'; oldNodeId: string; node: PlanNode; projectId: string };

// Plan diff type (matching server)
interface PlanDiff {
  addedNodes: PlanNode[];
  removedNodes: PlanNode[];
  modifiedNodes: Array<{ before: PlanNode; after: PlanNode }>;
  addedEdges: PlanEdge[];
  removedEdges: PlanEdge[];
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const handleMessageRef = useRef<(message: MessageType) => void>(() => {});

  const {
    setConnected,
    setPlan,
    addNode,
    addEdge,
    updatePlanStatus,
    updateNodeStatus,
    clearPlan,
  } = usePlanStore();

  const multiProjectStore = useMultiProjectStore;

  // Update the ref with the latest handler
  handleMessageRef.current = (message: MessageType) => {
    console.log('[Overture] Received message:', message.type);

    // Get projectId from message if present
    const projectId = 'projectId' in message ? message.projectId : undefined;

    switch (message.type) {
      case 'connected':
        console.log('[Overture] Server acknowledged connection');
        break;

      case 'project_registered': {
        console.log('[Overture] ========== PROJECT REGISTERED ==========');
        console.log('[Overture] Project registered:', message.projectName);
        console.log('[Overture] Project ID:', message.projectId);
        console.log('[Overture] Workspace:', message.workspacePath);
        multiProjectStore.getState().addTab({
          projectId: message.projectId,
          projectName: message.projectName,
          workspacePath: message.workspacePath,
          agentType: 'unknown',
        });
        console.log('[Overture] activeTabId after addTab:', multiProjectStore.getState().activeTabId);
        break;
      }

      case 'projects_list': {
        console.log('[Overture] Projects list received:', message.projects.length);
        // Add tabs for all projects
        for (const project of message.projects) {
          multiProjectStore.getState().addTab(project);
        }
        break;
      }

      case 'history_entries': {
        console.log('[Overture] History entries received:', message.entries.length);
        multiProjectStore.getState().setHistoryEntries(message.entries);
        // Cache history locally for persistence across page reloads
        historyCache.save(message.entries);
        break;
      }

      case 'plan_loaded': {
        console.log('[Overture] Plan loaded from history:', message.plan.plan.id);
        multiProjectStore.getState().loadPlanFromHistory(message.plan);

        // Also update the legacy plan store for backwards compat
        clearPlan();
        setPlan(message.plan.plan);
        for (const node of message.plan.nodes) {
          addNode(node);
        }
        for (const edge of message.plan.edges) {
          addEdge(edge);
        }
        break;
      }

      case 'plan_started': {
        console.log('[Overture] ========== PLAN STARTED ==========');
        console.log('[Overture] Plan started:', message.plan);
        console.log('[Overture] Plan projectId from message:', projectId);

        // Update multi-project store
        if (projectId) {
          console.log('[Overture] Initializing project data for:', projectId);
          multiProjectStore.getState().initProjectData(projectId);
          multiProjectStore.getState().setProjectPlan(projectId, message.plan);
          multiProjectStore.getState().incrementTabUnread(projectId);
          console.log('[Overture] activeTabId after plan_started:', multiProjectStore.getState().activeTabId);
        }

        // MULTI-PLAN: Don't clear existing plans - just add the new one
        // The setPlan function now appends to the plans array (Figma-style)
        setPlan({ ...message.plan, status: 'streaming' });
        break;
      }

      case 'node_added': {
        console.log('[Overture] Node added:', message.node.id);

        // Update multi-project store
        if (projectId) {
          multiProjectStore.getState().addProjectNode(projectId, message.node);
        }

        // Also update legacy store (nodes go to the most recent plan by default)
        addNode(message.node);
        break;
      }

      case 'edge_added': {
        console.log('[Overture] Edge added:', message.edge.id);

        // Update multi-project store
        if (projectId) {
          multiProjectStore.getState().addProjectEdge(projectId, message.edge);
        }

        // Also update legacy store
        addEdge(message.edge);
        break;
      }

      case 'plan_ready': {
        console.log('[Overture] Plan ready');

        // Update multi-project store
        if (projectId) {
          multiProjectStore.getState().updateProjectPlanStatus(projectId, 'ready');
          multiProjectStore.getState().incrementTabUnread(projectId);
        }

        // Also update legacy store
        updatePlanStatus('ready');
        break;
      }

      case 'node_status_updated': {
        // Update multi-project store
        if (projectId) {
          multiProjectStore.getState().updateProjectNodeStatus(
            projectId,
            message.nodeId,
            message.status,
            message.output,
            message.structuredOutput
          );
        }

        // Also update legacy store
        updateNodeStatus(message.nodeId, message.status, message.output, message.structuredOutput);
        break;
      }

      case 'plan_completed': {
        // Update multi-project store
        if (projectId) {
          multiProjectStore.getState().updateProjectPlanStatus(projectId, 'completed');
          multiProjectStore.getState().incrementTabUnread(projectId);
        }

        // Also update legacy store
        updatePlanStatus('completed');
        break;
      }

      case 'plan_failed': {
        console.error('[Overture] Plan failed:', message.error);

        // Update multi-project store
        if (projectId) {
          multiProjectStore.getState().updateProjectPlanStatus(projectId, 'failed');
          multiProjectStore.getState().incrementTabUnread(projectId);
        }

        // Also update legacy store
        updatePlanStatus('failed');
        break;
      }

      case 'plan_paused': {
        console.log('[Overture] Plan paused');

        // Update multi-project store
        if (projectId) {
          multiProjectStore.getState().updateProjectPlanStatus(projectId, 'paused');
        }

        // Also update legacy store
        usePlanStore.getState().pauseExecution();
        break;
      }

      case 'plan_resumed': {
        console.log('[Overture] Plan resumed');

        // Update multi-project store
        if (projectId) {
          multiProjectStore.getState().updateProjectPlanStatus(projectId, 'executing');
        }

        // Also update legacy store
        usePlanStore.getState().resumeExecution();
        break;
      }

      case 'nodes_inserted': {
        console.log('[Overture] Nodes inserted:', message.nodes.length);
        // TODO: Update multi-project store
        usePlanStore.getState().insertNodes(message.nodes, message.edges, message.removedEdgeIds);
        break;
      }

      case 'node_removed': {
        console.log('[Overture] Node removed:', message.nodeId);
        // Already handled locally, but sync just in case
        break;
      }

      case 'error': {
        console.error('[Overture] Server error:', message.message);
        break;
      }

      case 'resume_plan_info': {
        console.log('[Overture] Resume plan info received:', message.resumeInfo);
        // This is informational - agents use this to understand where to resume
        // The UI can display this information if needed
        break;
      }

      case 'plan_saved': {
        console.log('[Overture] Plan saved:', message.planId);
        break;
      }

      case 'plan_updated': {
        console.log('[Overture] Plan updated:', message.plan.plan.id);
        console.log('[Overture] Diff:', {
          addedNodes: message.diff.addedNodes.length,
          removedNodes: message.diff.removedNodes.length,
          modifiedNodes: message.diff.modifiedNodes.length,
        });

        // Store the diff and previous plan for display
        multiProjectStore.getState().setCurrentDiff(message.diff);
        multiProjectStore.getState().setPreviousPlanData(message.projectId, {
          plan: message.previousPlan.plan,
          nodes: message.previousPlan.nodes,
          edges: message.previousPlan.edges,
          fieldValues: message.previousPlan.fieldValues,
          selectedBranches: message.previousPlan.selectedBranches,
          nodeConfigs: message.previousPlan.nodeConfigs,
        });

        // Load the new plan
        multiProjectStore.getState().loadPlanFromHistory(message.plan);

        // Also update legacy store
        clearPlan();
        setPlan(message.plan.plan);
        for (const node of message.plan.nodes) {
          addNode(node);
        }
        for (const edge of message.plan.edges) {
          addEdge(edge);
        }

        // Show diff view
        multiProjectStore.getState().setShowDiffView(true);
        break;
      }

      case 'new_plan_created': {
        console.log('[Overture] New plan created for project:', message.projectId);
        // Clear any existing diff view
        multiProjectStore.getState().setCurrentDiff(null);
        multiProjectStore.getState().setShowDiffView(false);
        break;
      }

      case 'plan_updated_incrementally': {
        console.log('[Overture] Plan updated incrementally:', {
          operationCount: message.operationCount,
          successCount: message.successCount,
          failCount: message.failCount,
        });
        // Request a refresh of the history
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'get_history' }));
        }
        break;
      }

      case 'node_replaced': {
        console.log('[Overture] Node replaced:', message.oldNodeId, '->', message.node.id);

        // If the node ID changed, we need to handle this specially
        const idChanged = message.oldNodeId !== message.node.id;

        // Update multi-project store
        if (projectId) {
          if (idChanged) {
            // For ID changes: remove old, add new
            // Note: edges are updated on the server, so we just need to refresh
            multiProjectStore.getState().addProjectNode(projectId, message.node);
          } else {
            // Same ID: just update in place
            multiProjectStore.getState().addProjectNode(projectId, message.node);
          }
        }

        // Update legacy store
        if (idChanged) {
          // Remove old node and add new one
          usePlanStore.getState().removeNode(message.oldNodeId);
          usePlanStore.getState().addNode(message.node);
        } else {
          // Update in place
          usePlanStore.getState().updateNode(message.oldNodeId, message.node);
        }
        break;
      }

      default:
        console.warn('[Overture] Unknown message type:', message);
    }
  };

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      console.log('[Overture] Connecting to WebSocket at', WS_URL);
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[Overture] Connected to server');
        setConnected(true);

        // Request history on connect
        ws.send(JSON.stringify({ type: 'get_history' }));

        // Clear any reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onclose = () => {
        console.log('[Overture] Disconnected from server');
        setConnected(false);

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log('[Overture] Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('[Overture] WebSocket error:', error);
      };

      ws.onmessage = (event) => {
        try {
          const message: MessageType = JSON.parse(event.data);
          // Use ref to always call the latest handler
          handleMessageRef.current(message);
        } catch (error) {
          console.error('[Overture] Failed to parse message:', error);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[Overture] Failed to connect:', error);
      setConnected(false);
    }
  }, [setConnected, clearPlan, setPlan, addNode, addEdge, updatePlanStatus, updateNodeStatus]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[Overture] Cannot send message - not connected');
    }
  }, []);

  const requestRerun = useCallback((nodeId: string, mode: 'single' | 'to-bottom', projectId?: string) => {
    sendMessage({
      type: 'rerun_request',
      nodeId,
      mode,
      projectId,
    });
  }, [sendMessage]);

  const pauseExecution = useCallback((projectId?: string) => {
    sendMessage({ type: 'pause_execution', projectId });
  }, [sendMessage]);

  const resumeExecution = useCallback((projectId?: string) => {
    sendMessage({ type: 'resume_execution', projectId });
  }, [sendMessage]);

  const insertNodes = useCallback((afterNodeId: string, nodes: PlanNode[], edges: PlanEdge[], projectId?: string) => {
    sendMessage({
      type: 'insert_nodes',
      afterNodeId,
      nodes,
      edges,
      projectId,
    });
  }, [sendMessage]);

  const removeNode = useCallback((nodeId: string, projectId?: string) => {
    // Update local state immediately
    usePlanStore.getState().removeNode(nodeId);
    // Notify server
    sendMessage({
      type: 'remove_node',
      nodeId,
      projectId,
    });
  }, [sendMessage]);

  const approvePlan = useCallback((projectId?: string) => {
    const state = usePlanStore.getState();
    const multiState = multiProjectStore.getState();

    console.log('[Overture] approvePlan called, projectId:', projectId);

    // Check multiProjectStore
    console.warn('multiProjectStore - activeTabId:', multiState.activeTabId);
    console.warn('multiProjectStore - tabs:', multiState.tabs.length);
    const projectData = projectId ? multiState.projectData.get(projectId) : null;
    console.warn('multiProjectStore - projectData for', projectId, ':', projectData ? `${projectData.nodes.length} nodes` : 'null');
    if (projectData && projectData.nodes.length > 0) {
      console.warn('multiProjectStore - First node fields:');
      projectData.nodes[0].dynamicFields.forEach((f, i) => {
        console.warn(`  Field ${i}: ${f.name} = "${f.value || '(empty)'}"`);
      });
    }

    // PRIORITY: Use usePlanStore nodes if available (that's where user edits like attachments/mcpServers are stored)
    // Fall back to multiProjectStore only if usePlanStore is empty
    const planStoreNodesForIteration = state.nodes;
    const multiStoreNodes = projectData?.nodes || [];

    // Prefer usePlanStore nodes since user edits are stored there
    const nodes = planStoreNodesForIteration.length > 0 ? planStoreNodesForIteration : multiStoreNodes;
    console.warn('Using nodes from:', planStoreNodesForIteration.length > 0 ? 'usePlanStore' : 'multiProjectStore', '- count:', nodes.length);

    // Collect all field values from nodes
    const fieldValues: Record<string, string> = {};
    for (const node of nodes) {
      for (const field of node.dynamicFields) {
        if (field.value) {
          fieldValues[`${node.id}.${field.name}`] = field.value;
        }
      }
    }

    // Collect selected branches from ALL nodes that have a selectedBranchId
    // (This includes both legacy decision nodes AND new-style branch points)
    const selectedBranches: Record<string, string> = {};
    for (const node of nodes) {
      if (node.selectedBranchId) {
        selectedBranches[node.id] = node.selectedBranchId;
        console.log('[approvePlan] Collected branch selection:', node.id, '->', node.selectedBranchId);
      }
    }

    // Collect node configs for ALL nodes
    // Build a map of ALL nodes from ALL plans in usePlanStore (where user edits are stored)
    const allPlanStoreNodes = new Map<string, typeof state.nodes[0]>();
    for (const planData of state.plans) {
      for (const n of planData.nodes) {
        allPlanStoreNodes.set(n.id, n);
      }
    }

    const nodeConfigs: Record<string, {
      fieldValues: Record<string, string>;
      attachments: { id: string; path: string; name: string; type: string }[];
      metaInstructions?: string;
      mcpServers?: unknown;
    }> = {};

    for (const node of nodes) {
      const nodeFieldValues: Record<string, string> = {};
      for (const field of node.dynamicFields) {
        nodeFieldValues[field.name] = field.value || '';
      }

      // Check if usePlanStore has more up-to-date data for this node (search ALL plans)
      const planStoreNode = allPlanStoreNodes.get(node.id);

      // Prefer usePlanStore data for attachments/meta/mcpServers (where user edits are stored)
      const attachments = (planStoreNode?.attachments?.length ?? 0) > 0
        ? planStoreNode!.attachments
        : (node.attachments || []);
      const metaInstructions = planStoreNode?.metaInstructions || node.metaInstructions;
      const mcpServers = (planStoreNode?.mcpServers?.length ?? 0) > 0
        ? planStoreNode!.mcpServers
        : node.mcpServers;

      nodeConfigs[node.id] = {
        fieldValues: nodeFieldValues,
        attachments: attachments,
        metaInstructions: metaInstructions,
        mcpServers: mcpServers,
      };
    }

    console.log('[Overture] nodeConfigs:', nodeConfigs);

    sendMessage({
      type: 'approve_plan',
      fieldValues,
      selectedBranches,
      nodeConfigs,
      projectId,
    });

    usePlanStore.getState().approvePlan();
  }, [sendMessage]);

  const subscribeProject = useCallback((projectId: string) => {
    sendMessage({
      type: 'subscribe_project',
      projectId,
    });
  }, [sendMessage]);

  const getHistory = useCallback((projectId?: string) => {
    sendMessage({
      type: 'get_history',
      projectId,
    });
  }, [sendMessage]);

  const loadPlan = useCallback((planId: string) => {
    sendMessage({
      type: 'load_plan',
      planId,
    });
  }, [sendMessage]);

  const getResumeInfo = useCallback((projectId?: string, planId?: string) => {
    sendMessage({
      type: 'get_resume_info',
      projectId,
      planId,
    });
  }, [sendMessage]);

  const savePlan = useCallback((projectId?: string) => {
    sendMessage({
      type: 'save_plan',
      projectId,
    });
  }, [sendMessage]);

  const requestPlanUpdate = useCallback((projectId?: string) => {
    sendMessage({
      type: 'request_plan_update',
      projectId,
    });
  }, [sendMessage]);

  const createNewPlan = useCallback((projectId?: string) => {
    sendMessage({
      type: 'create_new_plan',
      projectId,
    });
  }, [sendMessage]);

  const closeDiffView = useCallback(() => {
    multiProjectStore.getState().setCurrentDiff(null);
    multiProjectStore.getState().setShowDiffView(false);
  }, []);

  // Load cached history on mount (before WebSocket connects)
  useEffect(() => {
    const cachedHistory = historyCache.load();
    if (cachedHistory) {
      console.log('[Overture] Loading cached history on mount:', cachedHistory.length, 'entries');
      multiProjectStore.getState().setHistoryEntries(cachedHistory);
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  // Auto-refresh history every 3 seconds
  // Always request ALL history - UI will filter as needed
  useEffect(() => {
    const historyInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Request ALL history (no projectId filter) - UI handles filtering
        wsRef.current.send(JSON.stringify({ type: 'get_history' }));
      }
    }, HISTORY_POLL_INTERVAL);

    return () => clearInterval(historyInterval);
  }, []);

  // Auto-save every 30 seconds when there's an active plan
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      const planStore = usePlanStore.getState();
      const multiStore = multiProjectStore.getState();

      // Save the active project's plan if it exists and is in an active state
      const activePlanData = planStore.plans[0]; // Current plan data
      if (activePlanData?.plan && ['streaming', 'ready', 'approved', 'executing', 'paused'].includes(activePlanData.plan.status)) {
        const activeTabId = multiStore.activeTabId;
        if (activeTabId) {
          console.log('[Overture] Auto-saving plan for project:', activeTabId);
          savePlan(activeTabId);
        } else {
          // Save without projectId (uses default)
          savePlan();
        }
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [savePlan]);

  return {
    sendMessage,
    approvePlan,
    requestRerun,
    pauseExecution,
    resumeExecution,
    insertNodes,
    removeNode,
    subscribeProject,
    getHistory,
    loadPlan,
    getResumeInfo,
    savePlan,
    requestPlanUpdate,
    createNewPlan,
    closeDiffView,
  };
}
