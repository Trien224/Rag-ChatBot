import { ChatMessage } from '../types/rag';

/**
 * Cleanly format and download a PDF document of the chat session
 */
export const exportChatToPdf = (sessionTitle: string, messages: ChatMessage[]) => {
  if (!messages || messages.length === 0) return;

  const printWindow = window.open('', '_blank', 'width=850,height=900');
  if (!printWindow) {
    alert('Vui lòng cho phép mở cửa sổ popup để tải bản PDF.');
    return;
  }

  const title = sessionTitle || 'Cuộc trò chuyện RAG';
  const dateStr = new Date().toLocaleString('vi-VN');

  const messagesHtml = messages
    .map((msg) => {
      const isUser = msg.role === 'user';
      const roleName = isUser ? 'Người dùng' : 'Trợ lý AI (RAG)';
      const roleBadge = isUser
        ? '<span style="background: #4f46e5; color: white; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">User</span>'
        : '<span style="background: #0284c7; color: white; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: bold;">RAG AI</span>';

      const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('vi-VN') : '';

      let sourcesHtml = '';
      if (msg.sources && msg.sources.length > 0) {
        sourcesHtml = `
          <div style="margin-top: 12px; padding: 10px 14px; background: #f8fafc; border-left: 3px solid #6366f1; border-radius: 6px; font-size: 12px; color: #475569;">
            <strong style="color: #334155; display: block; margin-bottom: 6px;">📚 Tài liệu nguồn trích dẫn:</strong>
            <ul style="margin: 0; padding-left: 18px;">
              ${msg.sources
                .map(
                  (s) =>
                    `<li style="margin-bottom: 4px;"><strong>${s.source}</strong> (Trang ${s.page ?? 1}) ${
                      s.similarity ? `- Độ tương đồng: ${Math.round(s.similarity * 100)}%` : ''
                    }</li>`
                )
                .join('')}
            </ul>
          </div>
        `;
      }

      // Convert newlines to breaks and simple markdown code blocks
      const formattedContent = msg.content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/```([\s\S]*?)```/g, '<pre style="background: #1e293b; color: #f8fafc; padding: 12px; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 12px;">$1</pre>')
        .replace(/`([^`]+)`/g, '<code style="background: #e2e8f0; color: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 12px;">$1</code>')
        .replace(/\n/g, '<br/>');

      return `
        <div style="margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: ${isUser ? '#f8fafc' : '#ffffff'};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${roleBadge}
              <span style="font-weight: 600; color: #1e293b; font-size: 13px;">${roleName}</span>
            </div>
            <span style="font-size: 11px; color: #94a3b8;">${timeStr}</span>
          </div>
          <div style="font-size: 13.5px; line-height: 1.6; color: #334155;">
            ${formattedContent}
          </div>
          ${sourcesHtml}
        </div>
      `;
    })
    .join('');

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <title>${title} - PDF Export</title>
      <style>
        @page {
          size: A4;
          margin: 18mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          padding: 24px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 18px;
          margin-bottom: 24px;
        }
        .header h1 {
          font-size: 22px;
          margin: 0 0 6px 0;
          color: #1e293b;
        }
        .header p {
          font-size: 12px;
          color: #64748b;
          margin: 0;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 11px;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 12px;
        }
        @media print {
          body {
            padding: 0;
          }
          button {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📑 ${title}</h1>
        <p>Hệ thống RAG AI Document Assistant | Xuất lúc: ${dateStr}</p>
        <div style="margin-top: 10px;">
          <button onclick="window.print()" style="padding: 8px 16px; background: #4f46e5; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer; font-size: 13px;">
            🖨️ In hoặc Lưu dưới dạng PDF
          </button>
        </div>
      </div>
      <div class="chat-container">
        ${messagesHtml}
      </div>
      <div class="footer">
        Được tạo bởi RAG Chatbot - Trợ lý tài liệu thông minh
      </div>
      <script>
        window.onload = function() {
          // Auto open print dialog after load
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
};

/**
 * Export chat session to Microsoft Word / Google Docs compatible (.doc format)
 */
export const exportChatToDoc = (sessionTitle: string, messages: ChatMessage[]) => {
  if (!messages || messages.length === 0) return;

  const title = sessionTitle || 'Cuộc trò chuyện RAG';
  const dateStr = new Date().toLocaleString('vi-VN');

  const content = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #222222;
        }
        h1 {
          font-size: 18pt;
          color: #1e3a8a;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 6px;
        }
        .meta {
          font-size: 9pt;
          color: #666666;
          margin-bottom: 20px;
        }
        .message-box {
          margin-bottom: 16px;
          padding: 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background-color: #f9fafb;
        }
        .assistant-box {
          background-color: #f0fdf4;
          border-color: #bbf7d0;
        }
        .role {
          font-weight: bold;
          font-size: 10pt;
          color: #1f2937;
          margin-bottom: 6px;
        }
        .sources {
          margin-top: 10px;
          padding: 8px;
          background-color: #eff6ff;
          border-left: 3px solid #3b82f6;
          font-size: 9.5pt;
          color: #1e40af;
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">Xuất từ RAG AI Assistant • Ngày xuất: ${dateStr} • Tổng số tin nhắn: ${messages.length}</div>
      ${messages
        .map((m) => {
          const isUser = m.role === 'user';
          const roleTitle = isUser ? '👤 Người dùng' : '🤖 Trợ lý RAG';
          const sources =
            m.sources && m.sources.length > 0
              ? `<div class="sources"><strong>Nguồn tài liệu tham khảo:</strong><br/>${m.sources
                  .map((s) => `• ${s.source} (Trang ${s.page ?? 1})`)
                  .join('<br/>')}</div>`
              : '';

          return `
            <div class="message-box ${!isUser ? 'assistant-box' : ''}">
              <div class="role">${roleTitle} (${new Date(m.timestamp).toLocaleTimeString('vi-VN')})</div>
              <div>${m.content.replace(/\n/g, '<br/>')}</div>
              ${sources}
            </div>
          `;
        })
        .join('')}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + content], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = (sessionTitle || 'tai_lieu_rag').replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/g, '_').slice(0, 30);
  a.download = `${safeTitle}.doc`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Export chat session to Markdown file (.md)
 */
export const exportChatToMarkdown = (sessionTitle: string, messages: ChatMessage[]) => {
  if (!messages || messages.length === 0) return;

  let md = `# 💬 ${sessionTitle || 'Cuộc trò chuyện RAG'}\n\n`;
  md += `*Thời gian xuất:* ${new Date().toLocaleString('vi-VN')}\n`;
  md += `*Tổng số tin nhắn:* ${messages.length}\n\n---\n\n`;

  messages.forEach((msg, idx) => {
    const role = msg.role === 'user' ? '👤 **Người dùng**' : '🤖 **Trợ lý RAG AI**';
    const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('vi-VN') : '';
    md += `### [${idx + 1}] ${role} *(${timeStr})*\n\n`;
    md += `${msg.content}\n\n`;

    if (msg.sources && msg.sources.length > 0) {
      md += `> **📚 Nguồn trích dẫn:**\n`;
      msg.sources.forEach((s, sIdx) => {
        md += `> ${sIdx + 1}. **${s.source}** (Trang ${s.page ?? 1}) ${
          s.similarity ? `[Độ khớp: ${(s.similarity * 100).toFixed(0)}%]` : ''
        }\n`;
      });
      md += `\n`;
    }
    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeTitle = (sessionTitle || 'rag_chat').replace(/[^a-zA-Z0-9\u00C0-\u024F\u1EA0-\u1EF9]/g, '_').slice(0, 30);
  a.download = `${safeTitle}.md`;
  a.click();
  URL.revokeObjectURL(url);
};
