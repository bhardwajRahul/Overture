import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileCode, Package, Server, Search, Wrench, ExternalLink, AlertCircle, Info, AlertTriangle, Plus, Minus, FileText, Trash2 } from 'lucide-react';
import { StructuredOutput } from '@/stores/plan-store';
import { clsx } from 'clsx';
import { useState } from 'react';

interface OutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeTitle: string;
  output?: string;
  structuredOutput?: StructuredOutput;
}

// Expandable section component
function ExpandableSection({
  title,
  icon,
  count,
  children,
  defaultOpen = false,
  accentColor = 'blue',
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accentColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const iconColorClasses: Record<typeof accentColor, string> = {
    blue: 'text-accent-blue',
    green: 'text-accent-green',
    yellow: 'text-accent-yellow',
    red: 'text-accent-red',
    purple: 'text-accent-purple',
  };

  const badgeClasses: Record<typeof accentColor, string> = {
    blue: 'bg-accent-blue/20 text-accent-blue',
    green: 'bg-accent-green/20 text-accent-green',
    yellow: 'bg-accent-yellow/20 text-accent-yellow',
    red: 'bg-accent-red/20 text-accent-red',
    purple: 'bg-accent-purple/20 text-accent-purple',
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-surface-raised hover:bg-surface-raised/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={iconColorClasses[accentColor]}>{icon}</span>
          <span className="text-sm font-medium text-text-primary">{title}</span>
          {count !== undefined && (
            <span className={clsx('text-xs px-1.5 py-0.5 rounded', badgeClasses[accentColor])}>
              {count}
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-text-muted"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 border-t border-border bg-canvas">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function OutputModal({
  isOpen,
  onClose,
  nodeTitle,
  output,
  structuredOutput,
}: OutputModalProps) {
  const hasStructuredOutput = structuredOutput && Object.keys(structuredOutput).filter(k => k !== 'raw').length > 0;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal Container - using flexbox for centering instead of transforms */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-2xl pointer-events-auto"
            >
            <div className="bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border bg-surface-raised/50 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      Execution Output
                    </h2>
                    <p className="text-sm text-text-muted mt-0.5">
                      Node: <span className="text-text-secondary">{nodeTitle}</span>
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-surface-raised text-text-muted hover:text-text-primary transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {hasStructuredOutput ? (
                  <>
                    {/* Overview - Always visible */}
                    {structuredOutput.overview && (
                      <div className="p-3 rounded-lg bg-surface-raised border border-border">
                        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
                          Overview
                        </h4>
                        <p className="text-sm text-text-primary">{structuredOutput.overview}</p>
                      </div>
                    )}

                    {/* Notes/Warnings - Always visible if present */}
                    {structuredOutput.notes && structuredOutput.notes.length > 0 && (
                      <div className="space-y-2">
                        {structuredOutput.notes.map((note, i) => {
                          const noteStyles = {
                            info: { icon: <Info className="w-4 h-4" />, bg: 'bg-accent-blue/10 border-accent-blue/30', text: 'text-accent-blue' },
                            warning: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-accent-yellow/10 border-accent-yellow/30', text: 'text-accent-yellow' },
                            error: { icon: <AlertCircle className="w-4 h-4" />, bg: 'bg-accent-red/10 border-accent-red/30', text: 'text-accent-red' },
                          };
                          const style = noteStyles[note.type] || noteStyles.info;
                          return (
                            <div key={i} className={clsx('flex items-start gap-2 p-2 rounded-lg border', style.bg)}>
                              <span className={style.text}>{style.icon}</span>
                              <p className={clsx('text-xs', style.text)}>{note.message}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Files Changed */}
                    {structuredOutput.filesChanged && structuredOutput.filesChanged.length > 0 && (
                      <ExpandableSection
                        title="Files Changed"
                        icon={<FileCode className="w-4 h-4" />}
                        count={structuredOutput.filesChanged.length}
                        accentColor="blue"
                        defaultOpen
                      >
                        <div className="space-y-3">
                          {structuredOutput.filesChanged.map((file, i) => (
                            <div key={i} className="rounded-lg overflow-hidden border border-border">
                              <div className="flex items-center justify-between px-3 py-2 bg-surface-raised">
                                <code className="text-xs text-text-primary font-mono">{file.path}</code>
                                <div className="flex items-center gap-2 text-xs">
                                  {file.linesAdded !== undefined && (
                                    <span className="text-accent-green flex items-center gap-0.5">
                                      <Plus className="w-3 h-3" />
                                      {file.linesAdded}
                                    </span>
                                  )}
                                  {file.linesRemoved !== undefined && (
                                    <span className="text-accent-red flex items-center gap-0.5">
                                      <Minus className="w-3 h-3" />
                                      {file.linesRemoved}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {file.diff && (
                                <pre className="p-3 text-xs font-mono overflow-x-auto bg-canvas max-h-48">
                                  {file.diff.split('\n').map((line, lineIdx) => {
                                    let lineClass = 'text-text-secondary';
                                    if (line.startsWith('+') && !line.startsWith('+++')) {
                                      lineClass = 'text-accent-green bg-accent-green/10';
                                    } else if (line.startsWith('-') && !line.startsWith('---')) {
                                      lineClass = 'text-accent-red bg-accent-red/10';
                                    } else if (line.startsWith('@@')) {
                                      lineClass = 'text-accent-purple';
                                    }
                                    return (
                                      <div key={lineIdx} className={lineClass}>
                                        {line}
                                      </div>
                                    );
                                  })}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}

                    {/* Files Created */}
                    {structuredOutput.filesCreated && structuredOutput.filesCreated.length > 0 && (
                      <ExpandableSection
                        title="Files Created"
                        icon={<FileText className="w-4 h-4" />}
                        count={structuredOutput.filesCreated.length}
                        accentColor="green"
                      >
                        <div className="space-y-1">
                          {structuredOutput.filesCreated.map((file, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-raised">
                              <code className="text-xs text-text-primary font-mono">{file.path}</code>
                              {file.lines !== undefined && (
                                <span className="text-xs text-text-muted">{file.lines} lines</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}

                    {/* Files Deleted */}
                    {structuredOutput.filesDeleted && structuredOutput.filesDeleted.length > 0 && (
                      <ExpandableSection
                        title="Files Deleted"
                        icon={<Trash2 className="w-4 h-4" />}
                        count={structuredOutput.filesDeleted.length}
                        accentColor="red"
                      >
                        <div className="space-y-1">
                          {structuredOutput.filesDeleted.map((file, i) => (
                            <div key={i} className="py-1.5 px-2 rounded bg-surface-raised">
                              <code className="text-xs text-accent-red font-mono line-through">{file.path}</code>
                            </div>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}

                    {/* Packages Installed */}
                    {structuredOutput.packagesInstalled && structuredOutput.packagesInstalled.length > 0 && (
                      <ExpandableSection
                        title="Packages Installed"
                        icon={<Package className="w-4 h-4" />}
                        count={structuredOutput.packagesInstalled.length}
                        accentColor="purple"
                      >
                        <div className="flex flex-wrap gap-2">
                          {structuredOutput.packagesInstalled.map((pkg, i) => (
                            <span
                              key={i}
                              className={clsx(
                                'px-2 py-1 rounded text-xs font-mono',
                                pkg.dev ? 'bg-accent-yellow/20 text-accent-yellow' : 'bg-accent-purple/20 text-accent-purple'
                              )}
                            >
                              {pkg.name}
                              {pkg.version && <span className="opacity-70">@{pkg.version}</span>}
                              {pkg.dev && <span className="ml-1 text-[10px]">(dev)</span>}
                            </span>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}

                    {/* MCP Setup */}
                    {structuredOutput.mcpSetup && structuredOutput.mcpSetup.length > 0 && (
                      <ExpandableSection
                        title="MCP Servers"
                        icon={<Server className="w-4 h-4" />}
                        count={structuredOutput.mcpSetup.length}
                        accentColor="purple"
                      >
                        <div className="space-y-2">
                          {structuredOutput.mcpSetup.map((mcp, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-raised">
                              <span className="text-xs text-text-primary font-medium">{mcp.name}</span>
                              <span
                                className={clsx('text-[10px] px-1.5 py-0.5 rounded', {
                                  'bg-accent-green/20 text-accent-green': mcp.status === 'installed' || mcp.status === 'configured',
                                  'bg-accent-red/20 text-accent-red': mcp.status === 'failed',
                                })}
                              >
                                {mcp.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}

                    {/* Web Searches */}
                    {structuredOutput.webSearches && structuredOutput.webSearches.length > 0 && (
                      <ExpandableSection
                        title="Web Searches"
                        icon={<Search className="w-4 h-4" />}
                        count={structuredOutput.webSearches.length}
                        accentColor="blue"
                      >
                        <div className="space-y-1">
                          {structuredOutput.webSearches.map((search, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-surface-raised">
                              <span className="text-xs text-text-primary">"{search.query}"</span>
                              {search.resultsUsed !== undefined && (
                                <span className="text-xs text-text-muted">{search.resultsUsed} results</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}

                    {/* Tool Calls */}
                    {structuredOutput.toolCalls && structuredOutput.toolCalls.length > 0 && (
                      <ExpandableSection
                        title="Tool Calls"
                        icon={<Wrench className="w-4 h-4" />}
                        count={structuredOutput.toolCalls.reduce((sum, t) => sum + t.count, 0)}
                        accentColor="yellow"
                      >
                        <div className="flex flex-wrap gap-2">
                          {structuredOutput.toolCalls.map((tool, i) => (
                            <span key={i} className="px-2 py-1 rounded bg-surface-raised text-xs text-text-primary">
                              {tool.name} <span className="text-text-muted">×{tool.count}</span>
                            </span>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}

                    {/* Preview URLs */}
                    {structuredOutput.previewUrls && structuredOutput.previewUrls.length > 0 && (
                      <ExpandableSection
                        title="Preview URLs"
                        icon={<ExternalLink className="w-4 h-4" />}
                        count={structuredOutput.previewUrls.length}
                        accentColor="green"
                        defaultOpen
                      >
                        <div className="space-y-2">
                          {structuredOutput.previewUrls.map((preview, i) => (
                            <a
                              key={i}
                              href={preview.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 py-1.5 px-2 rounded bg-surface-raised hover:bg-accent-blue/10 transition-colors group"
                            >
                              <ExternalLink className="w-3 h-3 text-accent-blue" />
                              <span className="text-xs text-accent-blue group-hover:underline">{preview.url}</span>
                              <span className="text-[10px] text-text-muted ml-auto">{preview.type}</span>
                            </a>
                          ))}
                        </div>
                      </ExpandableSection>
                    )}
                  </>
                ) : (
                  /* Raw output fallback */
                  <div className="rounded-lg bg-canvas border border-border overflow-hidden">
                    <div className="px-3 py-2 bg-surface-raised border-b border-border">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
                        Raw Output
                      </span>
                    </div>
                    <pre className="p-4 text-xs text-text-secondary font-mono overflow-x-auto whitespace-pre-wrap">
                      {output || 'No output available'}
                    </pre>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border bg-surface-raised/30 shrink-0">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-muted">
                    {hasStructuredOutput ? 'Parsed structured output' : 'Raw text output'}
                  </p>
                  <button
                    onClick={onClose}
                    className="px-4 py-1.5 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
