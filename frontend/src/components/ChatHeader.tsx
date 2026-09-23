import React from 'react';
import { 
  Menu, 
  Download, 
  Trash2, 
  Layers, 
  Sparkles, 
  Sun, 
  Moon, 
  Sliders 
} from 'lucide-react';

interface ChatHeaderProps {
  sessionTitle: string;
  onToggleSidebar: () => void;
  onOpenDocumentDrawer: () => void;
  onOpenSettings: () => void;
  onExportChat: () => void;
  onClearChat: () => void;
  messageCount: number;
  docCount: number;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
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
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-dark-900/80 backdrop-blur-md border-b border-slate-800/80 transition-colors duration-200">
      {/* Left section: Sidebar toggle & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          title="Bật/Tắt thanh điều khiển"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-white font-display truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {sessionTitle || 'RAG Document Assistant'}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              RAG Active
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <button
              onClick={onOpenDocumentDrawer}
              className="flex items-center gap-1 hover:text-cyan-300 transition underline-offset-2 hover:underline"
              title="Xem danh sách tài liệu đang kết nối"
            >
              <Layers className="w-3 h-3 text-cyan-400" />
              <span>{docCount} Tài liệu kết nối</span>
            </button>
            <span>•</span>
            <span className="flex items-center gap-1 text-indigo-400">
              <Sparkles className="w-3 h-3" />
              Gemini 3.6 Flash
            </span>
          </div>
        </div>
      </div>

      {/* Right Action Bar */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-white rounded-xl bg-dark-850 hover:bg-dark-800 border border-slate-800 transition"
          title="Cấu hình RAG"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* Document Drawer Shortcut */}
        <button
          onClick={onOpenDocumentDrawer}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-dark-850 hover:bg-dark-800 border border-slate-800 rounded-xl transition shadow-sm"
          title="Mở Kho tài liệu RAG"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Kho Tài Liệu</span>
        </button>

        {/* Export Chat */}
        <button
          onClick={onExportChat}
          disabled={messageCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-dark-850 hover:bg-dark-800 border border-slate-800 rounded-xl transition disabled:opacity-40 disabled:pointer-events-none shadow-sm"
          title="Xuất nội dung trò chuyện (Markdown)"
        >
          <Download className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Xuất Markdown</span>
        </button>

        {/* Clear Chat */}
        <button
          onClick={onClearChat}
          disabled={messageCount === 0}
          className="p-2 sm:px-3 sm:py-1.5 flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition disabled:opacity-40 disabled:pointer-events-none"
          title="Xóa tin nhắn trong đoạn chat này"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Xóa Hội Thoại</span>
        </button>

        {/* Theme Mode Toggle (Header) */}
        <button
          onClick={onToggleTheme}
          className="p-2 text-slate-400 hover:text-amber-400 rounded-xl hover:bg-slate-800/80 transition"
          title={isDarkMode ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
