import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  ChevronDown,
  ChevronRight,
  FileEdit,
  FilePlus,
  FileX,
  Package,
  Server,
  Search,
  Wrench,
  ExternalLink,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Minus,
} from 'lucide-react';
import type { StructuredOutput } from '@/stores/plan-store';

type AccentColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple';

const iconColorClasses: Record<AccentColor, string> = {
  blue: 'text-accent-blue',
  green: 'text-accent-green',
  yellow: 'text-accent-yellow',
  red: 'text-accent-red',
  purple: 'text-accent-purple',
};

const badgeClasses: Record<AccentColor, string> = {
  blue: 'bg-accent-blue/10 text-accent-blue',
  green: 'bg-accent-green/10 text-accent-green',
  yellow: 'bg-accent-yellow/10 text-accent-yellow',
  red: 'bg-accent-red/10 text-accent-red',
  purple: 'bg-accent-purple/10 text-accent-purple',
};

interface ExpandableSectionProps {
  title: string;
  icon: React.ReactNode;
  count?: number;
  defaultExpanded?: boolean;
  accentColor?: AccentColor;
  children: React.ReactNode;
}

function ExpandableSection({
  title,
  icon,
  count,
  defaultExpanded = false,
  accentColor = 'blue',
  children,
}: ExpandableSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-border/50 rounded-md overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className={clsx(
          'w-full px-2.5 py-1.5 flex items-center gap-2 bg-surface-raised hover:bg-surface transition-colors',
          expanded && 'border-b border-border/50'
        )}
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-text-muted" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-muted" />
        )}
        <span className={iconColorClasses[accentColor]}>{icon}</span>
        <span className="text-xs font-medium text-text-primary flex-1 text-left">
          {title}
        </span>
        {count !== undefined && (
          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded', badgeClasses[accentColor])}>
            {count}
          </span>
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-2.5 bg-canvas">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StructuredOutputViewProps {
  output: StructuredOutput;
}

export function StructuredOutputView({ output }: StructuredOutputViewProps) {
  const hasContent =
    output.overview ||
    output.filesChanged?.length ||
    output.filesCreated?.length ||
    output.filesDeleted?.length ||
    output.packagesInstalled?.length ||
    output.mcpSetup?.length ||
    output.webSearches?.length ||
    output.toolCalls?.length ||
    output.previewUrls?.length ||
    output.notes?.length;

  if (!hasContent) {
    return output.raw ? (
      <pre className="text-[10px] text-text-secondary font-mono whitespace-pre-wrap">
        {output.raw}
      </pre>
    ) : null;
  }

  return (
    <div className="space-y-2">
      {/* Overview - always visible */}
      {output.overview && (
        <div className="p-2.5 rounded-md bg-accent-green/5 border border-accent-green/20">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent-green mt-0.5 shrink-0" />
            <p className="text-xs text-text-primary leading-relaxed">{output.overview}</p>
          </div>
        </div>
      )}

      {/* Notes/Warnings - always visible if present */}
      {output.notes && output.notes.length > 0 && (
        <div className="space-y-1.5">
          {output.notes.map((note, i) => (
            <div
              key={i}
              className={clsx('p-2 rounded-md flex items-start gap-2', {
                'bg-accent-blue/5 border border-accent-blue/20': note.type === 'info',
                'bg-accent-yellow/5 border border-accent-yellow/20': note.type === 'warning',
                'bg-accent-red/5 border border-accent-red/20': note.type === 'error',
              })}
            >
              {note.type === 'info' && <Info className="w-3.5 h-3.5 text-accent-blue mt-0.5 shrink-0" />}
              {note.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-accent-yellow mt-0.5 shrink-0" />}
              {note.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-accent-red mt-0.5 shrink-0" />}
              <p className="text-[11px] text-text-secondary">{note.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Preview URLs - always visible if present */}
      {output.previewUrls && output.previewUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {output.previewUrls.map((url, i) => (
            <a
              key={i}
              href={url.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-accent-purple/10 text-accent-purple hover:bg-accent-purple/20 transition-colors text-xs"
            >
              <ExternalLink className="w-3 h-3" />
              {url.type || 'Preview'}
            </a>
          ))}
        </div>
      )}

      {/* Files Changed */}
      {output.filesChanged && output.filesChanged.length > 0 && (
        <ExpandableSection
          title="Files Changed"
          icon={<FileEdit className="w-3 h-3" />}
          count={output.filesChanged.length}
          accentColor="yellow"
        >
          <div className="space-y-2">
            {output.filesChanged.map((file, i) => (
              <div key={i} className="text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-text-primary truncate">{file.path}</span>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {file.linesAdded !== undefined && (
                      <span className="text-accent-green flex items-center gap-0.5">
                        <Plus className="w-2.5 h-2.5" />
                        {file.linesAdded}
                      </span>
                    )}
                    {file.linesRemoved !== undefined && (
                      <span className="text-accent-red flex items-center gap-0.5">
                        <Minus className="w-2.5 h-2.5" />
                        {file.linesRemoved}
                      </span>
                    )}
                  </div>
                </div>
                {file.diff && (
                  <pre className="text-[10px] font-mono bg-surface-raised p-2 rounded overflow-x-auto max-h-40">
                    {file.diff}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Files Created */}
      {output.filesCreated && output.filesCreated.length > 0 && (
        <ExpandableSection
          title="Files Created"
          icon={<FilePlus className="w-3 h-3" />}
          count={output.filesCreated.length}
          accentColor="green"
        >
          <div className="space-y-1">
            {output.filesCreated.map((file, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono text-text-primary truncate">{file.path}</span>
                {file.lines !== undefined && (
                  <span className="text-text-muted shrink-0 ml-2">{file.lines} lines</span>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Files Deleted */}
      {output.filesDeleted && output.filesDeleted.length > 0 && (
        <ExpandableSection
          title="Files Deleted"
          icon={<FileX className="w-3 h-3" />}
          count={output.filesDeleted.length}
          accentColor="red"
        >
          <div className="space-y-1">
            {output.filesDeleted.map((file, i) => (
              <div key={i} className="text-xs font-mono text-text-secondary line-through">
                {file.path}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Packages Installed */}
      {output.packagesInstalled && output.packagesInstalled.length > 0 && (
        <ExpandableSection
          title="Packages Installed"
          icon={<Package className="w-3 h-3" />}
          count={output.packagesInstalled.length}
          accentColor="blue"
        >
          <div className="flex flex-wrap gap-1.5">
            {output.packagesInstalled.map((pkg, i) => (
              <span
                key={i}
                className={clsx(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono',
                  pkg.dev
                    ? 'bg-accent-purple/10 text-accent-purple'
                    : 'bg-accent-blue/10 text-accent-blue'
                )}
              >
                {pkg.name}
                {pkg.version && <span className="text-text-muted">@{pkg.version}</span>}
                {pkg.dev && <span className="text-[9px]">(dev)</span>}
              </span>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* MCP Setup */}
      {output.mcpSetup && output.mcpSetup.length > 0 && (
        <ExpandableSection
          title="MCP Servers"
          icon={<Server className="w-3 h-3" />}
          count={output.mcpSetup.length}
          accentColor="purple"
        >
          <div className="space-y-1.5">
            {output.mcpSetup.map((server, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span
                  className={clsx('w-1.5 h-1.5 rounded-full', {
                    'bg-accent-green': server.status === 'installed' || server.status === 'configured',
                    'bg-accent-red': server.status === 'failed',
                  })}
                />
                <span className="font-medium text-text-primary">{server.name}</span>
                <span className="text-text-muted capitalize">{server.status}</span>
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Web Searches */}
      {output.webSearches && output.webSearches.length > 0 && (
        <ExpandableSection
          title="Web Searches"
          icon={<Search className="w-3 h-3" />}
          count={output.webSearches.length}
          accentColor="blue"
        >
          <div className="space-y-1">
            {output.webSearches.map((search, i) => (
              <div key={i} className="text-xs flex items-center justify-between">
                <span className="text-text-primary truncate">"{search.query}"</span>
                {search.resultsUsed !== undefined && (
                  <span className="text-text-muted shrink-0 ml-2">{search.resultsUsed} results used</span>
                )}
              </div>
            ))}
          </div>
        </ExpandableSection>
      )}

      {/* Tool Calls */}
      {output.toolCalls && output.toolCalls.length > 0 && (
        <ExpandableSection
          title="Tool Usage"
          icon={<Wrench className="w-3 h-3" />}
          count={output.toolCalls.reduce((sum, t) => sum + t.count, 0)}
          accentColor="blue"
        >
          <div className="flex flex-wrap gap-1.5">
            {output.toolCalls.map((tool, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-raised text-[10px]"
              >
                <span className="font-medium text-text-primary">{tool.name}</span>
                <span className="text-text-muted">×{tool.count}</span>
              </span>
            ))}
          </div>
        </ExpandableSection>
      )}
    </div>
  );
}
