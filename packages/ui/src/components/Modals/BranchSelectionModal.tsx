import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-react';
import { clsx } from 'clsx';

interface BranchOption {
  id: string;
  title: string;
  description: string;
  pros?: string;
  cons?: string;
}

interface BranchSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeTitle: string;
  branches: BranchOption[];
  selectedBranchId?: string;
  onSelect: (branchId: string) => void;
}

export function BranchSelectionModal({
  isOpen,
  onClose,
  nodeTitle,
  branches,
  selectedBranchId,
  onSelect,
}: BranchSelectionModalProps) {
  const handleSelect = (branchId: string) => {
    onSelect(branchId);
    onClose();
  };

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
              className="w-full max-w-lg pointer-events-auto"
            >
            <div className="bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-border bg-surface-raised/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">
                      Choose a Path
                    </h2>
                    <p className="text-sm text-text-muted mt-0.5">
                      After: <span className="text-text-secondary">{nodeTitle}</span>
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

              {/* Branch Options */}
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-3">
                  {branches.map((branch, index) => {
                    const isSelected = selectedBranchId === branch.id;

                    return (
                      <motion.button
                        key={branch.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => handleSelect(branch.id)}
                        className={clsx(
                          'w-full text-left p-4 rounded-xl border-2 transition-all duration-200',
                          'hover:shadow-lg hover:scale-[1.01]',
                          {
                            'border-accent-green bg-accent-green/10 shadow-glow-green': isSelected,
                            'border-border hover:border-accent-blue/50 bg-surface-raised': !isSelected,
                          }
                        )}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-text-primary flex items-center gap-2">
                            <ChevronRight className={clsx(
                              'w-4 h-4 transition-transform',
                              isSelected && 'text-accent-green rotate-90'
                            )} />
                            {branch.title}
                          </h4>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-6 h-6 rounded-full bg-accent-green flex items-center justify-center"
                            >
                              <Check className="w-4 h-4 text-white" />
                            </motion.div>
                          )}
                        </div>

                        {/* Description */}
                        {branch.description && (
                          <p className="text-sm text-text-muted ml-6 mb-3">
                            {branch.description}
                          </p>
                        )}

                        {/* Pros and Cons */}
                        {(branch.pros || branch.cons) && (
                          <div className="grid grid-cols-2 gap-3 ml-6 pt-3 border-t border-border/50">
                            {branch.pros && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ThumbsUp className="w-3.5 h-3.5 text-accent-green" />
                                  <span className="text-xs text-accent-green font-medium uppercase">
                                    Pros
                                  </span>
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                  {branch.pros}
                                </p>
                              </div>
                            )}
                            {branch.cons && (
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ThumbsDown className="w-3.5 h-3.5 text-accent-red" />
                                  <span className="text-xs text-accent-red font-medium uppercase">
                                    Cons
                                  </span>
                                </div>
                                <p className="text-xs text-text-secondary leading-relaxed">
                                  {branch.cons}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border bg-surface-raised/30">
                <p className="text-xs text-text-muted text-center">
                  Select one path to continue. You can change this later.
                </p>
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
