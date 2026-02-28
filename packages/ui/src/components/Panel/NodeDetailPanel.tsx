import { motion } from 'framer-motion';
import { X, AlertCircle, CheckCircle2, FileCode, Paperclip, FileText, Image, File, Trash2, Plus, MessageSquare, Save, Server, Eye } from 'lucide-react';
import { usePlanStore, FileAttachment } from '@/stores/plan-store';
import { useMultiProjectStore } from '@/stores/multi-project-store';
import { DynamicFieldInput } from './DynamicFieldInput';
import { BranchSelector } from './BranchSelector';
import { McpMarketplaceModal } from '../Modals/McpMarketplaceModal';
import { OutputModal } from '../Modals/OutputModal';
import { clsx } from 'clsx';
import { useState } from 'react';

// Helper to determine file type from extension
function getFileType(filename: string): FileAttachment['type'] {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'css', 'html', 'json', 'yaml', 'yml', 'toml', 'md'].includes(ext)) return 'code';
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'xls', 'xlsx'].includes(ext)) return 'document';
  return 'other';
}

// File type icon component
function FileTypeIcon({ type }: { type: FileAttachment['type'] }) {
  switch (type) {
    case 'image': return <Image className="w-3.5 h-3.5 text-accent-purple" />;
    case 'code': return <FileCode className="w-3.5 h-3.5 text-accent-blue" />;
    case 'document': return <FileText className="w-3.5 h-3.5 text-accent-yellow" />;
    default: return <File className="w-3.5 h-3.5 text-text-muted" />;
  }
}

// Pending file attachment (before saving)
interface PendingFile {
  id: string;
  path: string;
  description: string;
}

export function NodeDetailPanel() {
  const { plans, selectedNodeId, selectedPlanId, setSelectedNodeId, updateFieldValue, setSelectedBranch, addAttachment, removeAttachment, updateMetaInstructions, removeNodeMcpServer } = usePlanStore();
  const { activeTabId, setProjectFieldValue, setProjectSelectedBranch } = useMultiProjectStore();

  // Local state for pending changes
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [localMetaInstructions, setLocalMetaInstructions] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [initialized, setInitialized] = useState<string | null>(null);
  const [mcpModalOpen, setMcpModalOpen] = useState(false);
  const [outputModalOpen, setOutputModalOpen] = useState(false);

  // Find the node from the correct plan (or search all plans)
  let node = null;
  let nodePlanId: string | undefined;

  if (selectedPlanId) {
    const planData = plans.find(p => p.plan.id === selectedPlanId);
    node = planData?.nodes.find((n) => n.id === selectedNodeId) || null;
    nodePlanId = selectedPlanId;
  } else {
    // Search all plans for the node (backwards compatibility)
    for (const planData of plans) {
      const found = planData.nodes.find((n) => n.id === selectedNodeId);
      if (found) {
        node = found;
        nodePlanId = planData.plan.id;
        break;
      }
    }
  }

  // Initialize local state when node changes
  if (node && initialized !== node.id) {
    setLocalMetaInstructions(node.metaInstructions || '');
    setPendingFiles([]);
    setHasUnsavedChanges(false);
    setInitialized(node.id);
  }

  if (!node) return null;

  // Debug logging for branch selection troubleshooting
  console.log('[NodeDetailPanel] Rendering for node:', node.id,
    '| Title:', node.title,
    '| Type:', node.type,
    '| Selected branch:', node.selectedBranchId,
    '| Plan ID:', nodePlanId);

  const requiredFieldsEmpty = node.dynamicFields.filter(
    (f) => f.required && !f.value
  ).length;

  const handleFieldChange = (fieldId: string, value: string) => {
    // Update legacy store
    updateFieldValue(node.id, fieldId, value, nodePlanId);
    // Also update multi-project store (this is what approvePlan reads from)
    if (activeTabId) {
      setProjectFieldValue(activeTabId, node.id, fieldId, value);
    }
  };

  const handleBranchSelect = (branchId: string) => {
    // Update legacy store
    setSelectedBranch(node.id, branchId, nodePlanId);
    // Also update multi-project store
    if (activeTabId) {
      setProjectSelectedBranch(activeTabId, node.id, branchId);
    }
  };

  // Add a new empty pending file row
  const handleAddFileRow = () => {
    setPendingFiles([...pendingFiles, {
      id: `pending_${Date.now()}`,
      path: '',
      description: '',
    }]);
    setHasUnsavedChanges(true);
  };

  // Update path for a pending file
  const handlePathChange = (pendingId: string, path: string) => {
    setPendingFiles(pendingFiles.map(pf =>
      pf.id === pendingId ? { ...pf, path } : pf
    ));
    setHasUnsavedChanges(true);
  };

  // Update description for a pending file
  const handleDescriptionChange = (pendingId: string, description: string) => {
    setPendingFiles(pendingFiles.map(pf =>
      pf.id === pendingId ? { ...pf, description } : pf
    ));
    setHasUnsavedChanges(true);
  };

  // Remove a pending file row
  const handleRemovePendingFile = (pendingId: string) => {
    setPendingFiles(pendingFiles.filter(pf => pf.id !== pendingId));
    setHasUnsavedChanges(true);
  };

  // Handle meta instructions change
  const handleMetaInstructionsChange = (value: string) => {
    setLocalMetaInstructions(value);
    setHasUnsavedChanges(true);
  };

  // Save all changes
  const handleSave = () => {
    // Save meta instructions
    updateMetaInstructions(node.id, localMetaInstructions, nodePlanId);

    // Save pending files that have both a path and description
    pendingFiles.forEach(pf => {
      if (pf.path.trim() && pf.description.trim()) {
        const attachment: FileAttachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          path: pf.path.trim(),
          name: pf.path.trim().split('/').pop() || pf.path.trim(),
          type: getFileType(pf.path),
          description: pf.description.trim(),
        };
        addAttachment(node.id, attachment, nodePlanId);
      }
    });

    // Clear pending files
    setPendingFiles([]);
    setHasUnsavedChanges(false);
  };

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 right-0 h-full w-[380px] bg-surface/95 backdrop-blur-md border-l border-border shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-border flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={clsx('w-1.5 h-1.5 rounded-full', {
                'bg-status-pending': node.status === 'pending',
                'bg-status-active animate-pulse': node.status === 'active',
                'bg-status-completed': node.status === 'completed',
                'bg-status-failed': node.status === 'failed',
              })}
            />
            <span className="text-[10px] text-text-muted capitalize">
              {node.type} · {node.status}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-text-primary truncate">
            {node.title}
          </h2>
        </div>

        <button
          onClick={() => setSelectedNodeId(null)}
          className="p-1 rounded hover:bg-surface-raised text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {/* Description */}
        {node.description && (
          <section>
            <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1">
              Description
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {node.description}
            </p>
          </section>
        )}

        {/* Metadata Grid */}
        <section className="grid grid-cols-2 gap-2">
          {node.complexity && (
            <div className="p-2 rounded-md bg-surface-raised">
              <span className="text-[9px] text-text-muted uppercase tracking-wider">
                Complexity
              </span>
              <p
                className={clsx('text-xs font-medium', {
                  'text-accent-green': node.complexity === 'low',
                  'text-accent-yellow': node.complexity === 'medium',
                  'text-accent-red': node.complexity === 'high',
                })}
              >
                {node.complexity}
              </p>
            </div>
          )}

          {node.expectedOutput && (
            <div className="p-2 rounded-md bg-surface-raised col-span-2">
              <span className="text-[9px] text-text-muted uppercase tracking-wider flex items-center gap-1">
                <FileCode className="w-2.5 h-2.5" />
                Expected Output
              </span>
              <p className="text-xs text-text-secondary mt-0.5">
                {node.expectedOutput}
              </p>
            </div>
          )}
        </section>

        {/* MCP Server Integration */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Server className="w-2.5 h-2.5" />
              MCP Servers
              {node.mcpServers && node.mcpServers.length > 0 && (
                <span className="text-accent-purple">({node.mcpServers.length})</span>
              )}
            </h3>
            <button
              onClick={() => setMcpModalOpen(true)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-accent-purple hover:bg-accent-purple/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {node.mcpServers && node.mcpServers.length > 0 ? (
            <div className="space-y-2">
              {node.mcpServers.map((mcpServer) => (
                <div key={mcpServer.mcpId} className="p-2.5 rounded-lg bg-gradient-to-br from-accent-purple/5 to-accent-blue/5 border border-accent-purple/20">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-md bg-surface-raised flex items-center justify-center overflow-hidden shrink-0">
                      {mcpServer.logoUrl ? (
                        <img
                          src={mcpServer.logoUrl}
                          alt={mcpServer.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Server className="w-4 h-4 text-text-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-text-primary truncate">{mcpServer.name}</p>
                        <button
                          onClick={() => removeNodeMcpServer(node.id, mcpServer.mcpId, nodePlanId)}
                          className="p-1 rounded hover:bg-accent-red/20 text-text-muted hover:text-accent-red transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-[10px] text-text-muted truncate">by {mcpServer.author}</p>
                      <p className="text-[10px] text-text-secondary mt-1 line-clamp-2">{mcpServer.description}</p>
                      {mcpServer.requiresApiKey && (
                        <p className="text-[10px] text-accent-yellow mt-1">Requires API Key</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button
              onClick={() => setMcpModalOpen(true)}
              className="w-full p-3 rounded-lg border-2 border-dashed border-border hover:border-accent-purple/50 hover:bg-accent-purple/5 transition-all group"
            >
              <div className="flex items-center justify-center gap-2 text-text-muted group-hover:text-accent-purple">
                <Plus className="w-4 h-4" />
                <span className="text-xs font-medium">Add MCP Server</span>
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                Attach MCP servers to enhance this node's capabilities
              </p>
            </button>
          )}
        </section>

        {/* Risks */}
        {node.risks && (
          <section>
            <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <AlertCircle className="w-2.5 h-2.5" />
              Risks
            </h3>
            <p className="text-xs text-text-secondary bg-accent-yellow/5 border border-accent-yellow/20 rounded-md p-2">
              {node.risks}
            </p>
          </section>
        )}

        {/* Branch selection for branch points (detected from graph structure) */}
        {(() => {
          console.log('[NodeDetailPanel] ========================================');
          console.log('[NodeDetailPanel] === BRANCH DETECTION DEBUG BUILD v3 ===');
          console.log('[NodeDetailPanel] ========================================');
          console.log('[NodeDetailPanel] selectedNodeId:', selectedNodeId);
          console.log('[NodeDetailPanel] selectedPlanId:', selectedPlanId);
          console.log('[NodeDetailPanel] Current node.id:', node.id);
          console.log('[NodeDetailPanel] nodePlanId:', nodePlanId);
          console.log('[NodeDetailPanel] Total plans count:', plans.length);
          console.log('[NodeDetailPanel] All plan IDs:', plans.map(p => p.plan.id));

          // Get the current plan data to access edges
          const currentPlanData = plans.find(p => p.plan.id === nodePlanId);
          if (!currentPlanData) {
            console.log('[NodeDetailPanel] ERROR: No current plan data found!');
            console.log('[NodeDetailPanel] Searching for planId:', nodePlanId);
            console.log('[NodeDetailPanel] Available planIds:', plans.map(p => p.plan.id));
            console.log('[NodeDetailPanel] Type of nodePlanId:', typeof nodePlanId);
            return (
              <div className="text-xs text-accent-red p-2 bg-accent-red/10 rounded">
                Error: Plan data not found for ID: {nodePlanId}
              </div>
            );
          }

          const { nodes: allNodes, edges } = currentPlanData;
          console.log('[NodeDetailPanel] SUCCESS: Found plan data');
          console.log('[NodeDetailPanel] Plan has', allNodes.length, 'nodes and', edges.length, 'edges');
          console.log('[NodeDetailPanel] All node IDs:', allNodes.map(n => n.id).join(', '));
          console.log('[NodeDetailPanel] All edges:', edges.map(e => `${e.from}->${e.to}`).join(', '));

          // Filter out explicit decision nodes (legacy) - simplified to match RequirementsChecklist
          const decisionNodeIds = new Set(allNodes.filter(n => n.type === 'decision').map(n => n.id));
          console.log('[NodeDetailPanel] Decision node IDs:', Array.from(decisionNodeIds));

          // Build outgoing edges map directly (skip edges involving decision nodes)
          const outgoingEdgesMap: Record<string, string[]> = {};
          for (const edge of edges) {
            if (decisionNodeIds.has(edge.from) || decisionNodeIds.has(edge.to)) continue;
            if (!outgoingEdgesMap[edge.from]) {
              outgoingEdgesMap[edge.from] = [];
            }
            if (!outgoingEdgesMap[edge.from].includes(edge.to)) {
              outgoingEdgesMap[edge.from].push(edge.to);
            }
          }
          console.log('[NodeDetailPanel] Outgoing edges map:', JSON.stringify(outgoingEdgesMap));

          // Check if current node is a branch point (has multiple outgoing edges)
          const outgoingTargets = outgoingEdgesMap[node.id] || [];
          const isBranchPoint = outgoingTargets.length > 1;

          console.log('[NodeDetailPanel] Checking node:', node.id);
          console.log('[NodeDetailPanel] Outgoing targets for this node:', outgoingTargets);
          console.log('[NodeDetailPanel] Outgoing count:', outgoingTargets.length);
          console.log('[NodeDetailPanel] Is branch point (>1 targets):', isBranchPoint);

          if (!isBranchPoint) {
            console.log('[NodeDetailPanel] NOT a branch point - no branch UI will show');
            // Show a debug hint when in development
            return (
              <div className="text-[10px] text-text-muted p-2 bg-surface-raised rounded border border-border/50">
                Node has {outgoingTargets.length} outgoing edge(s).
                {outgoingTargets.length === 0 && ' (This is a leaf node)'}
                {outgoingTargets.length === 1 && ` Next: ${outgoingTargets[0]}`}
              </div>
            );
          }

          // Build branch targets with node info
          const branchTargets = outgoingTargets.map(targetId => {
            const targetNode = allNodes.find(n => n.id === targetId);
            console.log('[NodeDetailPanel] Looking for target node:', targetId, 'Found:', !!targetNode);
            return targetNode ? {
              id: targetId,
              label: targetNode.title,
              description: targetNode.description || '',
            } : null;
          }).filter(Boolean) as { id: string; label: string; description: string }[];

          console.log('[NodeDetailPanel] Branch targets count:', branchTargets.length);
          console.log('[NodeDetailPanel] Branch targets:', branchTargets.map(t => `${t.id}:${t.label}`));
          console.log('[NodeDetailPanel] Current selection:', node.selectedBranchId);

          if (branchTargets.length === 0) {
            console.log('[NodeDetailPanel] ERROR: Branch targets resolved to empty array!');
            return (
              <div className="text-xs text-accent-red p-2 bg-accent-red/10 rounded">
                Error: Branch targets not found. Targets: {outgoingTargets.join(', ')}
              </div>
            );
          }

          console.log('[NodeDetailPanel] SUCCESS: Rendering BranchSelector with', branchTargets.length, 'branches');

          return (
            <section>
              <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
                Choose a Path ({branchTargets.length} options)
              </h3>
              <BranchSelector
                branches={branchTargets}
                selectedBranchId={node.selectedBranchId}
                onSelect={handleBranchSelect}
              />
            </section>
          );
        })()}

        {/* Dynamic Fields */}
        {node.dynamicFields.length > 0 && (
          <section>
            <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
              Configuration
              {requiredFieldsEmpty > 0 && (
                <span className="ml-1.5 text-accent-yellow">
                  ({requiredFieldsEmpty} required)
                </span>
              )}
            </h3>
            <div className="space-y-2.5">
              {node.dynamicFields.map((field) => (
                <DynamicFieldInput
                  key={field.id}
                  field={field}
                  onChange={(value) => handleFieldChange(field.id, value)}
                />
              ))}
            </div>
          </section>
        )}

        {/* File Attachments */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Paperclip className="w-2.5 h-2.5" />
              File Attachments
            </h3>
            <button
              onClick={handleAddFileRow}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-accent-blue hover:bg-accent-blue/10 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add File
            </button>
          </div>

          {/* Saved attachments */}
          {node.attachments.length > 0 && (
            <div className="space-y-2 mb-2">
              {node.attachments.map((att) => (
                <div
                  key={att.id}
                  className="p-2 rounded-md bg-surface-raised border border-border/50 group"
                >
                  <div className="flex items-start gap-2">
                    <FileTypeIcon type={att.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary font-medium truncate">{att.name}</p>
                      <p className="text-[10px] text-text-muted truncate">{att.path}</p>
                      <p className="text-[10px] text-text-secondary mt-1">{att.description}</p>
                    </div>
                    <button
                      onClick={() => removeAttachment(node.id, att.id, nodePlanId)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent-red/20 text-text-muted hover:text-accent-red transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pending file rows */}
          {pendingFiles.map((pf) => (
            <div key={pf.id} className="p-2 rounded-md bg-canvas border border-border mb-2">
              {/* File path input */}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={pf.path}
                    onChange={(e) => handlePathChange(pf.id, e.target.value)}
                    placeholder="/full/path/to/file.ext"
                    className="w-full px-2 py-1.5 rounded-md bg-surface-raised border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue font-mono"
                  />
                </div>

                <button
                  onClick={() => handleRemovePendingFile(pf.id)}
                  className="p-1 rounded hover:bg-accent-red/20 text-text-muted hover:text-accent-red transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              {/* Description input */}
              <input
                type="text"
                value={pf.description}
                onChange={(e) => handleDescriptionChange(pf.id, e.target.value)}
                placeholder="Description (required)..."
                className="w-full px-2 py-1.5 rounded-md bg-surface-raised border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue"
              />
              {pf.path && !pf.description.trim() && (
                <p className="text-[10px] text-accent-red mt-1">Description is required</p>
              )}
            </div>
          ))}

          {node.attachments.length === 0 && pendingFiles.length === 0 && (
            <p className="text-[10px] text-text-muted text-center py-2">
              No files attached. Click "Add File" to attach files for the AI to reference.
            </p>
          )}
        </section>

        {/* Meta Instructions */}
        <section>
          <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1">
            <MessageSquare className="w-2.5 h-2.5" />
            Instructions for AI
          </h3>
          <textarea
            value={localMetaInstructions}
            onChange={(e) => handleMetaInstructionsChange(e.target.value)}
            placeholder="Add specific instructions for this step..."
            rows={3}
            className="w-full px-2 py-1.5 rounded-md bg-canvas border border-border text-xs text-text-primary placeholder-text-muted focus:outline-none focus:ring-1 focus:ring-accent-blue resize-none"
          />
          <p className="text-[10px] text-text-muted mt-1">
            These instructions will be sent to the AI when executing this node
          </p>
        </section>

        {/* Execution Output */}
        {(node.output || node.structuredOutput) && (
          <section>
            <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5 text-accent-green" />
              Output
            </h3>
            <button
              onClick={() => setOutputModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent-blue/10 border border-accent-blue/30 text-accent-blue hover:bg-accent-blue/20 transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span className="text-xs font-medium">View Output</span>
            </button>
          </section>
        )}
      </div>

      {/* Footer with Save Button */}
      <div className="px-3 py-2 border-t border-border bg-surface">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-muted">
            {node.attachments.length > 0 && `${node.attachments.length} file${node.attachments.length > 1 ? 's' : ''}`}
            {node.attachments.length > 0 && (node.metaInstructions || localMetaInstructions) && ' · '}
            {(node.metaInstructions || localMetaInstructions) && 'Has instructions'}
            {node.mcpServers && node.mcpServers.length > 0 && ` · ${node.mcpServers.length} MCP${node.mcpServers.length > 1 ? 's' : ''}`}
          </span>

          <button
            onClick={handleSave}
            disabled={!hasUnsavedChanges}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              hasUnsavedChanges
                ? 'bg-accent-blue text-white hover:bg-accent-blue/90'
                : 'bg-surface-raised text-text-muted cursor-not-allowed'
            )}
          >
            <Save className="w-3 h-3" />
            Save
          </button>
        </div>
      </div>

      {/* MCP Marketplace Modal */}
      <McpMarketplaceModal
        isOpen={mcpModalOpen}
        onClose={() => setMcpModalOpen(false)}
        nodeId={node.id}
        planId={nodePlanId}
        currentMcps={node.mcpServers}
      />

      {/* Output Modal */}
      <OutputModal
        isOpen={outputModalOpen}
        onClose={() => setOutputModalOpen(false)}
        nodeTitle={node.title}
        output={node.output}
        structuredOutput={node.structuredOutput}
      />
    </motion.div>
  );
}
