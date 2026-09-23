# 🧠 Production RAG Document Q&A Assistant

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111%2B-009688.svg)](https://fastapi.tiangolo.com/)
[![ChromaDB](https://img.shields.io/badge/VectorDB-ChromaDB-orange.svg)](https://www.trychroma.com/)
[![Gemini](https://img.shields.io/badge/LLM-Google%20Gemini-4285F4.svg)](https://ai.google.dev/)
[![Cohere](https://img.shields.io/badge/Rerank-Cohere%20v3.5-39594C.svg)](https://cohere.com/)

Hệ thống **RAG (Retrieval-Augmented Generation) Document Q&A Chatbot** cấp độ doanh nghiệp (Production-Grade). Hỗ trợ nạp đa định dạng tài liệu, phân đoạn thông minh, tìm kiếm ngữ nghĩa trên ChromaDB kết hợp Cohere Reranking, rào chắn chống bịa đặt (Zero Hallucination), API Server-Sent Events (SSE) Streaming và giao diện người dùng Web Chat Dark Glassmorphism hiện đại.

---

## 🏗️ Kiến Trúc Hệ Thống (Architecture Overview)

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MODERN WEB CHAT UI                              │
│   (Vanilla JS + CSS Glassmorphism + SSE Streaming + Source Inspector)  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTP / SSE Stream
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       FASTAPI BACKEND SERVER                           │
│     /api/upload  •  /api/query  •  /api/documents  •  /api/stats       │
└──────────────────┬───────────────────────────────┬─────────────────────┘
                   │                               │
       Document Ingestion Flow             Query Retrieval Flow
                   │                               │
                   ▼                               ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       DOCUMENT PARSER & SPLITTER     │  │   QUERY EMBEDDING (Gemini)   │
│   PDF • DOCX • TXT • MD              │  │              │               │
│   RecursiveCharacterTextSplitter     │  │              ▼               │
│   (Dynamic chunk size & overlap)     │  │  CHROMADB VECTOR RETRIEVAL   │
│                  │                   │  │  (Top-K Cosine Similarity)   │
│                  ▼                   │  │              │               │
│      GEMINI EMBEDDING PIPELINE       │  │              ▼               │
│        (gemini-embedding-001)        │  │     COHERE RERANKER v3.5     │
│                  │                   │  │   (Cross-Encoder Rerank)     │
│                  ▼                   │  │              │               │
│         CHROMADB PERSISTENCE         │  │              ▼               │
│       + SQLite METADATA TRACKING     │  │  GUARDRAIL PROMPT INJECTION  │
└──────────────────────────────────────┘  │              │               │
                                          │              ▼               │
                                          │  GEMINI 3.6 FLASH STREAMING  │
                                          └──────────────────────────────┘
```

---

## ⚡ Các Tính Năng Nổi Bật (Core Features)

1. **Document Ingestion & Multi-Format Parsing**:
   - Hỗ trợ tải lên nhiều tệp cùng lúc các định dạng: `.pdf`, `.docx`, `.doc`, `.txt`, `.md`.
   - Thuật toán `RecursiveTextSplitter` chia đoạn bảo toàn ranh giới câu (`\n\n`, `\n`, `. `, `? `, `! `, `; `, khoảng trắng).
   - Tùy biến `chunk_size` (300 - 2000 ký tự) và `chunk_overlap` (0 - 400 ký tự).

2. **Vector Store & Semantic Retrieval**:
   - **ChromaDB**: Cơ sở dữ liệu vector lưu trữ cục bộ (Persistent Local Storage) với không gian HNSW Cosine.
   - **Cohere Rerank v3.5**: Cross-Encoder tái sắp xếp thứ tự các đoạn trích xuất, đảm bảo độ liên quan cao nhất.
   - **SQLite Metadata Store**: Lưu vết tài liệu, số lượng chunks, lịch sử hỏi đáp và độ trễ (latency tracking).

3. **Context-Augmented Prompting & Hallucination Guardrails**:
   - Prompt ràng buộc nghiêm ngặt: AI chỉ được phép trả lời dựa trên ngữ cảnh cung cấp.
   - Nếu thông tin không có trong tài liệu, hệ thống tự động từ chối trả lời thay vì tự suy đoán.
   - Trích dẫn chi tiết: Tên tệp, số trang, điểm liên quan (Relevance Score / Similarity).

4. **Modern Web Chat UI & Real-Time Streaming**:
   - **Dark Glassmorphism Design**: Thiết kế giao diện cao cấp, mượt mà, hỗ trợ Responsive trên mọi kích thước màn hình.
   - **Drag & Drop Upload Zone**: Kéo thả tệp với thanh tiến trình trực quan.
   - **SSE Streaming**: Phản hồi dạng gõ chữ thời gian thực (Token-by-Token).
   - **Collapsible Source Inspector**: Accordion trích dẫn nguồn có thể mở rộng để xem nội dung đoạn trích.
   - **Chat Actions**: Sao chép câu trả lời, xuất lịch sử chat ra file Markdown, xóa hội thoại.
   - **RAG Controls**: Điều chỉnh trực tiếp Top-K, Chunk size, Overlap, Temperature và bật/tắt Cohere Rerank trên giao diện.

---

## 🛠️ Cài Đặt & Khởi Chạy (Installation & Quickstart)

### 1. Cài đặt môi trường & Thư viện

```bash
# Clone hoặc mở thư mục dự án
cd e:/Rag-chatbot

# Cài đặt các thư viện cần thiết
pip install -r requirements.txt
```

### 2. Cấu hình biến môi trường (`.env`)

Tạo hoặc cập nhật file `.env` tại thư mục gốc:

```ini
# Google Gemini API Keys (Hỗ trợ 1 key hoặc nhiều key cách nhau bằng dấu phẩy)
GEMINI_KEYS="YOUR_GEMINI_API_KEY_1,YOUR_GEMINI_API_KEY_2"

# Cohere API Key (Dùng cho tính năng Reranking)
COHERE_API_KEY="YOUR_COHERE_API_KEY"
```

### 3. Khởi chạy FastAPI Backend Server & Giao diện Web

```bash
# Chạy FastAPI Server
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Sau khi khởi chạy, mở trình duyệt và truy cập:
👉 **`http://localhost:8000/`** (Giao diện Web Chat UI)
👉 **`http://localhost:8000/docs`** (Swagger API Documentation)

### 4. Khởi chạy giao diện phụ trợ Streamlit (Tùy chọn)

```bash
streamlit run app.py
```

---

## 📡 Tài Liệu API Endpoints

| Phương thức | Endpoint | Mô tả |
|---|---|---|
| `GET` | `/` | Giao diện Web Chat Assistant |
| `GET` | `/api/health` | Kiểm tra trạng thái API & kết nối Vector Store |
| `GET` | `/api/stats` | Thống kê số lượng tài liệu, vector chunks, độ trễ trung bình |
| `GET` | `/api/documents` | Lấy danh sách toàn bộ tài liệu đã được nạp |
| `POST` | `/api/upload` | Tải lên tài liệu mới (`multipart/form-data`) |
| `DELETE` | `/api/documents/{filename}` | Xóa tài liệu khỏi ChromaDB, SQLite và ổ đĩa |
| `POST` | `/api/query` | Truy vấn RAG (Hỗ trợ cả SSE Streaming & JSON) |
| `GET` | `/api/history` | Lấy lịch sử các phiên hỏi đáp gần nhất |
| `POST` | `/api/clear` | Xóa lịch sử trò chuyện hoặc reset toàn bộ cơ sở dữ liệu vector |

### Ví dụ truy vấn qua cURL:

```bash
curl -X POST "http://127.0.0.1:8000/api/query" \
     -H "Content-Type: application/json" \
     -d '{
       "question": "Điều kiện đi thực tập doanh nghiệp là gì?",
       "top_k": 4,
       "use_rerank": true,
       "temperature": 0.2,
       "stream": false
     }'
```

---

## 🧪 Kiểm Thử Hệ Thống (Automated Testing)

Chạy bộ kiểm thử tự động toàn diện:

```bash
# 1. Kiểm thử trực tiếp RAG Engine
python test_rag.py

# 2. Kiểm thử toàn diện 7 bước End-to-End (FastAPI + ChromaDB + SSE Streaming + Guardrails)
python test_e2e.py
```

---

## 📂 Cấu Trúc Thư Mục Dự Án

```
Rag-chatbot/
├── .env                       # Cấu hình API Keys (Gemini, Cohere)
├── requirements.txt           # Danh sách thư viện phụ thuộc
├── data.py                    # Module quản lý SQLite (tài liệu, chunks, logs)
├── rag_engine.py              # Core RAG Engine (Chunking, Vector Embeddings, Cohere Rerank, Guardrails, Streaming)
├── server.py                  # FastAPI Server & RESTful API endpoints
├── test_rag.py                # Kịch bản kiểm thử Core Engine
├── test_e2e.py                # Kịch bản kiểm thử toàn diện End-to-End
├── app.py                     # Streamlit UI (Giao diện thay thế)
├── docs/                      # Thư mục chứa tài liệu mẫu (.pdf, .docx, .txt, .md)
├── chroma_db/                 # Persistent Local Storage của ChromaDB
└── static/                    # Frontend Web Assets
    ├── index.html             # Giao diện HTML5 Responsive
    ├── style.css              # Thiết kế Dark Glassmorphism hiện đại
    └── app.js                 # Logic Client (SSE Streaming, Drag & Drop, Source Inspector)
```

---

## 🛡️ Rào Chắn Chống Bịa Đặt (Hallucination Guardrails)

Hệ thống triển khai 3 lớp bảo vệ chống sinh nội dung sai lệch:
1. **Cosine & MMR Filtering**: Chỉ lấy các đoạn có khoảng cách tương đồng đạt chuẩn.
2. **Cross-Encoder Reranking**: Đánh giá sự liên quan ngữ nghĩa thực tế trước khi đưa vào ngữ cảnh.
3. **Strict System Directive**: Chỉ thị hệ thống bắt buộc từ chối trả lời rõ ràng (`"Dựa trên các tài liệu được cung cấp, không tìm thấy thông tin..."`) khi câu hỏi vượt ra ngoài dữ liệu nạp.