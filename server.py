import os
import sys
import json
import shutil
import asyncio
from typing import List, Optional
from contextlib import asynccontextmanager

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.staticfiles import StaticFiles

from fastapi.responses import HTMLResponse, StreamingResponse, FileResponse# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

from rag_engine import RAGEngine, FRIENDLY_OVERLOAD_MESSAGE
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
        total_vectors = 0
        try:
            total_vectors = rag.collection.count()
        except Exception as e:
            print(f"[STARTUP ERROR] Lỗi kiểm tra ChromaDB: {e}")

        print(f"[STARTUP] ChromaDB hiện có {total_vectors} vectors trong collection '{rag.collection_name}'.")

        # Quét danh sách file hợp lệ trong DOCS_DIR
        doc_files = [
            f for f in os.listdir(DOCS_DIR)
            if os.path.splitext(f)[1].lower() in [".pdf", ".docx", ".doc", ".txt", ".md"]
        ] if os.path.exists(DOCS_DIR) else []

        # Lấy danh sách tài liệu đã có vector trong ChromaDB
        indexed_sources = set()
        if total_vectors > 0:
            try:
                chroma_meta_sample = rag.collection.get(include=["metadatas"])
                if chroma_meta_sample and chroma_meta_sample.get("metadatas"):
                    for m in chroma_meta_sample["metadatas"]:
                        if m and "source" in m:
                            indexed_sources.add(m["source"])
            except Exception as e:
                print(f"[STARTUP WARNING] Không thể đọc metadata từ ChromaDB: {e}")

        missing_files = [f for f in doc_files if f not in indexed_sources]

        if total_vectors == 0:
            print(f"[STARTUP] Collection rỗng (0 vectors). Đang quét & nạp toàn bộ {len(doc_files)} tài liệu từ '{DOCS_DIR}'...")
            rag.ingest_docs_folder(DOCS_DIR, force_reload=True)
            print(f"[STARTUP] Hoàn tất nạp khởi động. Tổng số vectors hiện có: {rag.collection.count()}")
        elif missing_files:
            print(f"[STARTUP] Phát hiện {len(missing_files)}/{len(doc_files)} tài liệu chưa có trong ChromaDB: {missing_files}. Đang nạp bổ sung...")
            for mf in missing_files:
                fpath = os.path.join(DOCS_DIR, mf)
                try:
                    res = rag.ingest_file(fpath, original_filename=mf, force_reload=True)
                    st = res.get("status")
                    cnt = res.get("chunks_count", 0)
                    if st in ["success", "already_indexed"]:
                        print(f"  [✓ NẠP THÀNH CÔNG] '{mf}': {cnt} chunks")
                    else:
                        print(f"  [✗ NẠP THẤT BẠI] '{mf}': {res.get('error') or st}")
                except Exception as ex:
                    print(f"  [✗ LỖI NẠP] '{mf}': {ex}")
            print(f"[STARTUP] Tổng số vectors sau khi bổ sung: {rag.collection.count()}")
        else:
            print(f"[STARTUP] Tất cả {len(doc_files)} tài liệu đã được đánh chỉ mục đầy đủ trong ChromaDB ({total_vectors} vectors).")
    except Exception as e:
        print(f"[STARTUP EXCEPTION] Gặp sự cố trong quá trình khởi động RAG: {e}")
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
    session_id: Optional[str] = Field("default", description="User session ID for history isolation")


class ClearRequest(BaseModel):
    target: str = Field("all", description="'history' to clear chat logs, 'documents' to wipe vectors, or 'all'")


# ========================== API ROUTES ==========================

@app.get("/api/health")
async def health_check():
    """
    Kiểm tra trạng thái hoạt động của hệ thống, cấu hình API keys và danh sách
    từng tài liệu đã được đánh chỉ mục trong ChromaDB.
    """
    has_gemini = len(rag.gemini_keys) > 0
    has_cohere = bool(rag.cohere_key)
    
    vector_count = 0
    indexed_files = []
    try:
        vector_count = rag.collection.count()
        if vector_count > 0:
            chroma_meta_sample = rag.collection.get(include=["metadatas"])
            if chroma_meta_sample and chroma_meta_sample.get("metadatas"):
                file_map = {}
                for m in chroma_meta_sample["metadatas"]:
                    if m and "source" in m:
                        src = m["source"]
                        file_map[src] = file_map.get(src, 0) + 1
                indexed_files = [
                    {"filename": fn, "chunk_count": count}
                    for fn, count in file_map.items()
                ]
    except Exception as e:
        print(f"[HEALTH CHECK ERROR] {e}")
        vector_count = 0
        
    return {
        "status": "healthy",
        "gemini_configured": has_gemini,
        "cohere_configured": has_cohere,
        "total_vectors": vector_count,
        "indexed_files": indexed_files,
        "indexed_filenames": [f["filename"] for f in indexed_files],
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

    session_id = req.session_id or "default"

    if req.stream:
        async def event_stream():
            loop = asyncio.get_event_loop()
            try:
                generator = rag.query_stream(
                    question=question,
                    top_k=req.top_k,
                    use_rerank=req.use_rerank,
                    temperature=req.temperature,
                    session_id=session_id
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
            except Exception as e:
                print(f"[QUERY STREAM UNEXPECTED ERROR] {e}")
                err_payload = {"type": "token", "token": FRIENDLY_OVERLOAD_MESSAGE}
                yield f"data: {json.dumps(err_payload, ensure_ascii=False)}\n\n"
                done_payload = {"type": "done", "latency": 0.0, "full_text": FRIENDLY_OVERLOAD_MESSAGE}
                yield f"data: {json.dumps(done_payload, ensure_ascii=False)}\n\n"

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
        try:
            answer, sources, latency = rag.query(
                question=question,
                top_k=req.top_k,
                use_rerank=req.use_rerank,
                temperature=req.temperature,
                session_id=session_id
            )
            return {
                "question": question,
                "answer": answer,
                "sources": sources,
                "latency": latency
            }
        except Exception as e:
            print(f"[QUERY NON-STREAM UNEXPECTED ERROR] {e}")
            return {
                "question": question,
                "answer": FRIENDLY_OVERLOAD_MESSAGE,
                "sources": [],
                "latency": 0.0
            }


@app.get("/api/history")
async def get_history(
    session_id: str = Query("default", description="Session ID for chat history"),
    limit: int = Query(30, ge=1, le=100)
):
    """Lấy danh sách các câu hỏi đáp gần nhất theo session_id."""
    history = database.get_recent_chat_history(session_id=session_id, limit=limit)
    return {"history": history, "count": len(history), "session_id": session_id}


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
FRONTEND_PUBLIC_DIR = os.path.abspath("frontend/public")
ASSETS_DIR = os.path.join(FRONTEND_DIST_DIR, "assets")

if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/favicon.svg")
async def get_favicon_svg():
    """Phục vụ file SVG Favicon chính thức của NTU EduBot."""
    dist_fav = os.path.join(FRONTEND_DIST_DIR, "favicon.svg")
    if os.path.exists(dist_fav):
        return FileResponse(dist_fav, media_type="image/svg+xml")
    pub_fav = os.path.join(FRONTEND_PUBLIC_DIR, "favicon.svg")
    if os.path.exists(pub_fav):
        return FileResponse(pub_fav, media_type="image/svg+xml")
    stat_fav = os.path.join(STATIC_DIR, "favicon.svg")
    if os.path.exists(stat_fav):
        return FileResponse(stat_fav, media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="Favicon not found")

@app.get("/favicon.ico")
async def get_favicon_ico():
    """Fallback cho trình duyệt tự động request /favicon.ico."""
    return await get_favicon_svg()

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
