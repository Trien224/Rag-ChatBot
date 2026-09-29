import React, { useState } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  FileText, 
  Sparkles
} from 'lucide-react';
import { ChatMessage, ChatSession } from '../types/rag';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: ChatSession | null;
  messages: ChatMessage[];
  onCopySuccess: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  session,
  messages,
  onCopySuccess,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'http://localhost:5173';
  const shareLink = `${currentUrl.split('#')[0].split('?')[0]}?shared_session=${session?.id || 'chat'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    onCopySuccess();
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyTranscript = () => {
    let transcript = `📋 ${session?.title || 'Cuộc trò chuyện RAG'}\n`;
    transcript += `==========================================\n\n`;
    messages.forEach((m) => {
      const role = m.role === 'user' ? '👤 Người dùng' : '🤖 Trợ lý RAG';
      transcript += `${role}:\n${m.content}\n\n`;
    });

    navigator.clipboard.writeText(transcript);
    setCopiedText(true);
    onCopySuccess();
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden transition-all transform scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Chia sẻ cuộc trò chuyện
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]">
                {session?.title || 'Cuộc hội thoại'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Info pill */}
          <div className="flex items-start gap-3 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-indigo-800 dark:text-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs leading-relaxed">
              Bất kỳ ai có liên kết này đều có thể xem ảnh chụp nhanh nội dung cuộc trò chuyện cùng các trích dẫn tài liệu tham khảo.
            </p>
          </div>

          {/* Link box */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Liên kết công khai
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareLink}
                className="flex-1 px-3 py-2 bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-200 font-mono select-all outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-sm transition shrink-0 active:scale-95"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Alternative: Copy Full Text */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              Tổng số tin nhắn: <strong>{messages.length}</strong>
            </span>
            <button
              onClick={handleCopyTranscript}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-750 transition"
            >
              {copiedText ? <Check className="w-3 h-3 text-emerald-500" /> : <FileText className="w-3 h-3" />}
              <span>{copiedText ? 'Đã sao chép văn bản' : 'Sao chép dạng văn bản'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 bg-slate-50/80 dark:bg-dark-950/60 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition text-xs"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
