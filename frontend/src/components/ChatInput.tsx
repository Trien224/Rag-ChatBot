import React, { useRef, useEffect, useState } from 'react';
import { Send, Square, Paperclip, X, FileText, ShieldCheck } from 'lucide-react';
import { ChatAttachment } from '../types/rag';

interface ChatInputProps {
  input: string;
  onChange: (value: string) => void;
  onSend: (attachments?: ChatAttachment[]) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onChange,
  onSend,
  onStop,
  isLoading,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && (input.trim() || attachments.length > 0)) {
        handleSend();
      }
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newAtts: ChatAttachment[] = Array.from(e.target.files).map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
      }));
      setAttachments((prev) => [...prev, ...newAtts]);
      e.target.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isLoading || disabled) return;
    onSend(attachments);
    setAttachments([]);
  };

  return (
    <div className="p-3 sm:p-4 bg-dark-950/85 backdrop-blur-md border-t border-slate-800/80 transition-colors duration-200">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Attached files preview chips */}
        {attachments.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pb-1">
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-dark-900 border border-indigo-500/40 text-xs text-slate-200 font-mono"
              >
                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                <span className="truncate max-w-[150px]">{att.name}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="p-0.5 text-slate-400 hover:text-rose-400 rounded transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className="relative rounded-2xl bg-dark-900 border border-slate-800 focus-within:border-indigo-500/60 focus-within:shadow-glow-sm transition-all duration-200 flex flex-col">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Hỏi bất kỳ điều gì từ tài liệu của bạn... (Enter để gửi, Shift + Enter để xuống dòng)"
            className="w-full bg-transparent p-3.5 pr-20 text-sm text-slate-100 placeholder-slate-500 resize-none outline-none font-sans max-h-44 custom-scrollbar"
          />

          {/* Action buttons (Paperclip + Send/Stop) */}
          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
            {/* Paperclip Button */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept=".pdf,.docx,.txt,.md,.csv"
              onChange={handleFileAttach}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-xl hover:bg-slate-800 transition"
              title="Đính kèm tệp tài liệu để hỏi đáp"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Send or Stop Button */}
            {isLoading ? (
              <button
                onClick={onStop}
                className="w-8 h-8 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 flex items-center justify-center transition-all shadow-sm cursor-pointer"
                title="Dừng sinh câu trả lời"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={(!input.trim() && attachments.length === 0) || disabled}
                className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none shadow-glow-sm cursor-pointer"
                title="Gửi câu hỏi"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Disclaimer Footer Note */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-0.5">
          <p className="flex items-center gap-1 truncate">
            <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>AI có thể tạo ra thông tin không chính xác. Hãy kiểm tra các nguồn trích dẫn đối chiếu.</span>
          </p>
          <span className="hidden sm:inline font-mono text-[10px] text-slate-500 shrink-0 pl-2">
            RAG v2.0 • ChromaDB
          </span>
        </div>
      </div>
    </div>
  );
};
