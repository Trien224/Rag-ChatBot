/**
 * RAG DOCUMENT ASSISTANT - FRONTEND APPLICATION LOGIC
 * Features:
 * - Real-time SSE streaming response parser
 * - Drag-and-drop multi-file uploader with progress tracking
 * - Interactive collapsible Source Inspector with similarity metrics
 * - Markdown rendering with syntax highlighting & code copy
 * - Document management (listing, deletion, vector clearing)
 * - RAG settings configuration persistence
 */

document.addEventListener("DOMContentLoaded", () => {
  // Determine API Base URL for Live Server compatibility (e.g. port 5500 / 3000 -> 8000)
  const API_BASE = (window.location.protocol === "file:" || (window.location.port && window.location.port !== "8000"))
    ? "http://127.0.0.1:8000"
    : "";

  // DOM Elements
  const chatContainer = document.getElementById("chatContainer");
  const messagesList = document.getElementById("messagesList");
  const welcomeHero = document.getElementById("welcomeHero");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const exportChatBtn = document.getElementById("exportChatBtn");

  // Sidebar & Navigation
  const sidebar = document.getElementById("sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  // Document Management Elements
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("fileInput");
  const uploadProgressCard = document.getElementById("uploadProgressCard");
  const progressBarFill = document.getElementById("progressBarFill");
  const uploadPercentage = document.getElementById("uploadPercentage");
  const uploadStatusText = document.getElementById("uploadStatusText");
  const docList = document.getElementById("docList");
  const docCountPill = document.getElementById("docCountPill");
  const refreshDocsBtn = document.getElementById("refreshDocsBtn");
  const clearAllDocsBtn = document.getElementById("clearAllDocsBtn");

  // Metric Elements
  const statDocCount = document.getElementById("statDocCount");
  const statVectorCount = document.getElementById("statVectorCount");
  const statAvgLatency = document.getElementById("statAvgLatency");
  const healthText = document.getElementById("healthText");

  // RAG Settings Elements
  const topKSlider = document.getElementById("topKSlider");
  const topKVal = document.getElementById("topKVal");
  const chunkSizeSlider = document.getElementById("chunkSizeSlider");
  const chunkSizeVal = document.getElementById("chunkSizeVal");
  const chunkOverlapSlider = document.getElementById("chunkOverlapSlider");
  const chunkOverlapVal = document.getElementById("chunkOverlapVal");
  const tempSlider = document.getElementById("tempSlider");
  const tempVal = document.getElementById("tempVal");
  const rerankToggle = document.getElementById("rerankToggle");
  const streamingToggle = document.getElementById("streamingToggle");

  // State
  let messageHistory = [];
  let isGenerating = false;

  // Initialize marked.js configuration
  if (typeof marked !== "undefined") {
    marked.setOptions({
      highlight: function(code, lang) {
        if (typeof hljs !== "undefined" && lang && hljs.getLanguage(lang)) {
          return hljs.highlight(code, { language: lang }).value;
        }
        return code;
      },
      breaks: true,
      gfm: true
    });
  }

  // ==========================================
  // SIDEBAR & TABS NAVIGATION
  // ==========================================

  toggleSidebarBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  if (closeSidebarBtn) {
    closeSidebarBtn.addEventListener("click", () => {
      sidebar.classList.remove("open");
    });
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add("active");
    });
  });

  // Settings synchronization
  function bindSlider(slider, badge, key, defaultValue) {
    const saved = localStorage.getItem(key) || defaultValue;
    slider.value = saved;
    badge.textContent = saved;

    slider.addEventListener("input", (e) => {
      badge.textContent = e.target.value;
      localStorage.setItem(key, e.target.value);
    });
  }

  bindSlider(topKSlider, topKVal, "rag_top_k", "4");
  bindSlider(chunkSizeSlider, chunkSizeVal, "rag_chunk_size", "800");
  bindSlider(chunkOverlapSlider, chunkOverlapVal, "rag_chunk_overlap", "150");
  bindSlider(tempSlider, tempVal, "rag_temperature", "0.2");

  if (rerankToggle) {
    rerankToggle.checked = localStorage.getItem("rag_rerank") !== "false";
    rerankToggle.addEventListener("change", () => {
      localStorage.setItem("rag_rerank", rerankToggle.checked);
    });
  }

  if (streamingToggle) {
    streamingToggle.checked = localStorage.getItem("rag_streaming") !== "false";
    streamingToggle.addEventListener("change", () => {
      localStorage.setItem("rag_streaming", streamingToggle.checked);
    });
  }

  // ==========================================
  // DATA FETCHING: STATS & DOCUMENTS
  // ==========================================

  async function fetchStats() {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      if (!res.ok) return;
      const data = await res.json();
      statDocCount.textContent = data.total_documents ?? 0;
      statVectorCount.textContent = data.vector_count ?? data.total_chunks ?? 0;
      statAvgLatency.textContent = `${data.average_latency_seconds ?? 0}s`;
    } catch (e) {
      console.warn("Lỗi khi tải stats:", e);
    }
  }

  async function fetchHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.status === "healthy") {
        healthText.textContent = "Hệ thống sẵn sàng";
      }
    } catch (e) {
      healthText.textContent = "Mất kết nối backend";
    }
  }

  async function fetchDocuments() {
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      if (!res.ok) return;
      const data = await res.json();
      renderDocumentList(data.documents || []);
    } catch (e) {
      console.warn("Lỗi tải danh sách tài liệu:", e);
    }
  }

  function renderDocumentList(docs) {
    docCountPill.textContent = docs.length;
    if (docs.length === 0) {
      docList.innerHTML = `
        <div class="empty-docs-state">
          <i class="fa-solid fa-folder-open"></i>
          <p>Chưa có tài liệu nào trong hệ thống</p>
          <small>Hãy kéo thả tệp tin để bắt đầu tra cứu</small>
        </div>
      `;
      return;
    }

    docList.innerHTML = docs.map(doc => {
      const ext = (doc.file_type || "pdf").toLowerCase();
      const extClass = ["pdf", "docx", "txt", "md"].includes(ext) ? ext : "pdf";
      const sizeKB = Math.round((doc.file_size || 0) / 1024);
      
      return `
        <div class="doc-item" data-filename="${escapeHtml(doc.filename)}">
          <div class="doc-item-left">
            <div class="doc-type-badge ${extClass}">${ext.toUpperCase()}</div>
            <div class="doc-meta">
              <span class="doc-name" title="${escapeHtml(doc.filename)}">${escapeHtml(doc.filename)}</span>
              <div class="doc-sub">
                <span><i class="fa-solid fa-layer-group"></i> ${doc.total_chunks || 1} chunks</span>
                <span><i class="fa-regular fa-file"></i> ${doc.total_pages || 1} trang</span>
                <span>${sizeKB} KB</span>
              </div>
            </div>
          </div>
          <button class="doc-del-btn" title="Xóa tài liệu này" onclick="deleteDocument('${escapeHtml(doc.filename)}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
    }).join("");
  }

  // Window deleteDocument function
  window.deleteDocument = async function(filename) {
    if (!confirm(`Bạn có chắc chắn muốn xóa tài liệu "${filename}" khỏi kho dữ liệu?`)) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/documents/${encodeURIComponent(filename)}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Đã xóa tài liệu thành công", "success");
        fetchDocuments();
        fetchStats();
      } else {
        showToast(`Lỗi: ${data.detail || data.message}`, "error");
      }
    } catch (e) {
      showToast(`Lỗi kết nối: ${e.message}`, "error");
    }
  };

  refreshDocsBtn.addEventListener("click", () => {
    fetchDocuments();
    fetchStats();
    showToast("Đã làm mới danh sách tài liệu", "info");
  });

  clearAllDocsBtn.addEventListener("click", async () => {
    if (!confirm("⚠️ CẢNH BÁO: Thao tác này sẽ xóa toàn bộ vector và tài liệu trong cơ sở dữ liệu! Bạn có chắc chắn muốn tiếp tục?")) return;
    
    try {
      const res = await fetch(`${API_BASE}/api/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: "documents" })
      });
      if (res.ok) {
        showToast("Đã xóa toàn bộ tài liệu & vector", "success");
        fetchDocuments();
        fetchStats();
      }
    } catch (e) {
      showToast(`Lỗi: ${e.message}`, "error");
    }
  });

  // ==========================================
  // FILE UPLOADER & DRAG-AND-DROP
  // ==========================================

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("drag-over");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("drag-over");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag-over");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesUpload(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesUpload(e.target.files);
    }
  });

  async function handleFilesUpload(files) {
    if (files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("files", files[i]);
    }
    formData.append("chunk_size", chunkSizeSlider.value);
    formData.append("chunk_overlap", chunkOverlapSlider.value);

    // Show progress UI
    uploadProgressCard.classList.remove("hidden");
    uploadStatusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên ${files.length} tệp...`;
    progressBarFill.style.width = "25%";
    uploadPercentage.textContent = "25%";

    try {
      progressBarFill.style.width = "60%";
      uploadPercentage.textContent = "60%";
      uploadStatusText.innerHTML = `<i class="fa-solid fa-brain-circuit fa-spin"></i> Đang trích xuất văn bản & vector hóa...`;

      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (res.ok) {
        progressBarFill.style.width = "100%";
        uploadPercentage.textContent = "100%";
        uploadStatusText.innerHTML = `<i class="fa-solid fa-check"></i> Hoàn tất nạp dữ liệu!`;
        
        showToast(`Đã nạp thành công ${files.length} tài liệu vào ChromaDB`, "success");
        setTimeout(() => {
          uploadProgressCard.classList.add("hidden");
          progressBarFill.style.width = "0%";
        }, 2500);

        fetchDocuments();
        fetchStats();
      } else {
        showToast(`Lỗi tải lên: ${data.detail || "Không thể xử lý"}`, "error");
        uploadProgressCard.classList.add("hidden");
      }
    } catch (e) {
      showToast(`Lỗi kết nối upload: ${e.message}`, "error");
      uploadProgressCard.classList.add("hidden");
    } finally {
      fileInput.value = "";
    }
  }

  // ==========================================
  // CHAT & STREAMING LOGIC
  // ==========================================

  // Auto resize input textarea
  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + "px";
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendQuery();
    }
  });

  sendBtn.addEventListener("click", handleSendQuery);

  // Starter query chips
  document.querySelectorAll(".suggestion-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const q = chip.dataset.query;
      if (q && !isGenerating) {
        chatInput.value = q;
        handleSendQuery();
      }
    });
  });

  async function handleSendQuery() {
    const query = chatInput.value.trim();
    if (!query || isGenerating) return;

    // Reset input
    chatInput.value = "";
    chatInput.style.height = "auto";
    welcomeHero.classList.add("hidden");

    // Append user message
    appendUserMessage(query);

    // Prepare assistant message bubble
    const assistantBubble = createAssistantMessageBubble();
    const contentDiv = assistantBubble.querySelector(".bubble-content");
    const sourcesContainer = assistantBubble.querySelector(".source-cards-container");
    const sourceToggleBtn = assistantBubble.querySelector(".source-toggle-btn");
    const latencySpan = assistantBubble.querySelector(".latency-val");

    isGenerating = true;
    sendBtn.disabled = true;

    const isStream = streamingToggle.checked;
    const reqBody = {
      question: query,
      top_k: parseInt(topKSlider.value, 10),
      chunk_size: parseInt(chunkSizeSlider.value, 10),
      chunk_overlap: parseInt(chunkOverlapSlider.value, 10),
      temperature: parseFloat(tempSlider.value),
      use_rerank: rerankToggle.checked,
      stream: isStream
    };

    let accumulatedText = "";
    let retrievedSources = [];

    try {
      if (isStream) {
        // SSE STREAMING
        const response = await fetch(`${API_BASE}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody)
        });

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        // Add streaming cursor
        const cursor = document.createElement("span");
        cursor.className = "streaming-cursor";
        contentDiv.appendChild(cursor);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop(); // keep remainder

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.substring(6));

                if (data.type === "sources") {
                  retrievedSources = data.sources || [];
                  renderSourceInspector(sourcesContainer, sourceToggleBtn, retrievedSources, data.search_type);
                } else if (data.type === "token") {
                  accumulatedText += data.token;
                  contentDiv.innerHTML = renderMarkdown(accumulatedText);
                  contentDiv.appendChild(cursor);
                  scrollToBottom();
                } else if (data.type === "done") {
                  if (cursor.parentNode) cursor.remove();
                  latencySpan.textContent = `${data.latency ?? 0}s`;
                }
              } catch (parseErr) {
                console.warn("SSE parse error:", parseErr, line);
              }
            }
          }
        }

        if (cursor.parentNode) cursor.remove();
        contentDiv.innerHTML = renderMarkdown(accumulatedText);

      } else {
        // SYNCHRONOUS JSON QUERY
        contentDiv.innerHTML = `<em><i class="fa-solid fa-spinner fa-spin"></i> Đang truy vấn ChromaDB và tổng hợp kết quả...</em>`;
        const response = await fetch(`${API_BASE}/api/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody)
        });

        const data = await response.json();
        if (response.ok) {
          accumulatedText = data.answer;
          retrievedSources = data.sources || [];
          contentDiv.innerHTML = renderMarkdown(accumulatedText);
          renderSourceInspector(sourcesContainer, sourceToggleBtn, retrievedSources, reqBody.use_rerank ? "cohere_rerank" : "cosine");
          latencySpan.textContent = `${data.latency ?? 0}s`;
        } else {
          contentDiv.innerHTML = `<span style="color: #fb7185;">⚠️ Lỗi: ${data.detail || "Không thể thực hiện truy vấn"}</span>`;
        }
      }

      // Add to session history
      messageHistory.push({
        question: query,
        answer: accumulatedText,
        sources: retrievedSources
      });

      fetchStats();

    } catch (err) {
      contentDiv.innerHTML = `<span style="color: #fb7185;">⚠️ Lỗi kết nối: ${err.message}</span>`;
    } finally {
      isGenerating = false;
      sendBtn.disabled = false;
      scrollToBottom();
    }
  }

  // ==========================================
  // DOM RENDERING HELPERS
  // ==========================================

  function appendUserMessage(text) {
    const row = document.createElement("div");
    row.className = "message-row user";
    row.innerHTML = `
      <div class="avatar user"><i class="fa-solid fa-user"></i></div>
      <div class="message-bubble-container">
        <div class="message-bubble">
          <p>${escapeHtml(text)}</p>
        </div>
      </div>
    `;
    messagesList.appendChild(row);
    scrollToBottom();
  }

  function createAssistantMessageBubble() {
    const row = document.createElement("div");
    row.className = "message-row assistant";
    row.innerHTML = `
      <div class="avatar assistant"><i class="fa-solid fa-brain-circuit"></i></div>
      <div class="message-bubble-container">
        <div class="message-bubble">
          <div class="bubble-content"></div>
          
          <!-- Source Inspector -->
          <div class="source-inspector">
            <button class="source-toggle-btn" style="display: none;">
              <i class="fa-solid fa-chevron-down chevron"></i>
              <span class="source-toggle-text">📍 Xem 0 nguồn trích dẫn</span>
            </button>
            <div class="source-cards-container"></div>
          </div>
        </div>

        <div class="message-actions-bar">
          <div class="meta-latency">
            <i class="fa-solid fa-bolt"></i> <span class="latency-val">...</span>
          </div>
          <button class="copy-answer-btn" title="Sao chép câu trả lời">
            <i class="fa-regular fa-copy"></i> Sao chép
          </button>
        </div>
      </div>
    `;

    // Copy answer button listener
    const copyBtn = row.querySelector(".copy-answer-btn");
    copyBtn.addEventListener("click", () => {
      const content = row.querySelector(".bubble-content").innerText;
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Đã sao chép!`;
        setTimeout(() => {
          copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i> Sao chép`;
        }, 2000);
      });
    });

    messagesList.appendChild(row);
    scrollToBottom();
    return row;
  }

  function renderSourceInspector(container, toggleBtn, sources, searchType) {
    if (!sources || sources.length === 0) {
      toggleBtn.style.display = "none";
      return;
    }

    toggleBtn.style.display = "flex";
    const toggleText = toggleBtn.querySelector(".source-toggle-text");
    const methodBadge = searchType === "cohere_rerank" ? "Cohere Rerank" : "Cosine Search";
    toggleText.innerHTML = `📍 Nguồn tham chiếu (${sources.length} đoạn • ${methodBadge})`;

    toggleBtn.onclick = () => {
      toggleBtn.classList.toggle("open");
      container.classList.toggle("open");
    };

    container.innerHTML = sources.map((s, idx) => {
      const score = s.relevance_score != null 
        ? `${Math.round(s.relevance_score * 100)}% Match (Rerank)`
        : s.similarity != null 
          ? `${Math.round(s.similarity * 100)}% Sim`
          : "Context Match";

      const snippet = s.content_snippet || "";
      const pageInfo = s.page ? `Trang ${s.page}` : `Chunk #${s.chunk_index ?? idx + 1}`;

      return `
        <div class="source-card">
          <div class="source-card-header">
            <div class="source-file-title">
              <i class="fa-regular fa-file-lines"></i>
              <span>${escapeHtml(s.source || "Tài liệu")}</span>
            </div>
            <div class="source-badges">
              <span class="source-page-badge">${pageInfo}</span>
              <span class="source-score-badge">${score}</span>
            </div>
          </div>
          ${snippet ? `<div class="source-excerpt">"${escapeHtml(snippet)}"</div>` : ""}
        </div>
      `;
    }).join("");
  }

  function renderMarkdown(md) {
    if (typeof marked !== "undefined") {
      try {
        return marked.parse(md);
      } catch (e) {
        return escapeHtml(md);
      }
    }
    return escapeHtml(md);
  }

  function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Toast Notification
  function showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "fa-circle-info";
    if (type === "success") icon = "fa-circle-check";
    if (type === "error") icon = "fa-triangle-exclamation";

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Clear Chat History
  clearChatBtn.addEventListener("click", () => {
    if (messageHistory.length === 0) return;
    if (!confirm("Bạn có muốn xóa toàn bộ lịch sử cuộc trò chuyện này?")) return;
    
    messagesList.innerHTML = "";
    messageHistory = [];
    welcomeHero.classList.remove("hidden");
    showToast("Đã làm mới màn hình trò chuyện", "info");
  });

  // Export Chat
  exportChatBtn.addEventListener("click", () => {
    if (messageHistory.length === 0) {
      showToast("Chưa có tin nhắn nào để xuất", "info");
      return;
    }

    let markdown = `# Nhật Ký Hỏi Đáp RAG Document AI\n*Ngày xuất: ${new Date().toLocaleString("vi-VN")}*\n\n---\n\n`;
    messageHistory.forEach((msg, idx) => {
      markdown += `### Câu hỏi ${idx + 1}: ${msg.question}\n\n`;
      markdown += `**Trả lời:**\n${msg.answer}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        markdown += `**Nguồn tham chiếu:**\n`;
        msg.sources.forEach(s => {
          markdown += `- Tệp: \`${s.source}\` (Trang ${s.page || 'N/A'})\n`;
        });
        markdown += `\n`;
      }
      markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rag_chat_export_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Đã tải xuống file Markdown lịch sử chat", "success");
  });

  // Initial Boot
  fetchStats();
  fetchHealth();
  fetchDocuments();
});
