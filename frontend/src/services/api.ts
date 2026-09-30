import { 
  HealthStatus, 
  SystemStats, 
  DocumentItem, 
  HistoryItem, 
  RagSettings, 
  SourceItem 
} from '../types/rag';

const API_BASE = '';

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Không thể kết nối đến máy chủ API.');
  return res.json();
}

export async function fetchStats(): Promise<SystemStats> {
  const res = await fetch(`${API_BASE}/api/stats`);
  if (!res.ok) throw new Error('Không thể lấy thông tin thống kê.');
  return res.json();
}

export async function fetchDocuments(): Promise<DocumentItem[]> {
  const res = await fetch(`${API_BASE}/api/documents`);
  if (!res.ok) throw new Error('Không thể lấy danh sách tài liệu.');
  const data = await res.json();
  return data.documents || [];
}

export async function uploadDocuments(
  files: File[],
  onProgress?: (percent: number) => void
): Promise<{ success: boolean; message: string; count: number }> {
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }

  // Use XMLHttpRequest to track upload progress if needed
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          resolve({ success: true, message: 'Tải lên thành công!', count: files.length });
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.detail || 'Lỗi khi tải tài liệu lên.'));
        } catch {
          reject(new Error(`Tải tài liệu thất bại (Mã lỗi ${xhr.status}).`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Lỗi kết nối mạng khi tải lên.'));
    };

    xhr.send(formData);
  });
}

export async function deleteDocument(filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể xóa tài liệu.');
  }
}

export function getOrCreateSessionId(): string {
  try {
    let sessionId = localStorage.getItem('chat_session_id');
    if (!sessionId) {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        sessionId = crypto.randomUUID();
      } else {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      }
      localStorage.setItem('chat_session_id', sessionId);
    }
    return sessionId;
  } catch {
    return 'default';
  }
}

export async function clearSystem(target: 'history' | 'documents' | 'all'): Promise<string> {
  const res = await fetch(`${API_BASE}/api/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Lỗi khi thực hiện dọn dẹp hệ thống.');
  }
  const data = await res.json();
  return data.message || 'Thao tác hoàn tất.';
}

export async function fetchHistory(sessionId?: string, limit = 30): Promise<HistoryItem[]> {
  const sid = sessionId || getOrCreateSessionId();
  const res = await fetch(`${API_BASE}/api/history?session_id=${encodeURIComponent(sid)}&limit=${limit}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.history || [];
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onSources?: (sources: SourceItem[]) => void;
  onDone?: (latency: number, sources: SourceItem[]) => void;
  onError?: (err: Error) => void;
}

export async function queryRAGStream(
  question: string,
  settings: RagSettings,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  sessionId?: string
): Promise<void> {
  const sid = sessionId || getOrCreateSessionId();
  const payload = {
    question,
    top_k: settings.top_k,
    chunk_size: settings.chunk_size,
    chunk_overlap: settings.chunk_overlap,
    temperature: settings.temperature,
    use_rerank: settings.use_rerank,
    stream: settings.stream,
    session_id: sid,
  };

  const res = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Lỗi yêu cầu tra cứu (HTTP ${res.status}).`);
  }

  // Check if non-streaming JSON returned
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    callbacks.onToken(data.answer || '');
    if (callbacks.onDone) {
      callbacks.onDone(data.latency || 0, data.sources || []);
    }
    return;
  }

  // SSE Stream parsing
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Không thể tạo luồng đọc dữ liệu từ server.');

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let sources: SourceItem[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const dataStr = trimmed.slice(5).trim();
      if (!dataStr) continue;

      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.token) {
          callbacks.onToken(parsed.token);
        }
        if (parsed.sources) {
          sources = parsed.sources;
          if (callbacks.onSources) callbacks.onSources(sources);
        }
        if (parsed.done) {
          const latency = parsed.latency || 0;
          const finalSources = parsed.sources || sources;
          if (callbacks.onDone) callbacks.onDone(latency, finalSources);
        }
        if (parsed.error) {
          if (callbacks.onError) callbacks.onError(new Error(parsed.error));
        }
      } catch {
        // Raw chunk fallback
        callbacks.onToken(dataStr);
      }
    }
  }
}
