import React, { useState } from 'react';
import { 
  Menu, 
  Layers, 
  Sparkles,
  Download,
  Pin
} from 'lucide-react';
import { ChatActionMenu } from './ChatActionMenu';
import { NtuEduBotIcon } from './NtuBotIcon';

interface ChatHeaderProps {
  sessionTitle: string;
  isPinned?: boolean;
  onToggleSidebar: () => void;
  onOpenDocumentDrawer?: () => void;
  onOpenSettings?: () => void;
  onExportChat: () => void;
  onClearChat?: () => void;
  onShareChat?: () => void;
  onTogglePin?: () => void;
  onRenameChat?: () => void;
  onDownloadPdf?: () => void;
  onExportDoc?: () => void;
  onDeleteChat?: () => void;
  messageCount: number;
  docCount: number;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
  sessionTitle,
  isPinned = false,
  onToggleSidebar,
  onOpenDocumentDrawer,
  onExportChat,
  onDownloadPdf,
  onExportDoc,
  docCount,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3 sm:px-5 py-3 bg-white/90 dark:bg-[#131314]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-white/5 transition-colors duration-200 select-none">
      {/* Left section: Sidebar toggle & Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0 mr-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
          title="Bật/Tắt thanh điều khiển (Sidebar)"
          aria-label="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isPinned && (
              <span title="Đoạn chat đã ghim" className="inline-flex items-center">
                <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
              </span>
            )}
            <h1 className="text-sm font-semibold text-slate-900 dark:text-white font-display break-words whitespace-normal leading-snug">
              {sessionTitle || 'NTU EduBot'}
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0 select-none shadow-sm">
              <NtuEduBotIcon className="w-5 h-5 rounded-md object-contain shrink-0" />
              <span>NTU EduBot • Trợ Lý Học Vụ</span>
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

      {/* Right Action Bar: Session Export Dropdown Button with Download Icon */}
      <div className="relative shrink-0">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`p-2 rounded-full transition-all duration-200 ${
            isMenuOpen
              ? 'bg-slate-200 dark:bg-white/15 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10'
          }`}
          title="Xuất cuộc trò chuyện"
          aria-label="Export chat"
        >
          <Download className="w-5 h-5 text-gray-400" />
        </button>

        {/* Document Export Options Popup Menu */}
        <ChatActionMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
          onExportMarkdown={onExportChat}
          onDownloadPdf={() => onDownloadPdf?.()}
          onExportDoc={() => onExportDoc?.()}
          positionClass="right-0 top-full mt-2"
        />
      </div>
    </header>
  );
});

ChatHeader.displayName = 'ChatHeader';


