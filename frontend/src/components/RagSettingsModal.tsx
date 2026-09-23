import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sliders } from 'lucide-react';
import { RagSettings as IRagSettings } from '../types/rag';
import { RagSettings } from './RagSettings';

interface RagSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: IRagSettings;
  onSettingsChange: (settings: IRagSettings) => void;
  onReset: () => void;
}

export const RagSettingsModal: React.FC<RagSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onReset,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-md bg-dark-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-dark-950/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-white">
                    Cấu Hình Siêu Tham Số RAG
                  </h3>
                  <p className="text-xs text-slate-400">
                    Tùy chỉnh Top-K, Chunk size & Cohere Rerank
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto custom-scrollbar flex-1">
              <RagSettings
                settings={settings}
                onChange={onSettingsChange}
                onReset={onReset}
              />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-dark-950/80 flex items-center justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-glow-sm transition"
              >
                Lưu & Đóng
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
