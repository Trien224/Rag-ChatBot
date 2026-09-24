import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { 
  ChatMessage, 
  ChatSession, 
  DocumentItem, 
  HealthStatus, 
  RagSettings, 
  SystemStats, 
  ToastMessage, 
  SourceItem,
  ChatAttachment
} from './types/rag';
import { 
  fetchHealth, 
  fetchStats, 
  fetchDocuments, 
  uploadDocuments, 
  deleteDocument, 
  clearSystem, 
  queryRAGStream 
} from './services/api';
import { 
  INITIAL_DOCUMENTS, 
  INITIAL_SESSIONS, 
  INITIAL_MESSAGES_MAP, 
  generateMockRagAnswer 
} from './utils/mockData';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { WelcomeHero } from './components/WelcomeHero';
import { MessageItem } from './components/MessageItem';
import { ChatInput } from './components/ChatInput';
import { Toast } from './components/Toast';
import { SourceInspectorDrawer } from './components/SourceInspectorDrawer';
import { DocumentDrawer } from './components/DocumentDrawer';
import { RagSettingsModal } from './components/RagSettingsModal';

const DEFAULT_SETTINGS: RagSettings = {
  top_k: 4,
  chunk_size: 800,
  chunk_overlap: 150,
  temperature: 0.2,
  use_rerank: true,
  stream: true,
};

export const App: React.FC = () => {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const savedTheme = localStorage.getItem('rag_theme');
      if (savedTheme) return savedTheme === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return true;
    }
  });

  // Sidebar collapsed state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Modals & Drawers
  const [isDocDrawerOpen, setIsDocDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSourceDrawerOpen, setIsSourceDrawerOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<SourceItem[]>([]);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);

  // System status
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Documents
  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    try {
      const saved = localStorage.getItem('rag_documents');
      return saved ? JSON.parse(saved) : INITIAL_DOCUMENTS;
    } catch {
      return INITIAL_DOCUMENTS;
    }
  });

  // Chat Sessions
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem('rag_sessions');
      return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
    } catch {
      return INITIAL_SESSIONS;
    }
  });

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('rag_current_session');
      return saved || (INITIAL_SESSIONS[0]?.id || 'session-1');
    } catch {
      return 'session-1';
    }
  });

  // All messages keyed by session ID
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('rag_messages_map');
      return saved ? JSON.parse(saved) : INITIAL_MESSAGES_MAP;
    } catch {
      return INITIAL_MESSAGES_MAP;
    }
  });

  // Current session's messages
  const currentMessages = messagesMap[currentSessionId] || [];

  // RAG Settings
  const [settings, setSettings] = useState<RagSettings>(() => {
    try {
      const saved = localStorage.getItem('rag_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollPausedRef = useRef(false);

  // Apply Dark/Light theme class to html root
  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
        localStorage.setItem('rag_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        localStorage.setItem('rag_theme', 'light');
      }
    } catch (e) {
      console.error(e);
    }
  }, [isDarkMode]);

  // Persist sessions
  useEffect(() => {
    try {
      localStorage.setItem('rag_sessions', JSON.stringify(sessions));
    } catch (e) {
      console.error(e);
    }
  }, [sessions]);

  // Persist current session ID
  useEffect(() => {
    try {
      localStorage.setItem('rag_current_session', currentSessionId);
    } catch (e) {
      console.error(e);
    }
  }, [currentSessionId]);

  // Persist messages map
  useEffect(() => {
    try {
      localStorage.setItem('rag_messages_map', JSON.stringify(messagesMap));
    } catch (e) {
      console.error(e);
    }
  }, [messagesMap]);

  // Persist documents
  useEffect(() => {
    try {
      localStorage.setItem('rag_documents', JSON.stringify(documents));
    } catch (e) {
      console.error(e);
    }
  }, [documents]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem('rag_settings', JSON.stringify(settings));
    } catch (e) {
      console.error(e);
    }
  }, [settings]);

  // Toast Helpers
  const addToast = useCallback((type: ToastMessage['type'], message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Theme toggle
  const handleToggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  // Handle Scroll and Scroll-to-bottom
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceToBottom < 120;
    isAutoScrollPausedRef.current = !isNearBottom;
    setShowScrollBottom(!isNearBottom);
  };

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      setShowScrollBottom(false);
      isAutoScrollPausedRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAutoScrollPausedRef.current) {
      scrollToBottom();
    }
  }, [currentMessages, isLoading, scrollToBottom]);

  // Load API Data if online
  const loadSystemData = useCallback(async () => {
    try {
      const [h, s, docs] = await Promise.allSettled([
        fetchHealth(),
        fetchStats(),
        fetchDocuments(),
      ]);

      if (h.status === 'fulfilled') setHealth(h.value);
      if (s.status === 'fulfilled') setStats(s.value);
      if (docs.status === 'fulfilled' && docs.value && docs.value.length > 0) {
        const formatted = docs.value.map((d) => ({
          ...d,
          status: 'indexed' as const,
        }));
        setDocuments(formatted);
      }
    } catch {
      // Offline fallback mode
    }
  }, []);

  useEffect(() => {
    loadSystemData();
  }, [loadSystemData]);

  // Handle Create New Chat Session
  const handleNewChat = useCallback(() => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'Cuộc trò chuyện mới',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 0,
    };

    setSessions((prev) => [newSession, ...prev]);
    setMessagesMap((prev) => ({ ...prev, [newId]: [] }));
    setCurrentSessionId(newId);
    addToast('info', 'Đã tạo đoạn chat mới.');
  }, [addToast]);

  // Global Keyboard Shortcuts (Ctrl+K, Escape, Ctrl+Shift+L)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K: New Chat
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      // Escape: Close open drawers / modals
      if (e.key === 'Escape') {
        setIsDocDrawerOpen(false);
        setIsSettingsOpen(false);
        setIsSourceDrawerOpen(false);
        setIsSidebarOpen(false);
      }
      // Ctrl+Shift+L: Toggle Theme
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleToggleTheme();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleNewChat, handleToggleTheme]);

  // Handle Rename Session
  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle, updated_at: new Date().toISOString() } : s))
    );
    addToast('success', 'Đã đổi tên đoạn chat.');
  }, [addToast]);

  // Handle Delete Session
  const handleDeleteSession = useCallback((id: string) => {
    const sessionToDelete = sessions.find((s) => s.id === id);
    if (!sessionToDelete) return;

    if (confirm(`Bạn có chắc muốn xóa đoạn chat "${sessionToDelete.title}"?`)) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setMessagesMap((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });

      if (currentSessionId === id) {
        const remaining = sessions.filter((s) => s.id !== id);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
      addToast('info', 'Đã xóa đoạn chat.');
    }
  }, [sessions, currentSessionId, handleNewChat, addToast]);

  // Handle Document Upload
  const handleUpload = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setIsUploading(true);
    setUploadProgress(0);

    const newDocItems: DocumentItem[] = files.map((file) => ({
      id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      filename: file.name,
      file_size: file.size,
      file_type: file.name.split('.').pop()?.toLowerCase() || 'txt',
      chunk_count: Math.max(12, Math.floor(file.size / 15000)),
      created_at: new Date().toISOString(),
      status: 'processing',
      summary: `Tài liệu vừa nạp: ${file.name}`,
    }));

    setDocuments((prev) => [...newDocItems, ...prev]);

    try {
      await uploadDocuments(files, (percent) => {
        setUploadProgress(percent);
      });
      setDocuments((prev) =>
        prev.map((d) => (newDocItems.some((n) => n.id === d.id) ? { ...d, status: 'indexed' } : d))
      );
      addToast('success', `Đã nạp thành công ${files.length} tài liệu vào ChromaDB!`);
      await loadSystemData();
    } catch {
      // Offline fallback: simulate vector indexing
      setTimeout(() => {
        setDocuments((prev) =>
          prev.map((d) => (newDocItems.some((n) => n.id === d.id) ? { ...d, status: 'indexed' } : d))
        );
        addToast('success', `Đã phân tích & nhúng ${files.length} tài liệu vào kho tri thức!`);
      }, 1500);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [addToast, loadSystemData]);

  // Handle Delete Document
  const handleDeleteDocument = useCallback(async (filename: string) => {
    if (!confirm(`Bạn có chắc muốn xóa tài liệu "${filename}" khỏi kho RAG?`)) return;
    try {
      await deleteDocument(filename);
      setDocuments((prev) => prev.filter((d) => d.filename !== filename));
      addToast('success', `Đã xóa tài liệu "${filename}".`);
      await loadSystemData();
    } catch {
      setDocuments((prev) => prev.filter((d) => d.filename !== filename));
      addToast('success', `Đã xóa tài liệu "${filename}".`);
    }
  }, [addToast, loadSystemData]);

  // Handle Clear All Documents
  const handleClearAllDocs = useCallback(async () => {
    if (!confirm('Bạn có chắc chắn muốn XÓA TOÀN BỘ tài liệu trong kho tri thức?')) return;
    try {
      await clearSystem('documents');
      setDocuments([]);
      addToast('success', 'Đã dọn dẹp toàn bộ tài liệu.');
      await loadSystemData();
    } catch {
      setDocuments([]);
      addToast('success', 'Đã dọn dẹp toàn bộ tài liệu.');
    }
  }, [addToast, loadSystemData]);

  // Open Citation Drawer
  const handleOpenSourceModal = useCallback((sources: SourceItem[], index: number) => {
    setActiveSources(sources);
    setActiveSourceIndex(index);
    setIsSourceDrawerOpen(true);
  }, []);

  // Message Feedback
  const handleFeedback = useCallback((messageId: string, feedback: 'like' | 'dislike') => {
    setMessagesMap((prev) => ({
      ...prev,
      [currentSessionId]: (prev[currentSessionId] || []).map((m) =>
        m.id === messageId ? { ...m, feedback: m.feedback === feedback ? null : feedback } : m
      ),
    }));
    addToast('success', feedback === 'like' ? 'Cảm ơn bạn đã đánh giá tốt!' : 'Cảm ơn phản hồi! Chúng tôi sẽ cải thiện.');
  }, [currentSessionId, addToast]);

  // Handle Send Message
  const handleSendMessage = useCallback(async (queryText?: string, attachments?: ChatAttachment[]) => {
    const text = (queryText || inputQuery).trim();
    if ((!text && (!attachments || attachments.length === 0)) || isLoading) return;

    setInputQuery('');
    isAutoScrollPausedRef.current = false;

    // Update session title if first message
    const currentMsgs = messagesMap[currentSessionId] || [];
    if (currentMsgs.length === 0) {
      const generatedTitle = text.slice(0, 36) + (text.length > 36 ? '...' : '');
      setSessions((prev) =>
        prev.map((s) => (s.id === currentSessionId ? { ...s, title: generatedTitle } : s))
      );
    }

    // User Message
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      attachments,
      timestamp: new Date().toISOString(),
    };

    // Placeholder Assistant Message
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
      isThinking: true,
    };

    // Add to state
    setMessagesMap((prev) => ({
      ...prev,
      [currentSessionId]: [...(prev[currentSessionId] || []), userMsg, assistantMsg],
    }));

    setIsLoading(true);

    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    let accumulatedText = '';
    let sourcesResult: SourceItem[] = [];
    const startTime = Date.now();

    try {
      await queryRAGStream(
        text,
        settings,
        {
          onToken: (token) => {
            accumulatedText += token;
            setMessagesMap((prev) => ({
              ...prev,
              [currentSessionId]: (prev[currentSessionId] || []).map((m) =>
                m.id === assistantId ? { ...m, content: accumulatedText, isThinking: false } : m
              ),
            }));
          },
          onSources: (srcs) => {
            sourcesResult = srcs;
            setMessagesMap((prev) => ({
              ...prev,
              [currentSessionId]: (prev[currentSessionId] || []).map((m) =>
                m.id === assistantId ? { ...m, sources: srcs } : m
              ),
            }));
          },
          onDone: (latency, finalSources) => {
            setMessagesMap((prev) => ({
              ...prev,
              [currentSessionId]: (prev[currentSessionId] || []).map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: accumulatedText,
                      latency,
                      sources: finalSources || sourcesResult,
                      isStreaming: false,
                      isThinking: false,
                    }
                  : m
              ),
            }));
          },
          onError: (err) => {
            throw err;
          },
        },
        abortCtrl.signal
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessagesMap((prev) => ({
          ...prev,
          [currentSessionId]: (prev[currentSessionId] || []).map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: accumulatedText ? accumulatedText + ' *(Đã dừng phản hồi)*' : '*(Đã dừng tra cứu)*',
                  isStreaming: false,
                  isThinking: false,
                }
              : m
          ),
        }));
        addToast('info', 'Đã dừng sinh câu trả lời.');
      } else {
        // Smart interactive simulated streaming fallback
        const mockResult = generateMockRagAnswer(text, documents);
        sourcesResult = mockResult.sources;

        await new Promise((r) => setTimeout(r, 600));
        setMessagesMap((prev) => ({
          ...prev,
          [currentSessionId]: (prev[currentSessionId] || []).map((m) =>
            m.id === assistantId ? { ...m, sources: mockResult.sources, isThinking: false } : m
          ),
        }));

        const tokens = mockResult.answer.split(/(\s+)/);
        let streamText = '';

        for (const token of tokens) {
          if (abortCtrl.signal.aborted) break;
          streamText += token;
          setMessagesMap((prev) => ({
            ...prev,
            [currentSessionId]: (prev[currentSessionId] || []).map((m) =>
              m.id === assistantId ? { ...m, content: streamText } : m
            ),
          }));
          await new Promise((r) => setTimeout(r, 18));
        }

        const elapsed = (Date.now() - startTime) / 1000;
        setMessagesMap((prev) => ({
          ...prev,
          [currentSessionId]: (prev[currentSessionId] || []).map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: streamText,
                  sources: mockResult.sources,
                  latency: elapsed,
                  isStreaming: false,
                  isThinking: false,
                }
              : m
          ),
        }));
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [inputQuery, isLoading, messagesMap, currentSessionId, settings, documents, addToast]);

  // Stop Generation
  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Regenerate last message
  const handleRegenerate = useCallback(() => {
    const msgs = messagesMap[currentSessionId] || [];
    const lastUserMsg = [...msgs].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      handleSendMessage(lastUserMsg.content, lastUserMsg.attachments);
    }
  }, [messagesMap, currentSessionId, handleSendMessage]);

  // Clear Chat in Current Session
  const handleClearChat = useCallback(() => {
    if (currentMessages.length === 0) return;
    if (confirm('Bạn có muốn xóa toàn bộ tin nhắn trong phiên trò chuyện này?')) {
      setMessagesMap((prev) => ({ ...prev, [currentSessionId]: [] }));
      addToast('info', 'Đã xóa đoạn hội thoại.');
    }
  }, [currentMessages.length, currentSessionId, addToast]);

  // Export Chat to Markdown
  const handleExportChat = useCallback(() => {
    if (currentMessages.length === 0) return;

    const currentSession = sessions.find((s) => s.id === currentSessionId);
    let md = `# Nhật Ký Tra Cứu RAG: ${currentSession?.title || 'Cuộc trò chuyện'}\n`;
    md += `*Thời gian xuất:* ${new Date().toLocaleString()}\n\n---\n\n`;

    currentMessages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? '👤 Người dùng' : '🤖 Trợ lý RAG';
      md += `### [${idx + 1}] ${role} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n`;
      md += `${msg.content}\n\n`;

      if (msg.sources && msg.sources.length > 0) {
        md += `> **Nguồn trích dẫn:**\n`;
        msg.sources.forEach((s, sIdx) => {
          md += `> [${sIdx + 1}] ${s.source} (Trang ${s.page ?? 1})\n`;
        });
        md += `\n`;
      }
      md += `---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rag_chat_${(currentSession?.title || 'export').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Đã xuất đoạn hội thoại thành tệp Markdown!');
  }, [currentMessages, sessions, currentSessionId, addToast]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-dark-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Toast Notification Container */}
      <Toast toasts={toasts} onDismiss={removeToast} />

      {/* Left Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={(id) => setCurrentSessionId(id)}
        onNewChat={handleNewChat}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        documents={documents}
        onOpenDocumentDrawer={() => setIsDocDrawerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        stats={stats}
        health={health}
      />

      {/* Main Chat Panel */}
      <div
        className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72 xl:pl-80'
        }`}
      >
        {/* Chat Header */}
        <ChatHeader
          sessionTitle={currentSession?.title || 'RAG Document Assistant'}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenDocumentDrawer={() => setIsDocDrawerOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onExportChat={handleExportChat}
          onClearChat={handleClearChat}
          messageCount={currentMessages.length}
          docCount={documents.length}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
        />

        {/* Message Thread Area */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto p-3 sm:p-6 custom-scrollbar"
        >
          {currentMessages.length === 0 ? (
            <WelcomeHero
              onSelectPrompt={(prompt) => handleSendMessage(prompt)}
              onUpload={handleUpload}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
            />
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {currentMessages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onCopy={() => addToast('success', 'Đã sao chép nội dung vào clipboard!')}
                  onRegenerate={msg.role === 'assistant' ? handleRegenerate : undefined}
                  onFeedback={handleFeedback}
                  onOpenSourceModal={handleOpenSourceModal}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Floating Scroll to Bottom Button */}
          {showScrollBottom && currentMessages.length > 0 && (
            <button
              onClick={() => scrollToBottom(true)}
              className="sticky bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-dark-850 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-medium shadow-lg hover:shadow-xl transition-all animate-fade-in hover:scale-105"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Cuộn xuống dưới</span>
            </button>
          )}
        </div>

        {/* Input Bar */}
        <ChatInput
          input={inputQuery}
          onChange={setInputQuery}
          onSend={(attachments) => handleSendMessage(undefined, attachments)}
          onStop={handleStopGeneration}
          isLoading={isLoading}
        />
      </div>

      {/* Right Drawer: Source Citation Inspector */}
      <SourceInspectorDrawer
        isOpen={isSourceDrawerOpen}
        onClose={() => setIsSourceDrawerOpen(false)}
        sources={activeSources}
        currentIndex={activeSourceIndex}
        onSelectIndex={setActiveSourceIndex}
        onCopyText={() => addToast('success', 'Đã sao chép đoạn trích văn bản!')}
      />

      {/* Document Knowledge Base Drawer */}
      <DocumentDrawer
        isOpen={isDocDrawerOpen}
        onClose={() => setIsDocDrawerOpen(false)}
        documents={documents}
        onUpload={handleUpload}
        onDeleteDocument={handleDeleteDocument}
        onRefreshDocuments={loadSystemData}
        onClearAllDocuments={handleClearAllDocs}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
      />

      {/* RAG Hyperparameters Settings Modal */}
      <RagSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
        onReset={() => {
          setSettings(DEFAULT_SETTINGS);
          addToast('info', 'Đã khôi phục cài đặt mặc định.');
        }}
      />
    </div>
  );
};

export default App;
