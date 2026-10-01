import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  UploadCloud, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Search, 
  Layers 
} from 'lucide-react';
import { DocumentItem } from '../types/rag';
import { formatBytes } from '../utils/formatters';
import { DocumentDeleteModal } from './DocumentDeleteModal';

interface DocumentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  documents: DocumentItem[];
  onUpload: (files: File[]) => Promise<void>;
  onDeleteDocument: (filename: string) => Promise<void>;
  onRefreshDocuments: () => Promise<void>;
  onClearAllDocuments: () => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
}

export const DocumentDrawer: React.FC<DocumentDrawerProps> = React.memo(({
  isOpen,
  onClose,
  documents,
  onUpload,
  onDeleteDocument,
  onRefreshDocuments,
  onClearAllDocuments,
  isUploading,
  uploadProgress,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onUpload(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onUpload(files);
      e.target.value = '';
    }
  };

  const totalChunks = documents.reduce((sum, d) => sum + (d.chunk_count || 0), 0);
  const totalSize = documents.reduce((sum, d) => sum + (d.file_size || 0), 0);

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

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white dark:bg-dark-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden text-slate-900 dark:text-slate-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-dark-950/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-0.5 shadow-glow-sm">
                  <div className="w-full h-full bg-white dark:bg-dark-900 rounded-[10px] flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <Layers className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-white">
                    Kho Tri Thức & Tài Liệu RAG
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Quản lý các tài liệu được nhúng vào ChromaDB
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Đóng"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Summary Stats */}
            <div className="grid grid-cols-3 gap-2.5 p-4 bg-slate-100/60 dark:bg-dark-850/60 border-b border-slate-200 dark:border-slate-800 text-xs">
              <div className="p-2.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Tài liệu</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">{documents.length}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Tổng văn bản trích (Chunk)</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono text-sm">{totalChunks}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Dung lượng</span>
                <span className="font-bold text-cyan-600 dark:text-cyan-400 font-mono text-sm">{formatBytes(totalSize)}</span>
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
              {/* Dropzone Upload */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`relative p-5 rounded-2xl border-2 border-dashed transition-all duration-200 text-center cursor-pointer ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 bg-slate-50/80 dark:bg-dark-950/60 hover:bg-slate-100 dark:hover:bg-dark-950 shadow-sm'
                }`}
              >
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.csv"
                  onChange={handleFileChange}
                  disabled={isUploading}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                />

                {isUploading ? (
                  <div className="space-y-3 py-2">
                    <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Đang phân tích và nhúng vector vào ChromaDB...
                      </p>
                      <div className="w-48 mx-auto bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                          style={{ width: `${uploadProgress || 65}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 py-1">
                    <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        Kéo thả tài liệu vào đây hoặc <span className="text-indigo-600 dark:text-indigo-400 underline">duyệt tệp</span>
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Hỗ trợ PDF, DOCX, TXT, MD, CSV (Tối đa 25MB)
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Search & Actions Bar */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm tài liệu..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  onClick={onRefreshDocuments}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                  title="Làm mới danh sách"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Documents List */}
              <div className="space-y-2">
                {filteredDocs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    Không tìm thấy tài liệu nào phù hợp.
                  </div>
                ) : (
                  filteredDocs.map((doc) => {
                    const isPdf = doc.filename.endsWith('.pdf');
                    const isDocx = doc.filename.endsWith('.docx') || doc.filename.endsWith('.doc');

                    return (
                      <div
                        key={doc.id || doc.filename}
                        className="group flex items-center justify-between p-3 rounded-xl bg-slate-50/90 dark:bg-dark-950/80 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition shadow-sm"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                              isPdf
                                ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-500/20'
                                : isDocx
                                ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-200 truncate" title={doc.filename}>
                              {doc.filename}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              <span>{formatBytes(doc.file_size)}</span>
                              <span>•</span>
                              <span>{doc.chunk_count || 0} đoạn trích</span>
                              <span>•</span>
                              {doc.status === 'indexed' ? (
                                <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Indexed
                                </span>
                              ) : doc.status === 'processing' ? (
                                <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400 font-medium">
                                  <Clock className="w-3 h-3 animate-spin" />
                                  Processing
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-medium">
                                  <AlertCircle className="w-3 h-3" />
                                  Failed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setDocToDelete(doc.filename)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition"
                          title="Xóa tài liệu khỏi RAG"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-dark-950/90 flex items-center justify-between">
              <button
                onClick={onClearAllDocuments}
                className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline"
              >
                Xóa toàn bộ tài liệu
              </button>

              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-xl transition"
              >
                Hoàn tất
              </button>
            </div>
          </motion.div>

          {/* Custom Dark-Themed Document Deletion Confirmation Modal */}
          <DocumentDeleteModal
            isOpen={Boolean(docToDelete)}
            onClose={() => setDocToDelete(null)}
            filename={docToDelete || ''}
            isDeleting={isDeleting}
            onConfirm={async () => {
              if (docToDelete) {
                try {
                  setIsDeleting(true);
                  await onDeleteDocument(docToDelete);
                } finally {
                  setIsDeleting(false);
                  setDocToDelete(null);
                }
              }
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
});

DocumentDrawer.displayName = 'DocumentDrawer';
