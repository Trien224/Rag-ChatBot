export interface SourceItem {
  id?: string;
  source: string;
  page?: number | string;
  chunk_index?: number;
  char_count?: number;
  file_type?: string;
  similarity?: number;
  distance?: number;
  relevance_score?: number;
  content_snippet?: string;
  highlight_text?: string;
}

export interface ChatAttachment {
  name: string;
  size: number;
  type?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  latency?: number;
  timestamp: string;
  isStreaming?: boolean;
  isThinking?: boolean;
  thinkingSteps?: string[];
  feedback?: 'like' | 'dislike' | null;
  attachments?: ChatAttachment[];
  model?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  pinned?: boolean;
}

export interface DocumentItem {
  id: string;
  filename: string;
  file_size: number;
  file_type: string;
  chunk_count: number;
  created_at: string;
  status: 'indexed' | 'processing' | 'failed';
  summary?: string;
}

export interface SystemStats {
  total_documents: number;
  vector_count: number;
  avg_latency: number;
  total_queries: number;
  total_chunks?: number;
  db_size_mb?: number;
}

export interface HealthStatus {
  status: string;
  gemini_configured: boolean;
  cohere_configured: boolean;
  total_vectors: number;
  collection_name: string;
  indexed_files?: Array<{ filename: string; chunk_count: number }>;
  indexed_filenames?: string[];
}

export interface HistoryItem {
  id?: number;
  log_id?: number;
  session_id?: string;
  user_id?: number;
  question: string;
  answer: string;
  sources_cited?: SourceItem[] | any;
  sources_json?: string;
  latency?: number;
  latency_seconds?: number;
  search_type?: string;
  created_at: string;
}

export interface RagSettings {
  top_k: number;
  chunk_size: number;
  chunk_overlap: number;
  temperature: number;
  use_rerank: boolean;
  stream: boolean;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}
