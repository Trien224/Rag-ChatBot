import os
import json
import shutil
import asyncio
from typing import List
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles

from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

from rag_engine import RAGEngine
import data as database

# Ensure docs and static directories exist
DOCS_DIR = os.path.abspath("docs")
os.makedirs(DOCS_DIR, exist_ok=True)
STATIC_DIR = os.path.abspath("static")
os.makedirs(STATIC_DIR, exist_ok=True)

# Initialize RAGEngine singleton
rag = RAGEngine()

# Lifespan context manager for startup and shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    try:
        count = rag.collection.count()
        if count == 0:
            print("[INFO] ChromaDB collection is empty. Scanning docs folder for initial documents...")
            rag.ingest_docs_folder(DOCS_DIR)
            print(f"[INFO] Initial ingestion complete. Total vectors: {rag.collection.count()}")
        else:
            print(f"[INFO] ChromaDB initialized with {count} existing chunks.")
    except Exception as e:
        print(f"[WARNING] Startup initial ingestion notice: {e}")
    yield

app = FastAPI(
    title="Production RAG Document Q&A API",
    description="End-to-End Retrieval-Augmented Generation (RAG) Document Assistant with FastAPI & ChromaDB",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request & Response Models
class QueryRequest(BaseModel):
    question: str = Field(..., description="User query or question")
    top_k: int = Field(4, ge=1, le=15, description="Number of context chunks to retrieve")
    chunk_size: int = Field(800, ge=200, le=3000, description="Chunk size for document splitting")
    chunk_overlap: int = Field(150, ge=0, le=500, description="Chunk overlap")
    temperature: float = Field(0.2, ge=0.0, le=1.0, description="Sampling temperature for LLM")
    use_rerank: bool = Field(True, description="Enable Cohere Reranking if API key configured")
    stream: bool = Field(True, description="Stream response token by token via SSE")


class ClearRequest(BaseModel):
    target: str = Field("all", description="'history' to clear chat logs, 'documents' to wipe vectors, or 'all'")


# ========================== API ROUTES ==========================

@app.get("/api/health")
async def health_check():
    """Kiểm tra trạng thái hoạt động của hệ thống và API keys."""
    has_gemini = len(rag.gemini_keys) > 0
    has_cohere = bool(rag.cohere_key)
    try:
        vector_count = rag.collection.count()
    except Exception:
        vector_count = 0
        
    return {
        "status": "healthy",
        "gemini_configured": has_gemini,
        "cohere_configured": has_cohere,
        "total_vectors": vector_count,
        "collection_name": rag.collection_name
    }


@app.get("/api/stats")
async def get_stats():
    """Lấy số liệu thống kê tổng quan của hệ thống."""
    stats = database.get_system_stats()
    try:
        stats["vector_count"] = rag.collection.count()
    except Exception:
        stats["vector_count"] = 0
    return stats


@app.get("/api/documents")
async def list_documents():
    """Lấy danh sách tất cả tài liệu đã được nạp."""
    docs = database.get_all_documents()
    return {"documents": docs, "total": len(docs)}


@app.get("/api/faqs")
@app.get("/api/suggested-questions")
async def get_faqs(limit: int = Query(6, ge=1, le=50)):
    """Lấy danh sách câu hỏi gợi ý FAQs tự động sinh từ tài liệu."""
    faqs = database.get_suggested_questions(limit=limit)
    return {"faqs": faqs, "total": len(faqs)}


@app.post("/api/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    chunk_size: int = Form(800),
    chunk_overlap: int = Form(150)
):
    """
    Tải lên và xử lý nhiều tài liệu (.pdf, .docx, .txt, .md).
    Tự động chia chunk, tạo embedding và lưu vào ChromaDB + SQLite.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Không có tệp tin nào được tải lên.")

    allowed_exts = {".pdf", ".docx", ".doc", ".txt", ".md"}
    processed_results = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in allowed_exts:
            processed_results.append({
                "filename": file.filename,
                "status": "error",
                "error": f"Định dạng tệp không được hỗ trợ ({ext}). Hỗ trợ: .pdf, .docx, .txt, .md"
            })
            continue

        safe_filename = os.path.basename(file.filename)
        dest_path = os.path.join(DOCS_DIR, safe_filename)

        try:
            # Save file to docs directory
            with open(dest_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            # Ingest into vector store & SQLite
            res = rag.ingest_file(
                file_path=dest_path,
                original_filename=safe_filename,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap
            )
            processed_results.append(res)
        except Exception as e:
            processed_results.append({
                "filename": safe_filename,
                "status": "error",
                "error": str(e)
            })

    return {
        "message": f"Đã xử lý {len(files)} tệp tin.",
        "results": processed_results
    }


@app.delete("/api/documents/{filename}")
async def delete_document(filename: str):
    """Xóa một tài liệu khỏi ChromaDB, SQLite và thư mục docs."""
    success = rag.delete_document(filename)
    
    file_path = os.path.join(DOCS_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    return {
        "success": success,
        "message": f"Đã xóa tài liệu '{filename}' khỏi hệ thống."
    }


@app.post("/api/query")
async def query_rag(req: QueryRequest):
    """
    Điểm cuối truy vấn tài liệu RAG.
    Hỗ trợ cả Streaming (Server-Sent Events) và JSON đồng bộ.
    """
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống.")

    if req.stream:
        async def event_stream():
            loop = asyncio.get_event_loop()
            generator = rag.query_stream(
                question=question,
                top_k=req.top_k,
                use_rerank=req.use_rerank,
                temperature=req.temperature
            )

            # Run synchronous generator in worker thread to prevent event loop blocking
            def get_next():
                try:
                    return next(generator)
                except StopIteration:
                    return None

            while True:
                item = await loop.run_in_executor(None, get_next)
                if item is None:
                    break
                
                yield f"data: {json.dumps(item, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.005)

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"
            }
        )
    else:
        # Non-streaming JSON response
        answer, sources, latency = rag.query(
            question=question,
            top_k=req.top_k,
            use_rerank=req.use_rerank,
            temperature=req.temperature
        )
        return {
            "question": question,
            "answer": answer,
            "sources": sources,
            "latency": latency
        }


@app.get("/api/history")
async def get_history(limit: int = Query(30, ge=1, le=100)):
    """Lấy danh sách các câu hỏi đáp gần nhất."""
    history = database.get_recent_chat_history(limit=limit)
    return {"history": history, "count": len(history)}


@app.post("/api/clear")
async def clear_system(req: ClearRequest):
    """Xóa lịch sử chat hoặc đặt lại toàn bộ cơ sở dữ liệu vector."""
    if req.target == "history":
        database.clear_chat_logs()
        return {"message": "Đã xóa toàn bộ lịch sử hỏi đáp."}
    elif req.target == "documents":
        rag.clear_all()
        return {"message": "Đã xóa toàn bộ vector và tài liệu khỏi cơ sở dữ liệu."}
    elif req.target == "all":
        database.clear_chat_logs()
        rag.clear_all()
        return {"message": "Đã đặt lại toàn bộ hệ thống (lịch sử và vector)."}
    else:
        raise HTTPException(status_code=400, detail="Mục tiêu không hợp lệ ('history', 'documents', 'all').")


# Static Files & Frontend Routing
FRONTEND_DIST_DIR = os.path.abspath("frontend/dist")
ASSETS_DIR = os.path.join(FRONTEND_DIST_DIR, "assets")

if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    """Phục vụ giao diện người dùng Web Chat UI (React Vite App hoặc Static fallback)."""
    react_index = os.path.join(FRONTEND_DIST_DIR, "index.html")
    if os.path.exists(react_index):
        return FileResponse(react_index)
        
    static_index = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(static_index):
        return FileResponse(static_index)
    return HTMLResponse("<h1>RAG Backend Running. Giao diện đang được nạp...</h1>")
