import React from 'react';
import { Sliders, Cpu, Database, Split, Sparkles } from 'lucide-react';
import { RagSettings as IRagSettings } from '../types/rag';

interface RagSettingsProps {
  settings: IRagSettings;
  onChange: (newSettings: IRagSettings) => void;
  onReset: () => void;
}

export const RagSettings: React.FC<RagSettingsProps> = React.memo(({
  settings,
  onChange,
  onReset,
}) => {
  const handleChange = <K extends keyof IRagSettings>(key: K, value: IRagSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-1 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Siêu tham số RAG</span>
        </div>
        <button
          onClick={onReset}
          className="text-[11px] text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-300 underline underline-offset-2 transition cursor-pointer"
        >
          Khôi phục mặc định
        </button>
      </div>

      {/* Top-K Chunks */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">Số lượng văn bản</span>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
            {settings.top_k}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={settings.top_k}
          onChange={(e) => handleChange('top_k', parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-slate-200 dark:bg-dark-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Số lượng đoạn trích liên quan nhất được chọn lọc để đưa vào cho AI đọc.
        </p>
      </div>

      {/* Chunk Size */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">Quét số ký tự</span>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
            {settings.chunk_size}
          </span>
        </div>
        <input
          type="range"
          min={300}
          max={2000}
          step={50}
          value={settings.chunk_size}
          onChange={(e) => handleChange('chunk_size', parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-slate-200 dark:bg-dark-900 rounded-lg appearance-none cursor-pointer accent-cyan-500"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Độ dài ký tự tối đa của mỗi đoạn văn khi chia nhỏ tài liệu.
        </p>
      </div>

      {/* Chunk Overlap */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">Vòng lặp (Độ gối đầu văn bản)</span>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-violet-500/10 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-500/30">
            {settings.chunk_overlap}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={400}
          step={25}
          value={settings.chunk_overlap}
          onChange={(e) => handleChange('chunk_overlap', parseInt(e.target.value, 10))}
          className="w-full h-1.5 bg-slate-200 dark:bg-dark-900 rounded-lg appearance-none cursor-pointer accent-violet-500"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Số ký tự lặp lại giữa hai đoạn liền kề để tránh mất ngữ cảnh.
        </p>
      </div>

      {/* Temperature */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-700 dark:text-slate-300">Độ chính xác</span>
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            {settings.temperature.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min={0.0}
          max={1.0}
          step={0.05}
          value={settings.temperature}
          onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-200 dark:bg-dark-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Kéo về mức thấp (0.0 - 0.2) để trả lời chính xác theo tài liệu; kéo cao để câu văn tự nhiên, linh hoạt hơn.
        </p>
      </div>

      {/* Toggles */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 dark:bg-dark-850/60 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div>
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">Cohere Rerank v3.5</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Tái xếp hạng Cross-Encoder thông minh</div>
          </div>
          <input
            type="checkbox"
            checked={settings.use_rerank}
            onChange={(e) => handleChange('use_rerank', e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-400 bg-white dark:bg-dark-900 border-slate-300 dark:border-slate-700"
          />
        </label>

        <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/70 dark:bg-dark-850/60 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition">
          <div>
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">Streaming Response (SSE)</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Hiển thị phản hồi dạng gõ chữ thời gian thực</div>
          </div>
          <input
            type="checkbox"
            checked={settings.stream}
            onChange={(e) => handleChange('stream', e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-400 bg-white dark:bg-dark-900 border-slate-300 dark:border-slate-700"
          />
        </label>
      </div>

      {/* Model Tech Specs Card */}
      <div className="p-3 rounded-xl bg-slate-100 dark:bg-dark-900/80 border border-slate-200 dark:border-slate-800 text-[11px] space-y-2 text-slate-600 dark:text-slate-400">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" /> LLM Model</span>
          <strong className="text-slate-800 dark:text-slate-200 font-medium">Gemini 3.7 Flash</strong>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /> Embedding</span>
          <strong className="text-slate-800 dark:text-slate-200 font-medium">gemini-embedding-001</strong>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /> Vector Store</span>
          <strong className="text-slate-800 dark:text-slate-200 font-medium">ChromaDB (HNSW Cosine)</strong>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Split className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Reranker</span>
          <strong className="text-slate-800 dark:text-slate-200 font-medium">Cohere rerank-v3.5</strong>
        </div>
      </div>
    </div>
  );
});

RagSettings.displayName = 'RagSettings';
