import React from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { ToastMessage } from '../types/rag';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = React.memo(({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-3">
      {toasts.map((toast) => {
        let icon = <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0" />;
        let borderClass = 'border-cyan-500/30 bg-white/95 dark:bg-dark-850/95 text-slate-800 dark:text-cyan-100 shadow-glow-accent';

        if (toast.type === 'success') {
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
          borderClass = 'border-emerald-500/30 bg-white/95 dark:bg-dark-850/95 text-slate-800 dark:text-emerald-100 shadow-md';
        } else if (toast.type === 'error') {
          icon = <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />;
          borderClass = 'border-rose-500/30 bg-white/95 dark:bg-dark-850/95 text-slate-800 dark:text-rose-100 shadow-md';
        } else if (toast.type === 'warning') {
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />;
          borderClass = 'border-amber-500/30 bg-white/95 dark:bg-dark-850/95 text-slate-800 dark:text-amber-100 shadow-md';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg transition-all animate-slide-up ${borderClass}`}
          >
            <div className="flex items-center gap-3 text-sm font-medium">
              {icon}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
              aria-label="Dismiss toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
});

Toast.displayName = 'Toast';
