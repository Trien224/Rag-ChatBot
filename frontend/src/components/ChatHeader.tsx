import React from 'react';
import { 
  Menu, 
  Download, 
  Layers, 
  Sparkles,
  Sun,
  Moon,
  Sliders,
  Trash2
} from 'lucide-react';

interface ChatHeaderProps {
  sessionTitle: string;
  onToggleSidebar: () => void;
  onOpenDocumentDrawer?: () => void;
  onOpenSettings?: () => void;
  onExportChat: () => void;
  onClearChat?: () => void;
  messageCount: number;
  docCount: number;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
  sessionTitle,
  onToggleSidebar,
  onOpenDocumentDrawer,
  onOpenSettings,
  onExportChat,
  onClearChat,
  messageCount,
  docCount,
  isDarkMode,
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-5 py-3 bg-white/80 dark:bg-dark-900/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-200 select-none">
      {/* Left section: Sidebar toggle & Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Bật/Tắt thanh điều khiển (Sidebar)"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-slate-900 dark:text-white font-display truncate max-w-[180px] sm:max-w-xs md:max-w-md lg:max-w-lg">
              {sessionTitle || 'RAG Document Assistant'}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              RAG Active
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            {onOpenDocumentDrawer ? (
              <button
                onClick={onOpenDocumentDrawer}
                className="flex items-center gap-1 hover:text-cyan-600 dark:hover:text-cyan-300 transition underline-offset-2 hover:underline"
                title="Xem danh sách tài liệu đang kết nối"
              >
                <Layers className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                <span>{docCount} Tài liệu kết nối</span>
              </button>
            ) : (
              <span className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400">
                <Layers className="w-3 h-3" />
                <span>{docCount} Tài liệu kết nối</span>
              </span>
            )}
            <span>•</span>
            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-3 h-3" />
              Gemini 2.5 Flash
            </span>
          </div>
        </div>
      </div>

      {/* Right Action Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="p-2 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={isDarkMode ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
            aria-label="Toggle Theme"
          >
            {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        )}

        {/* Hyperparameter Settings Button */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Cấu hình tham số RAG & Mô hình"
            aria-label="RAG Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>
        )}

        {/* Clear Chat Button */}
        {onClearChat && messageCount > 0 && (
          <button
            onClick={onClearChat}
            className="p-2 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition hidden sm:flex"
            title="Xóa đoạn hội thoại hiện tại"
            aria-label="Clear chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Export Markdown Button */}
        <button
          onClick={onExportChat}
          disabled={messageCount === 0}
          className="p-2 sm:px-3 sm:py-2 flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-dark-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl transition shadow-sm disabled:opacity-40 disabled:pointer-events-none group"
          title="Tải xuống nội dung trò chuyện (Xuất Markdown)"
          aria-label="Tải xuống Markdown"
        >
          <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors" />
          <span className="hidden sm:inline font-medium">Xuất MD</span>
        </button>
      </div>
    </header>
  );
});

ChatHeader.displayName = 'ChatHeader';
