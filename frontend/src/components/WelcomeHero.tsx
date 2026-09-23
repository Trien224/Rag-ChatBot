import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  Users, 
  GraduationCap, 
  ShieldCheck, 
  UploadCloud, 
  Layers, 
  ArrowRight,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

interface WelcomeHeroProps {
  onSelectPrompt: (prompt: string) => void;
  onUpload: (files: File[]) => Promise<void>;
  isUploading: boolean;
  uploadProgress: number;
}

const STARTER_PROMPTS = [
  {
    icon: TrendingUp,
    category: 'Tài chính & Doanh thu',
    title: 'Phân tích Kết quả Kinh doanh Q4/2024 & Mục tiêu 2025',
    description: 'Tóm tắt chỉ số doanh thu, biên lợi nhuận gộp và ngân sách đầu tư công nghệ.',
    query: 'Tóm tắt các chỉ số tài chính trọng yếu trong quý 4 và mục tiêu doanh thu năm 2025 từ báo cáo tài chính?',
    color: 'from-blue-500/20 to-indigo-500/20 text-indigo-400 border-indigo-500/30',
  },
  {
    icon: Users,
    category: 'Nhân sự & Phúc lợi',
    title: 'Quy chế Nghỉ phép & Đăng ký Remote / WFH',
    description: 'Điều kiện thâm niên cộng ngày phép và quy trình duyệt làm việc từ xa.',
    query: 'Quy định về số ngày nghỉ phép năm và thủ tục xin làm việc từ xa (Remote/Hybrid) như thế nào?',
    color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
  },
  {
    icon: GraduationCap,
    category: 'Đào tạo & Thực tập',
    title: 'Quy chế Thực tập Doanh nghiệp (OJT) & Tín chỉ',
    description: 'Số tín chỉ tích lũy tối thiểu, điểm CPA và thời lượng thực tập chuẩn.',
    query: 'Điều kiện để sinh viên đủ điều kiện tham gia học phần Thực tập Doanh nghiệp (OJT)?',
    color: 'from-purple-500/20 to-pink-500/20 text-purple-400 border-purple-500/30',
  },
  {
    icon: ShieldCheck,
    category: 'Bảo mật & Kỹ thuật',
    title: 'Quy trình Bảo mật & Cấp lại Quyền Truy cập',
    description: 'Hướng dẫn đổi mật khẩu SSO, VPN nội bộ và hỗ trợ kỹ thuật IT.',
    query: 'Quy trình cấp lại mật khẩu tài khoản nội bộ và chính sách bảo mật dữ liệu doanh nghiệp?',
    color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
  },
];

export const WelcomeHero: React.FC<WelcomeHeroProps> = ({
  onSelectPrompt,
  onUpload,
  isUploading,
  uploadProgress,
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onUpload(files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onUpload(files);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 px-4 flex flex-col items-center text-center space-y-6 select-none">
      {/* Glowing Hero Icon */}
      <div className="relative">
        <div className="absolute -inset-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-full blur-2xl opacity-30 animate-pulse-subtle" />
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-dark-900 border border-slate-700/80 flex items-center justify-center text-indigo-400 shadow-2xl">
          <Layers className="w-8 h-8 sm:w-10 sm:h-10" />
        </div>
      </div>

      {/* Hero Headings */}
      <div className="space-y-2 max-w-xl">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
          Hỏi Đáp & Tra Cứu Tài Liệu Thông Minh
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
          Trợ lý RAG thông minh phong cách <strong className="text-slate-200">ChatGPT & Perplexity</strong>. Mọi câu trả lời đều được truy xuất chính xác từ tài liệu, đính kèm số trang và đoạn trích văn bản gốc.
        </p>
      </div>

      {/* Embedded Drag & Drop Zone */}
      <div className="w-full max-w-xl">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`relative p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all duration-300 text-center cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
              : 'border-slate-800 hover:border-slate-700 bg-dark-900/60 hover:bg-dark-900/90'
          }`}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md,.csv"
            onChange={handleFileChange}
            disabled={isUploading}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
          />

          {isUploading ? (
            <div className="space-y-2 py-1">
              <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-200">
                Đang xử lý & nhúng tài liệu vào ChromaDB... ({uploadProgress || 65}%)
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-slate-200">
                  Kéo thả tệp PDF, DOCX, TXT vào đây để nạp kiến thức mới
                </p>
                <p className="text-[11px] text-slate-400">
                  Tự động chia chunk & tạo vector embedding
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Starter Prompts Grid */}
      <div className="w-full space-y-3 pt-2 text-left">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Gợi ý câu hỏi bắt đầu:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {STARTER_PROMPTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.015, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectPrompt(item.query)}
                className="group relative flex items-start gap-3 p-3.5 rounded-2xl bg-dark-850/60 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-dark-800/90 transition-all duration-200 text-left shadow-sm hover:shadow-glow-sm cursor-pointer"
              >
                <div className={`p-2 rounded-xl bg-gradient-to-br border shrink-0 ${item.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                      {item.category}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                    {item.description}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Feature Badges Ribbon */}
      <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400 flex-wrap pt-2">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          Trích dẫn chính xác số trang
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
          Cohere Rerank v3.5
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
          ChromaDB Vector Store
        </span>
      </div>
    </div>
  );
};
