import React, { useState, useMemo } from 'react';
import { 
  Bot, 
  Plus, 
  MessageSquare, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Layers, 
  Sliders, 
  Sun, 
  Moon, 
  ChevronRight, 
  Check, 
  X, 
  PanelLeftClose,
  PanelLeftOpen,
  Search
} from 'lucide-react';
import { ChatSession, DocumentItem, HealthStatus, SystemStats } from '../types/rag';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  sessions: ChatSession[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  documents: DocumentItem[];
  onOpenDocumentDrawer: () => void;
  onOpenSettings: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  stats?: SystemStats | null;
  health?: HealthStatus | null;
}

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  isOpen,
  onClose,
  isCollapsed,
  onToggleCollapse,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
  documents,
  onOpenDocumentDrawer,
  onOpenSettings,
  isDarkMode,
  onToggleTheme,
}) => {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [menuOpenSessionId, setMenuOpenSessionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const startRename = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(s.id);
    setEditTitleInput(s.title);
    setMenuOpenSessionId(null);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editTitleInput.trim()) {
      onRenameSession(id, editTitleInput.trim());
    }
    setEditingSessionId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenSessionId(null);
    onDeleteSession(id);
  };

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // Group sessions by date
  const { todaySessions, weekSessions, olderSessions } = useMemo(() => {
    const now = Date.now();
    const oneDay = 86400000;
    const sevenDays = 7 * oneDay;

    const today = filteredSessions.filter((s) => now - new Date(s.updated_at || s.created_at).getTime() < oneDay);
    const week = filteredSessions.filter((s) => {
      const diff = now - new Date(s.updated_at || s.created_at).getTime();
      return diff >= oneDay && diff < sevenDays;
    });
    const older = filteredSessions.filter((s) => now - new Date(s.updated_at || s.created_at).getTime() >= sevenDays);

    return { todaySessions: today, weekSessions: week, olderSessions: older };
  }, [filteredSessions]);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-white dark:bg-dark-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out select-none shadow-lg lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-72 xl:w-80'} w-72`}
      >
        {/* Header / Brand */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-0.5 shadow-glow-sm shrink-0">
              <div className="w-full h-full bg-white dark:bg-dark-900 rounded-[10px] flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Bot className="w-5 h-5" />
              </div>
            </div>

            {!isCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-display font-bold text-sm tracking-wide text-slate-900 dark:text-white truncate">
                    RAG Assistant
                  </h2>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 shrink-0">
                    PRO
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Smart Document Knowledge</p>
              </div>
            )}
          </div>

          {/* Collapse Toggle Desktop */}
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleCollapse}
              className="hidden lg:flex p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={isCollapsed ? 'Mở rộng thanh điều khiển' : 'Thu gọn thanh điều khiển'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition"
              title="Đóng sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* New Chat Button */}
        <div className="p-3 space-y-2">
          <button
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 1024) onClose();
            }}
            className={`w-full flex items-center justify-center gap-2.5 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-medium text-xs shadow-glow-sm hover:shadow-glow-md transition-all duration-200 group ${
              isCollapsed ? 'p-2.5' : ''
            }`}
            title="Tạo cuộc trò chuyện mới (Ctrl+K)"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
            {!isCollapsed && (
              <div className="flex items-center justify-between flex-1">
                <span>Đoạn chat mới</span>
                <span className="text-[10px] font-mono opacity-70 bg-indigo-800/60 px-1.5 py-0.5 rounded">Ctrl+K</span>
              </div>
            )}
          </button>

          {/* Search bar when not collapsed */}
          {!isCollapsed && sessions.length > 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm đoạn chat..."
                className="w-full pl-8 pr-2 py-1.5 rounded-lg bg-slate-100 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Scrollable Middle: Sessions & Knowledge Base */}
        <div className="flex-1 overflow-y-auto px-3 space-y-4 custom-scrollbar text-xs">
          {/* Quick Knowledge Base Shortcut */}
          {!isCollapsed && (
            <div className="pt-1">
              <button
                onClick={onOpenDocumentDrawer}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-100/80 hover:bg-slate-100 dark:bg-dark-850/70 dark:hover:bg-dark-850 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-left min-w-0">
                    <span className="font-semibold block truncate text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                      Kho Tri Thức ({documents.length})
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                      {documents.filter((d) => d.status === 'indexed').length} tài liệu đã index
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
              </button>
            </div>
          )}

          {/* Sessions List */}
          {!isCollapsed ? (
            <div className="space-y-4">
              {/* Group 1: Today */}
              {todaySessions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Hôm nay
                  </div>
                  {todaySessions.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      isActive={s.id === currentSessionId}
                      isEditing={editingSessionId === s.id}
                      editInput={editTitleInput}
                      setEditInput={setEditTitleInput}
                      onSaveRename={(e) => handleSaveRename(s.id, e)}
                      onCancelRename={() => setEditingSessionId(null)}
                      onStartRename={(e) => startRename(s, e)}
                      onDelete={(e) => handleDelete(s.id, e)}
                      onSelect={() => {
                        onSelectSession(s.id);
                        if (window.innerWidth < 1024) onClose();
                      }}
                      menuOpen={menuOpenSessionId === s.id}
                      setMenuOpen={(open) => setMenuOpenSessionId(open ? s.id : null)}
                    />
                  ))}
                </div>
              )}

              {/* Group 2: Previous 7 Days */}
              {weekSessions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    7 ngày qua
                  </div>
                  {weekSessions.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      isActive={s.id === currentSessionId}
                      isEditing={editingSessionId === s.id}
                      editInput={editTitleInput}
                      setEditInput={setEditTitleInput}
                      onSaveRename={(e) => handleSaveRename(s.id, e)}
                      onCancelRename={() => setEditingSessionId(null)}
                      onStartRename={(e) => startRename(s, e)}
                      onDelete={(e) => handleDelete(s.id, e)}
                      onSelect={() => {
                        onSelectSession(s.id);
                        if (window.innerWidth < 1024) onClose();
                      }}
                      menuOpen={menuOpenSessionId === s.id}
                      setMenuOpen={(open) => setMenuOpenSessionId(open ? s.id : null)}
                    />
                  ))}
                </div>
              )}

              {/* Group 3: Older */}
              {olderSessions.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    Cũ hơn
                  </div>
                  {olderSessions.map((s) => (
                    <SessionItem
                      key={s.id}
                      session={s}
                      isActive={s.id === currentSessionId}
                      isEditing={editingSessionId === s.id}
                      editInput={editTitleInput}
                      setEditInput={setEditTitleInput}
                      onSaveRename={(e) => handleSaveRename(s.id, e)}
                      onCancelRename={() => setEditingSessionId(null)}
                      onStartRename={(e) => startRename(s, e)}
                      onDelete={(e) => handleDelete(s.id, e)}
                      onSelect={() => {
                        onSelectSession(s.id);
                        if (window.innerWidth < 1024) onClose();
                      }}
                      menuOpen={menuOpenSessionId === s.id}
                      setMenuOpen={(open) => setMenuOpenSessionId(open ? s.id : null)}
                    />
                  ))}
                </div>
              )}

              {filteredSessions.length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  {searchQuery ? 'Không tìm thấy đoạn chat nào.' : 'Chưa có phiên chat nào. Hãy bấm "Đoạn chat mới" để bắt đầu!'}
                </div>
              )}
            </div>
          ) : (
            /* Collapsed Session Icons */
            <div className="space-y-2 flex flex-col items-center">
              <button
                onClick={onOpenDocumentDrawer}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-dark-850 dark:hover:bg-slate-800 text-cyan-600 dark:text-cyan-400 flex items-center justify-center transition"
                title="Mở Kho Tri Thức"
              >
                <Layers className="w-5 h-5" />
              </button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSelectSession(s.id)}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition relative ${
                    s.id === currentSessionId
                      ? 'bg-indigo-600 text-white shadow-glow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-dark-850 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                  title={s.title}
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Profile & Theme Toggle Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-dark-950/60 space-y-2">
          <div className="flex items-center justify-between">
            {!isCollapsed ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 shrink-0">
                  <div className="w-full h-full rounded-full bg-white dark:bg-dark-900 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300">
                    AI
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">Kỹ sư AI / Bạn</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">RAG Pro Mode</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-0.5 mx-auto">
                <div className="w-full h-full rounded-full bg-white dark:bg-dark-900 flex items-center justify-center text-xs font-bold text-indigo-600 dark:text-indigo-300">
                  AI
                </div>
              </div>
            )}

            {!isCollapsed && (
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleTheme}
                  className="p-1.5 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                  title={isDarkMode ? 'Chuyển sang Giao diện Sáng (Light Mode)' : 'Chuyển sang Giao diện Tối (Dark Mode)'}
                  aria-label="Toggle Theme"
                >
                  {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                </button>

                <button
                  onClick={onOpenSettings}
                  className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                  title="Cấu hình tham số RAG"
                  aria-label="Settings"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
});

Sidebar.displayName = 'Sidebar';

// Subcomponent for each session item with rename & delete
interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editInput: string;
  setEditInput: (val: string) => void;
  onSaveRename: (e?: React.FormEvent) => void;
  onCancelRename: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onSelect: () => void;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
}

const SessionItem: React.FC<SessionItemProps> = React.memo(({
  session,
  isActive,
  isEditing,
  editInput,
  setEditInput,
  onSaveRename,
  onCancelRename,
  onStartRename,
  onDelete,
  onSelect,
  menuOpen,
  setMenuOpen,
}) => {
  if (isEditing) {
    return (
      <form onSubmit={onSaveRename} className="flex items-center gap-1 p-1 bg-white dark:bg-dark-950 rounded-xl border border-indigo-500 shadow-sm">
        <input
          type="text"
          value={editInput}
          onChange={(e) => setEditInput(e.target.value)}
          autoFocus
          className="flex-1 bg-transparent px-2 py-1 text-xs text-slate-900 dark:text-white outline-none"
        />
        <button type="submit" className="p-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-500">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onCancelRename} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </form>
    );
  }

  return (
    <div className="relative group">
      <div
        onClick={onSelect}
        className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all duration-150 ${
          isActive
            ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-500/40 font-medium shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-dark-850 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-6">
          <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
          <span className="truncate text-xs">{session.title}</span>
        </div>

        {/* Menu Toggle button */}
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded hover:bg-slate-200 dark:hover:bg-slate-700/60"
            aria-label="Options"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-2 top-full mt-1 z-50 w-32 rounded-xl bg-white dark:bg-dark-950 border border-slate-200 dark:border-slate-800 p-1 shadow-xl text-xs"
        >
          <button
            onClick={onStartRename}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg transition"
          >
            <Edit3 className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            <span>Đổi tên</span>
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
          >
            <Trash2 className="w-3 h-3" />
            <span>Xóa</span>
          </button>
        </div>
      )}
    </div>
  );
});

SessionItem.displayName = 'SessionItem';
