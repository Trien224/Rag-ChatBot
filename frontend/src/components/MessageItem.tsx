import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { 
  User, 
  Copy, 
  Check, 
  Clock, 
  Sparkles, 
  ThumbsUp, 
  ThumbsDown, 
  RotateCw, 
  Bookmark, 
  FileText, 
  Paperclip,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ChatMessage, SourceItem } from '../types/rag';
import { formatLatency, formatTime, formatPercentage } from '../utils/formatters';
import { NtuEduBotIcon } from './NtuBotIcon';

interface MessageItemProps {
  message: ChatMessage;
  onCopy: (text: string) => void;
  onRegenerate?: () => void;
  onFeedback?: (id: string, feedback: 'like' | 'dislike') => void;
  onOpenSourceModal?: (sources: SourceItem[], index: number) => void;
}

// Sub-component for individual Code Block with 1-click Copy
const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 shadow-md">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <span className="uppercase font-semibold tracking-wider text-indigo-400">
          {language || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] hover:text-white transition px-2 py-0.5 rounded hover:bg-slate-800"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans">Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans">Sao chép</span>
            </>
          )}
        </button>
      </div>
      <div className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed custom-scrollbar">
        <code>{value}</code>
      </div>
    </div>
  );
};

export const MessageItem: React.FC<MessageItemProps> = React.memo(({
  message,
  onCopy,
  onRegenerate,
  onFeedback,
  onOpenSourceModal,
}) => {
  const [copied, setCopied] = useState(false);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex gap-3 sm:gap-3.5 p-3.5 sm:p-4 rounded-2xl transition-all duration-200 animate-slide-up ${
        isUser
          ? 'bg-indigo-50/80 dark:bg-dark-850/80 border border-indigo-100 dark:border-slate-800/90 ml-4 sm:ml-16 text-slate-900 dark:text-slate-100 shadow-sm'
          : 'bg-white dark:bg-dark-900/95 border border-slate-200/90 dark:border-slate-800 mr-2 sm:mr-10 text-slate-800 dark:text-slate-200 shadow-sm'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-glow-sm overflow-hidden ${
          isUser
            ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white'
            : 'bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 p-0.5'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <NtuEduBotIcon className="w-full h-full" />}
      </div>

      {/* Content Body */}
      <div className="flex-1 min-w-0 space-y-2.5">
        {/* Author & Meta Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-200 font-display">
              {isUser ? 'Bạn' : 'NTU EduBot'}
            </span>
            {!isUser && (
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                <Sparkles className="w-2.5 h-2.5" />
                {message.model || 'NTU EduBot • Gemini'}
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
              {formatTime(message.timestamp)}
            </span>
          </div>

          {!isUser && (
            <div className="flex items-center gap-2">
              {message.latency !== undefined && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {formatLatency(message.latency)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Attached Files Chips for User message */}
        {isUser && message.attachments && message.attachments.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pb-1">
            {message.attachments.map((att, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-dark-950 border border-indigo-200 dark:border-slate-700/80 text-[11px] text-indigo-700 dark:text-indigo-300 font-mono"
              >
                <Paperclip className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                <span>{att.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Thinking / Chunk Searching Accordion */}
        {!isUser && (message.isThinking || (message.sources && message.sources.length > 0)) && (
          <div className="rounded-xl bg-slate-50 dark:bg-dark-950/70 border border-slate-200 dark:border-slate-800/80 overflow-hidden text-xs">
            <button
              onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
              className="w-full flex items-center justify-between p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition"
            >
              <div className="flex items-center gap-2">
                <Search className={`w-3.5 h-3.5 ${message.isThinking ? 'text-indigo-600 dark:text-indigo-400 animate-spin' : 'text-emerald-600 dark:text-emerald-400'}`} />
                <span className="font-medium text-[11px]">
                  {message.isThinking
                    ? 'Đang tìm kiếm chunks trong ChromaDB & xếp hạng bằng Cohere...'
                    : `Đã đối soát ${message.sources?.length || 0} đoạn trích văn bản từ tài liệu`}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                {isThinkingExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </div>
            </button>

            {isThinkingExpanded && message.sources && (
              <div className="p-2.5 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5 bg-slate-100/50 dark:bg-dark-900/40 text-[11px]">
                {message.sources.map((src, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="truncate pr-2 font-mono text-slate-600 dark:text-slate-400">
                      [{idx + 1}] {src.source} (Trang {src.page ?? 1})
                    </span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-semibold shrink-0">
                      {formatPercentage(src.similarity ?? 0.9)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Skeleton loading when thinking with no content yet */}
        {!isUser && message.isStreaming && !message.content && (
          <div className="space-y-2 py-2">
            <div className="h-3.5 bg-slate-200 dark:bg-slate-800 rounded-lg w-3/4 animate-pulse" />
            <div className="h-3.5 bg-slate-200/70 dark:bg-slate-800/70 rounded-lg w-full animate-pulse" />
            <div className="h-3.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-lg w-1/2 animate-pulse" />
          </div>
        )}

        {/* Markdown Rendered Content */}
        {message.content && (
          <div className="prose prose-slate dark:prose-invert prose-sm max-w-none text-slate-800 dark:text-slate-200 font-sans leading-relaxed break-words">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-slate-700 dark:text-slate-300">{children}</li>,
                code: ({ inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const rawString = String(children).replace(/\n$/, '');
                  return !inline ? (
                    <CodeBlock language={match ? match[1] : undefined} value={rawString} />
                  ) : (
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-dark-950 font-mono text-indigo-600 dark:text-cyan-300 text-xs border border-slate-200 dark:border-slate-800" {...props}>
                      {children}
                    </code>
                  );
                },
                strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>,
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-dark-950/60">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-xs">{children}</table>
                  </div>
                ),
                th: ({ children }) => <th className="px-3 py-2 bg-slate-100 dark:bg-dark-900 text-left text-xs font-bold text-slate-800 dark:text-slate-200">{children}</th>,
                td: ({ children }) => <td className="px-3 py-2 border-t border-slate-200 dark:border-slate-800/60 text-xs text-slate-700 dark:text-slate-300">{children}</td>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-indigo-500 pl-3 py-1 my-2 bg-indigo-50/50 dark:bg-indigo-500/5 text-slate-700 dark:text-slate-300 italic text-xs rounded-r-lg">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>

            {message.isStreaming && (
              <span className="inline-block w-2 h-4 ml-1 bg-indigo-500 animate-pulse align-middle" />
            )}
          </div>
        )}

        {/* RAG Source Citation Badge Pills */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Bookmark className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
              <span>Nguồn trích dẫn:</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {message.sources.map((src, idx) => {
                const sim = src.similarity ?? (src.distance !== undefined ? 1 - src.distance : 0.9);
                return (
                  <button
                    key={idx}
                    onClick={() => onOpenSourceModal && onOpenSourceModal(message.sources!, idx)}
                    className="group flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-950 dark:hover:bg-dark-850 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs transition shadow-sm cursor-pointer"
                    title="Nhấp để xem đoạn trích dẫn đầy đủ trong tài liệu"
                  >
                    <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      [{idx + 1}]
                    </span>
                    <FileText className="w-3 h-3 text-cyan-600 dark:text-cyan-400 shrink-0" />
                    <span className="max-w-[150px] truncate text-[11px] font-medium">
                      {src.source}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      (Trang {src.page ?? 1})
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold pl-0.5">
                      {formatPercentage(sim)}
                    </span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-500 ml-0.5" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Action utility bar for Assistant message */}
        {!isUser && !message.isStreaming && (
          <div className="flex items-center justify-between pt-1 text-slate-500 dark:text-slate-400 text-xs">
            <div className="flex items-center gap-1">
              {/* Copy answer */}
              <button
                onClick={handleCopy}
                className="p-1.5 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1"
                title="Sao chép nội dung câu trả lời"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px] text-emerald-500 font-medium">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[10px]">Sao chép</span>
                  </>
                )}
              </button>

              {/* Regenerate */}
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="p-1.5 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center gap-1"
                  title="Tạo lại câu trả lời"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Tạo lại</span>
                </button>
              )}

              {/* Feedback Likes */}
              {onFeedback && (
                <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => onFeedback(message.id, 'like')}
                    className={`p-1.5 rounded-lg transition ${
                      message.feedback === 'like'
                        ? 'text-emerald-500 bg-emerald-500/10'
                        : 'text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Câu trả lời hữu ích"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onFeedback(message.id, 'dislike')}
                    className={`p-1.5 rounded-lg transition ${
                      message.feedback === 'dislike'
                        ? 'text-rose-500 bg-rose-500/10'
                        : 'text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                    title="Câu trả lời chưa chính xác"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">
              ChromaDB RAG Guard
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';
