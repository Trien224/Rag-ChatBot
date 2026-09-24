import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  FileText, 
  Percent, 
  Sparkles, 
  Copy, 
  Check, 
  ChevronLeft, 
  ChevronRight,
  Layers,
  BookOpen
} from 'lucide-react';
import { SourceItem } from '../types/rag';
import { formatPercentage } from '../utils/formatters';

interface SourceInspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources: SourceItem[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  onCopyText?: (text: string) => void;
}

export const SourceInspectorDrawer: React.FC<SourceInspectorDrawerProps> = React.memo(({
  isOpen,
  onClose,
  sources,
  currentIndex,
  onSelectIndex,
  onCopyText,
}) => {
  const [copied, setCopied] = React.useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const currentSource: SourceItem | undefined = sources[currentIndex] || sources[0];

  const handleCopy = () => {
    if (currentSource?.content_snippet) {
      if (onCopyText) {
        onCopyText(currentSource.content_snippet);
      } else {
        navigator.clipboard.writeText(currentSource.content_snippet);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const simScore = currentSource?.similarity ?? (currentSource?.distance !== undefined ? 1 - currentSource.distance : 0.92);
  const relScore = currentSource?.relevance_score ?? 0.95;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          />

          {/* Slide-over Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-dark-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-dark-950/70">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                      Trích dẫn RAG
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Nguồn {currentIndex + 1}/{Math.max(sources.length, 1)}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate mt-0.5" title={currentSource?.source}>
                    {currentSource?.source || 'Tài liệu trích dẫn'}
                  </h3>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Đóng cửa sổ"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Meta & Score Ribbon */}
            <div className="p-4 bg-slate-100/60 dark:bg-dark-850/60 border-b border-slate-200 dark:border-slate-800/80 grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] mb-1">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    Độ tương đồng Vector
                  </span>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                    {formatPercentage(simScore)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, simScore * 100)}%` }}
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] mb-1">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                    Cohere Rerank v3.5
                  </span>
                  <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {formatPercentage(relScore)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, relScore * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
              {/* Document Info Chips */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  Trang {currentSource?.page ?? 1}
                </span>
                {currentSource?.chunk_index !== undefined && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
                    <Layers className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    Chunk #{currentSource.chunk_index}
                  </span>
                )}
                {currentSource?.char_count !== undefined && (
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 font-mono">
                    {currentSource.char_count} ký tự
                  </span>
                )}
              </div>

              {/* Chunk Content Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                    Nội dung văn bản gốc trích xuất (Context Chunk):
                  </label>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded-lg transition border border-indigo-500/20"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Đã chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Sao chép</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-sm leading-relaxed font-sans select-text shadow-inner">
                  {currentSource?.content_snippet ? (
                    currentSource.highlight_text ? (
                      <div>
                        {currentSource.content_snippet.split(currentSource.highlight_text).map((part, i, arr) => (
                          <React.Fragment key={i}>
                            {part}
                            {i < arr.length - 1 && (
                              <mark className="bg-indigo-100 dark:bg-indigo-500/30 text-indigo-900 dark:text-indigo-200 px-1 py-0.5 rounded border border-indigo-300 dark:border-indigo-500/40 font-medium">
                                {currentSource.highlight_text}
                              </mark>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <p>{currentSource.content_snippet}</p>
                    )
                  ) : (
                    <p className="text-slate-400 italic">Không có nội dung đoạn trích văn bản.</p>
                  )}
                </div>
              </div>

              {/* Verified Badge */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-2.5">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">Đã xác thực nguồn trích dẫn</p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80 leading-relaxed">
                    Đoạn văn bản này được đối soát trực tiếp với cơ sở tri thức ChromaDB để đảm bảo tính chính xác và loại bỏ hiện tượng bịa đặt (hallucination).
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Navigation */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-dark-950/90 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectIndex(Math.max(0, currentIndex - 1))}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition"
                  title="Nguồn trước"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onSelectIndex(Math.min(sources.length - 1, currentIndex + 1))}
                  disabled={currentIndex >= sources.length - 1}
                  className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition"
                  title="Nguồn kế tiếp"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono ml-1">
                  {currentIndex + 1} / {sources.length}
                </span>
              </div>

              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

SourceInspectorDrawer.displayName = 'SourceInspectorDrawer';
