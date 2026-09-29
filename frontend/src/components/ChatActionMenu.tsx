import React, { useEffect, useRef } from 'react';
import { 
  Share,
  Pin,
  PinOff,
  Pencil,
  Download, 
  FileText, 
  FileCode,
  Trash2
} from 'lucide-react';

export interface ChatActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isPinned?: boolean;
  onShare?: () => void;
  onTogglePin?: () => void;
  onRename?: () => void;
  onDownloadPdf?: () => void;
  onExportDoc?: () => void;
  onExportMarkdown?: () => void;
  onOpenSettings?: () => void;
  onClearMessages?: () => void;
  onDelete?: () => void;
  positionClass?: string;
}

export const ChatActionMenu: React.FC<ChatActionMenuProps> = ({
  isOpen,
  onClose,
  isPinned = false,
  onShare,
  onTogglePin,
  onRename,
  onDownloadPdf,
  onExportDoc,
  onExportMarkdown,
  onDelete,
  positionClass = 'right-0 top-full mt-2',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay attaching listener so the click that opened the menu does not immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasSessionActions = Boolean(onShare || onTogglePin || onRename);
  const hasExportActions = Boolean(onExportMarkdown || onDownloadPdf || onExportDoc);
  const hasDeleteAction = Boolean(onDelete);

  return (
    <div
      ref={menuRef}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      className={`absolute z-50 min-w-[210px] w-56 rounded-2xl bg-white dark:bg-[#1e1f20] border border-slate-200/90 dark:border-white/10 p-1.5 shadow-2xl backdrop-blur-md animate-fade-in text-slate-800 dark:text-slate-100 select-none ${positionClass}`}
    >
      <div className="space-y-0.5">
        {/* Session Actions: Share */}
        {onShare && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onShare();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] font-normal text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-white/10 rounded-xl transition-colors duration-150 group"
          >
            <Share className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
            <span>Chia sẻ cuộc trò chuyện</span>
          </button>
        )}

        {/* Session Actions: Pin / Unpin */}
        {onTogglePin && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onTogglePin();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] font-normal text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-white/10 rounded-xl transition-colors duration-150 group"
          >
            {isPinned ? (
              <>
                <PinOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Bỏ ghim</span>
              </>
            ) : (
              <>
                <Pin className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-amber-500 shrink-0" />
                <span>Ghim</span>
              </>
            )}
          </button>
        )}

        {/* Session Actions: Rename */}
        {onRename && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onRename();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] font-normal text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-white/10 rounded-xl transition-colors duration-150 group"
          >
            <Pencil className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
            <span>Đổi tên</span>
          </button>
        )}

        {/* Divider if session actions exist before export actions */}
        {hasSessionActions && hasExportActions && (
          <div className="h-px bg-slate-200/80 dark:bg-white/10 my-1" />
        )}

        {/* Document Export Actions: Markdown */}
        {onExportMarkdown && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onExportMarkdown();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] font-normal text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-white/10 rounded-xl transition-colors duration-150 group"
          >
            <FileCode className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 shrink-0" />
            <span>Xuất tệp Markdown (.md)</span>
          </button>
        )}

        {/* Document Export Actions: PDF */}
        {onDownloadPdf && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onDownloadPdf();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] font-normal text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-white/10 rounded-xl transition-colors duration-150 group"
          >
            <Download className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 shrink-0" />
            <span>Tải bản PDF xuống</span>
          </button>
        )}

        {/* Document Export Actions: DOC */}
        {onExportDoc && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onExportDoc();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] font-normal text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/90 dark:hover:bg-white/10 rounded-xl transition-colors duration-150 group"
          >
            <FileText className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
            <span>Xuất sang Tài liệu (.doc)</span>
          </button>
        )}

        {/* Divider before Delete Action */}
        {hasDeleteAction && (hasSessionActions || hasExportActions) && (
          <div className="h-px bg-slate-200/80 dark:bg-white/10 my-1" />
        )}

        {/* Session Actions: Delete Chat */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
              onDelete();
            }}
            className="flex items-center gap-3 w-full px-3 py-2 text-left text-[13px] font-normal text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors duration-150 group"
          >
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>Xoá đoạn chat này</span>
          </button>
        )}
      </div>
    </div>
  );
};


