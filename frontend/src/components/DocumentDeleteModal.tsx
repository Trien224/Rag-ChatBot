import React from 'react';
import { Trash2, X } from 'lucide-react';

export interface DocumentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  filename: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export const DocumentDeleteModal: React.FC<DocumentDeleteModalProps> = ({
  isOpen,
  onClose,
  filename,
  onConfirm,
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in select-none"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5 animate-scale-up text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: Warning/Trash icon with title */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Xác nhận xóa tài liệu
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Thao tác này sẽ xóa vector embeddings khỏi ChromaDB
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Confirmation Message */}
        <div className="bg-slate-50 dark:bg-dark-950/80 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Bạn có chắc muốn xóa tài liệu <strong className="text-slate-900 dark:text-white font-semibold break-all">"{filename}"</strong> khỏi kho RAG?
        </div>

        {/* Actions: Hủy and Xác nhận xóa */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-medium shadow-sm transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xác nhận xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
};
