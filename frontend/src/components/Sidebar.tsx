import React, { useState, useMemo, useRef } from 'react';
import { 
  Plus, 
  MessageSquare, 
  MoreVertical, 
  Sun, 
  Moon, 
  Settings,
  Search,
  Pin,
  X,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  GraduationCap,
  LayoutGrid,
  Archive,
  SquarePen,
  ToggleLeft,
  ToggleRight,
  ChevronRight
} from 'lucide-react';
import { ChatSession, DocumentItem, HealthStatus, SystemStats } from '../types/rag';
import { ChatActionMenu } from './ChatActionMenu';
import { NtuEduBotIcon } from './NtuBotIcon';

// Gemini User Avatar illustration
export const GeminiAvatar: React.FC<{ className?: string }> = ({ className = "w-7 h-7" }) => (
  <div className={`relative rounded-full overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm ${className}`}>
    <div className="w-full h-full bg-gradient-to-tr from-sky-400 via-indigo-500 to-amber-300 flex items-center justify-center text-white font-bold text-[11px]">
      <span className="drop-shadow-sm">AI</span>
    </div>
  </div>
);

// Custom Gemini Tooltip Component
const GeminiTooltip: React.FC<{ text: string; isVisible: boolean }> = ({ text, isVisible }) => {
  if (!isVisible) return null;
  return (
    <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 pointer-events-none animate-fadeIn">
      <div className="bg-[#1e1f20] dark:bg-[#282a2c] text-white text-[12px] font-medium px-3 py-1.5 rounded-lg shadow-xl border border-white/10 whitespace-nowrap">
        {text}
      </div>
    </div>
  );
};

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
  onTogglePinSession: (id: string) => void;
  onShareSession: (session: ChatSession) => void;
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
  onTogglePinSession,
  onShareSession,
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
  const [isProMode, setIsProMode] = useState(true);
  
  // Tooltip hover states for collapsed rail
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [isLogoHovered, setIsLogoHovered] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const startRename = (s: ChatSession, e?: React.MouseEvent) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
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

  const handleDelete = (id: string, e?: React.MouseEvent) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    setMenuOpenSessionId(null);
    onDeleteSession(id);
  };

  // Filter sessions by search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // Group sessions by pinned and date
  const { pinnedSessions, todaySessions, weekSessions, olderSessions } = useMemo(() => {
    const pinned: ChatSession[] = [];
    const unpinned: ChatSession[] = [];

    filteredSessions.forEach((s) => {
      if (s.pinned) {
        pinned.push(s);
      } else {
        unpinned.push(s);
      }
    });

    const now = Date.now();
    const oneDay = 86400000;
    const sevenDays = 7 * oneDay;

    const today = unpinned.filter((s) => now - new Date(s.updated_at || s.created_at).getTime() < oneDay);
    const week = unpinned.filter((s) => {
      const diff = now - new Date(s.updated_at || s.created_at).getTime();
      return diff >= oneDay && diff < sevenDays;
    });
    const older = unpinned.filter((s) => now - new Date(s.updated_at || s.created_at).getTime() >= sevenDays);

    return { pinnedSessions: pinned, todaySessions: today, weekSessions: week, olderSessions: older };
  }, [filteredSessions]);

  const handleOpenSearchFromCollapsed = () => {
    if (isCollapsed) {
      onToggleCollapse();
    }
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 150);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container with Gemini styling */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 flex flex-col bg-[#f0f4f9] dark:bg-[#131314] text-slate-800 dark:text-slate-200 border-r border-slate-200/80 dark:border-white/5 transition-all duration-300 ease-in-out select-none shadow-xl lg:shadow-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[68px]' : 'lg:w-[280px] xl:w-[300px]'} w-[280px]`}
      >
        {/* ============================================================ */}
        {/* COLLAPSED RAIL VIEW (Exact match to Google Gemini Screenshot) */}
        {/* ============================================================ */}
        {isCollapsed ? (
          <div className="hidden lg:flex flex-col justify-between h-full py-3 items-center w-full">
            {/* Top Collapsed Group */}
            <div className="flex flex-col items-center gap-4 w-full px-2">
              {/* Top Item: Gemini Sparkle Logo / Hover Sidebar Toggle */}
              <div
                className="relative group flex items-center justify-center"
                onMouseEnter={() => {
                  setIsLogoHovered(true);
                  setHoveredIcon('sidebar-toggle');
                }}
                onMouseLeave={() => {
                  setIsLogoHovered(false);
                  setHoveredIcon(null);
                }}
              >
                <button
                  onClick={onToggleCollapse}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-slate-200/80 dark:hover:bg-white/10"
                  aria-label="Mở thanh bên"
                >
                  {isLogoHovered ? (
                    <PanelLeftOpen className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  ) : (
                    <NtuEduBotIcon className="w-6 h-6" />
                  )}
                </button>
                <GeminiTooltip text="Mở thanh bên" isVisible={hoveredIcon === 'sidebar-toggle'} />
              </div>

              {/* Toggle Switch / Pro Mode Capsule */}
              <div
                className="relative group flex items-center justify-center"
                onMouseEnter={() => setHoveredIcon('toggle-mode')}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <button
                  onClick={() => setIsProMode(!isProMode)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 ${
                    isProMode 
                      ? 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10' 
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-white/10'
                  }`}
                  aria-label="Chế độ RAG"
                >
                  {isProMode ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <GeminiTooltip text={isProMode ? "Chế độ RAG Pro (Bật)" : "Chế độ RAG Tiêu chuẩn"} isVisible={hoveredIcon === 'toggle-mode'} />
              </div>

              {/* New Chat Button (Pencil in subtle circle) */}
              <div
                className="relative group flex items-center justify-center"
                onMouseEnter={() => setHoveredIcon('new-chat')}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <button
                  onClick={() => onNewChat()}
                  className="w-10 h-10 rounded-full bg-slate-200/70 hover:bg-slate-300/80 dark:bg-[#1e1f20] dark:hover:bg-[#282a2c] text-slate-800 dark:text-slate-200 flex items-center justify-center shadow-sm hover:shadow transition-all duration-200"
                  aria-label="Đoạn chat mới"
                >
                  <SquarePen className="w-4 h-4" />
                </button>
                <GeminiTooltip text="Đoạn chat mới" isVisible={hoveredIcon === 'new-chat'} />
              </div>

              {/* Search / Explore Icon */}
              <div
                className="relative group flex items-center justify-center"
                onMouseEnter={() => setHoveredIcon('search')}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <button
                  onClick={handleOpenSearchFromCollapsed}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/10 transition-all duration-200"
                  aria-label="Tìm kiếm"
                >
                  <Search className="w-4 h-4" />
                </button>
                <GeminiTooltip text="Tìm kiếm cuộc trò chuyện" isVisible={hoveredIcon === 'search'} />
              </div>

              {/* Gems / Academic Cap Icon */}
              <div
                className="relative group flex items-center justify-center"
                onMouseEnter={() => setHoveredIcon('gems')}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <button
                  onClick={onOpenDocumentDrawer}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/10 transition-all duration-200"
                  aria-label="Gems & Tri thức"
                >
                  <GraduationCap className="w-4 h-4" />
                </button>
                <GeminiTooltip text="Gems & Kho Tri Thức" isVisible={hoveredIcon === 'gems'} />
              </div>

              {/* Box / Folder Archive Icon (Document Library) */}
              <div
                className="relative group flex items-center justify-center"
                onMouseEnter={() => setHoveredIcon('docs')}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <button
                  onClick={onOpenDocumentDrawer}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/10 transition-all duration-200 relative"
                  aria-label="Kho Tài liệu"
                >
                  <Archive className="w-4 h-4" />
                  {documents.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-500 ring-2 ring-[#f0f4f9] dark:ring-[#131314]" />
                  )}
                </button>
                <GeminiTooltip text={`Kho Tài liệu RAG (${documents.length})`} isVisible={hoveredIcon === 'docs'} />
              </div>

              {/* Grid / 4 Squares Icon (Extensions & Apps) */}
              <div
                className="relative group flex items-center justify-center"
                onMouseEnter={() => setHoveredIcon('apps')}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <button
                  onClick={onOpenSettings}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/10 transition-all duration-200"
                  aria-label="Tiện ích & Cấu hình"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <GeminiTooltip text="Tiện ích mở rộng & Công cụ" isVisible={hoveredIcon === 'apps'} />
              </div>
            </div>

            {/* Bottom Collapsed Group (Settings & Profile Avatar) */}
            <div className="flex flex-col items-center gap-3 w-full px-2">
              {/* Settings Gear */}
              <div
                className="relative group flex items-center justify-center"
                onMouseEnter={() => setHoveredIcon('settings')}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <button
                  onClick={onOpenSettings}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80 dark:hover:bg-white/10 transition-all duration-200"
                  aria-label="Cài đặt"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <GeminiTooltip text="Cài đặt RAG" isVisible={hoveredIcon === 'settings'} />
              </div>

              {/* User Avatar */}
              <div
                className="relative group flex items-center justify-center cursor-pointer"
                onClick={onToggleTheme}
                onMouseEnter={() => setHoveredIcon('user-profile')}
                onMouseLeave={() => setHoveredIcon(null)}
              >
                <GeminiAvatar className="w-8 h-8 hover:ring-2 hover:ring-indigo-500/50 transition-all duration-200" />
                <GeminiTooltip text={isDarkMode ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"} isVisible={hoveredIcon === 'user-profile'} />
              </div>
            </div>
          </div>
        ) : (
          /* ============================================================ */
          /* EXPANDED SIDEBAR VIEW (Full Gemini Experience)               */
          /* ============================================================ */
          <div className="flex flex-col h-full w-full">
            {/* Header: Menu Hamburger + Gemini Logo + Title */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200/60 dark:border-white/5">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={onToggleCollapse}
                  className="hidden lg:flex p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-200/80 dark:hover:bg-white/10 transition"
                  title="Thu gọn thanh bên"
                >
                  <PanelLeftClose className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <NtuEduBotIcon className="w-6 h-6 shrink-0" />
                  <span className="font-display font-semibold text-sm text-slate-900 dark:text-white tracking-tight truncate">
                    NTU EduBot
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-full hover:bg-slate-200/80 dark:hover:bg-white/10 lg:hidden transition"
                title="Đóng sidebar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* New Chat Gemini Style Pill Button */}
            <div className="p-3 space-y-2.5">
              <button
                onClick={() => {
                  onNewChat();
                  if (window.innerWidth < 1024) onClose();
                }}
                className="w-full flex items-center gap-3 py-2.5 px-4 rounded-full bg-[#dde3ea] hover:bg-[#d0d7e2] dark:bg-[#1e1f20] dark:hover:bg-[#282a2c] text-slate-800 dark:text-slate-200 text-xs font-semibold shadow-sm transition-all duration-200 group"
              >
                <Plus className="w-4 h-4 text-slate-700 dark:text-slate-300 transition-transform group-hover:rotate-90" />
                <span className="flex-1 text-left">Đoạn chat mới</span>
                <span className="text-[10px] font-mono opacity-50 bg-slate-300/60 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                  Ctrl+K
                </span>
              </button>

              {/* Search input in expanded view */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm đoạn chat..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-full bg-slate-200/60 dark:bg-white/5 border border-transparent focus:border-indigo-500 dark:focus:border-indigo-400 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Middle: Recent Chats */}
            <div className="flex-1 overflow-y-auto px-3 space-y-4 custom-scrollbar text-xs">
              {/* Quick Knowledge Base Shortcut */}
              <div className="pt-1">
                <button
                  onClick={onOpenDocumentDrawer}
                  className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-white/70 hover:bg-white dark:bg-[#1e1f20]/60 dark:hover:bg-[#1e1f20] border border-slate-200/60 dark:border-white/5 hover:border-indigo-200 dark:hover:border-indigo-500/30 text-slate-700 dark:text-slate-300 transition group shadow-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                      <Archive className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="font-semibold block truncate text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
                        Kho Tri Thức ({documents.length})
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                        {documents.filter((d) => d.status === 'indexed').length} tài liệu đã index
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200" />
                </button>
              </div>

              {/* Sessions List grouped by Gemini style */}
              <div className="space-y-4">
                {/* Group 0: Pinned Sessions */}
                {pinnedSessions.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <Pin className="w-3 h-3 fill-amber-500 text-amber-500" />
                      <span>Đã ghim</span>
                    </div>
                    {pinnedSessions.map((s) => (
                      <SessionItem
                        key={s.id}
                        session={s}
                        isActive={s.id === currentSessionId}
                        isEditing={editingSessionId === s.id}
                        editInput={editTitleInput}
                        setEditInput={setEditTitleInput}
                        onSaveRename={(e) => handleSaveRename(s.id, e)}
                        onCancelRename={() => setEditingSessionId(null)}
                        onStartRename={() => startRename(s)}
                        onDelete={() => handleDelete(s.id)}
                        onTogglePin={() => onTogglePinSession(s.id)}
                        onShare={() => onShareSession(s)}
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

                {/* Group 1: Today */}
                {todaySessions.length > 0 && (
                  <div className="space-y-1">
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Gần đây
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
                        onStartRename={() => startRename(s)}
                        onDelete={() => handleDelete(s.id)}
                        onTogglePin={() => onTogglePinSession(s.id)}
                        onShare={() => onShareSession(s)}
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
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
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
                        onStartRename={() => startRename(s)}
                        onDelete={() => handleDelete(s.id)}
                        onTogglePin={() => onTogglePinSession(s.id)}
                        onShare={() => onShareSession(s)}
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
                    <div className="px-3 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
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
                        onStartRename={() => startRename(s)}
                        onDelete={() => handleDelete(s.id)}
                        onTogglePin={() => onTogglePinSession(s.id)}
                        onShare={() => onShareSession(s)}
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
                    {searchQuery ? 'Không tìm thấy đoạn chat nào.' : 'Chưa có phiên chat nào. Hãy tạo đoạn chat mới!'}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Footer: User Profile & Quick Settings */}
            <div className="p-3 border-t border-slate-200/60 dark:border-white/5 bg-slate-200/30 dark:bg-black/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <GeminiAvatar className="w-8 h-8" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">Kỹ sư AI / Bạn</p>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">NTU EduBot AI</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={onToggleTheme}
                    className="p-1.5 text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition"
                    title={isDarkMode ? 'Giao diện Sáng' : 'Giao diện Tối'}
                    aria-label="Toggle Theme"
                  >
                    {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={onOpenSettings}
                    className="p-1.5 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 rounded-full hover:bg-slate-200 dark:hover:bg-white/10 transition"
                    title="Cài đặt RAG"
                    aria-label="Settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
});

Sidebar.displayName = 'Sidebar';

// Subcomponent for each session item with the 4 actions menu
interface SessionItemProps {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editInput: string;
  setEditInput: (val: string) => void;
  onSaveRename: (e?: React.FormEvent) => void;
  onCancelRename: () => void;
  onStartRename: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onShare: () => void;
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
  onTogglePin,
  onShare,
  onSelect,
  menuOpen,
  setMenuOpen,
}) => {
  if (isEditing) {
    return (
      <form onSubmit={onSaveRename} className="flex items-center gap-1 p-1 bg-white dark:bg-[#1e1f20] rounded-full border border-indigo-500 shadow-sm">
        <input
          type="text"
          value={editInput}
          onChange={(e) => setEditInput(e.target.value)}
          autoFocus
          className="flex-1 bg-transparent px-3 py-1 text-xs text-slate-900 dark:text-white outline-none"
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
    <div className={`relative group ${menuOpen ? 'z-40' : 'z-0'}`}>
      <div
        onClick={onSelect}
        className={`flex items-center justify-between px-3 py-2 rounded-full cursor-pointer transition-all duration-150 ${
          isActive
            ? 'bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff] font-medium shadow-sm'
            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-7">
          {session.pinned ? (
            <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
          ) : (
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#0b57d0] dark:text-[#a8c7fa]' : 'text-slate-400 dark:text-slate-500'}`} />
          )}
          <span className="truncate text-xs">{session.title}</span>
        </div>

        {/* 3-Dots Menu Toggle button */}
        <div 
          className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center z-10 ${
            isActive || menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } transition-opacity`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className={`p-1.5 rounded-full transition-colors ${
              menuOpen
                ? 'bg-slate-300 dark:bg-white/20 text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-black/10 dark:hover:bg-white/10'
            }`}
            aria-label="Tùy chọn đoạn chat"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Context Action Menu: Share, Pin/Unpin, Rename, Delete */}
      <ChatActionMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        isPinned={!!session.pinned}
        onShare={onShare}
        onTogglePin={onTogglePin}
        onRename={onStartRename}
        onDelete={onDelete}
        positionClass="right-2 top-8 z-50"
      />
    </div>
  );
});

SessionItem.displayName = 'SessionItem';


