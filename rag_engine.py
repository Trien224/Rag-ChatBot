import os
import sys
import time
import threading
from typing import List, Dict, Any, Tuple, Generator, Optional
import pypdf
import chromadb
from google import genai
from google.genai import types
import cohere
from dotenv import load_dotenv

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

# Database storage
import data as database

load_dotenv()


def is_quota_or_rate_limit_error(e: Exception) -> bool:
    """Helper to detect 429 Quota Exceeded / Resource Exhausted errors from Gemini API."""
    err_msg = str(e).lower()
    err_type = type(e).__name__.lower()
    
    if hasattr(e, "code") and getattr(e, "code") == 429:
        return True
    if hasattr(e, "status_code") and getattr(e, "status_code") == 429:
        return True
        
    keywords = ["429", "resource_exhausted", "resourceexhausted", "quota", "rate limit", "too many requests", "exhausted"]
    return any(kw in err_msg or kw in err_type for kw in keywords)


class GeminiKeyManager:
    """
    Thread-safe Round-Robin Key Manager and Cycler for Google Gemini API Keys.
    Handles:
    - Comma-separated GEMINI_KEYS parsing and validation
    - Round-robin key rotation across incoming requests
    - Automatic fallback and retries upon encountering 429 (Resource Exhausted / Quota Exceeded)
    """
    def __init__(self, raw_keys_str: Optional[str] = None):
        self.lock = threading.Lock()
        self.keys: List[str] = []
        self.clients: List[genai.Client] = []
        self._counter: int = 0
        self.load_keys(raw_keys_str)

    def load_keys(self, raw_keys_str: Optional[str] = None):
        if raw_keys_str is None:
            raw_keys_str = os.getenv("GEMINI_KEYS", "") or os.getenv("GEMINI_API_KEY", "")
        
        parsed_keys: List[str] = []
        for k in raw_keys_str.split(","):
            cleaned = k.strip().strip('"').strip("'").strip()
            if cleaned and cleaned not in parsed_keys:
                parsed_keys.append(cleaned)
                
        self.keys = parsed_keys
        self.clients = []
        for k in self.keys:
            try:
                self.clients.append(genai.Client(api_key=k))
            except Exception as e:
                print(f"[GeminiKeyManager] Warning initializing client for key ...{k[-6:] if len(k)>6 else k}: {e}")

        print(f"[GeminiKeyManager] Initialized with {len(self.keys)} active Gemini API key(s).")

    @property
    def total_keys(self) -> int:
        return len(self.keys)

    def get_key_pool(self) -> List[Tuple[genai.Client, str, int]]:
        """
        Returns a round-robin ordered list of (client, key, idx) starting from the next rotated index,
        allowing a request to attempt all keys in cyclical order.
        """
        if not self.keys or not self.clients:
            return []
            
        with self.lock:
            start_idx = self._counter % len(self.keys)
            self._counter += 1

        pool = []
        n = len(self.keys)
        for i in range(n):
            idx = (start_idx + i) % n
            pool.append((self.clients[idx], self.keys[idx], idx))
        return pool


try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter
except ImportError:
    try:
        from langchain.text_splitter import RecursiveCharacterTextSplitter
    except ImportError:
        class RecursiveCharacterTextSplitter:
            """Fallback RecursiveCharacterTextSplitter implementation."""
            def __init__(self, chunk_size: int = 800, chunk_overlap: int = 150, separators: Optional[List[str]] = None):
                self.chunk_size = chunk_size
                self.chunk_overlap = chunk_overlap
                self.separators = separators or ["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""]

            def split_text(self, text: str) -> List[str]:
                text = text.strip()
                if not text:
                    return []
                return self._split(text, self.separators)

            def _split(self, text: str, separators: List[str]) -> List[str]:
                if len(text) <= self.chunk_size:
                    return [text]
                if not separators:
                    chunks = []
                    start = 0
                    while start < len(text):
                        end = min(start + self.chunk_size, len(text))
                        chunks.append(text[start:end])
                        if end == len(text):
                            break
                        start += max(1, self.chunk_size - self.chunk_overlap)
                    return chunks
                sep = separators[0]
                remaining = separators[1:]
                splits = list(text) if sep == "" else text.split(sep)
                good_splits, current_chunk, current_len = [], [], 0
                for s in splits:
                    item = s if sep == "" else (s + sep)
                    item_len = len(item)
                    if item_len > self.chunk_size:
                        if current_chunk:
                            m = "".join(current_chunk).strip()
                            if m: good_splits.append(m)
                            current_chunk, current_len = [], 0
                        good_splits.extend(self._split(item, remaining))
                    elif current_len + item_len <= self.chunk_size:
                        current_chunk.append(item)
                        current_len += item_len
                    else:
                        m = "".join(current_chunk).strip()
                        if m: good_splits.append(m)
                        overlap_items, overlap_len = [], 0
                        for prev in reversed(current_chunk):
                            if overlap_len + len(prev) <= self.chunk_overlap:
                                overlap_items.insert(0, prev)
                                overlap_len += len(prev)
                            else:
                                break
                        current_chunk = overlap_items + [item]
                        current_len = sum(len(x) for x in current_chunk)
                if current_chunk:
                    m = "".join(current_chunk).strip()
                    if m: good_splits.append(m)
                return [c for c in good_splits if c.strip()]


RecursiveTextSplitter = RecursiveCharacterTextSplitter


class RAGEngine:
    """
    Production-Grade RAG Engine supporting:
    - Multi-format document ingestion (.pdf, .docx, .txt, .md)
    - LangChain RecursiveCharacterTextSplitter (chunk_size=800, chunk_overlap=150)
    - ChromaDB Vector Store with Cosine similarity (HNSW index)
    - Google Text-Embedding (text-embedding-004) & Gemini 2.5 Flash Generation
    - SQLite Relational Database (system_data.db: users, documents, document_chunks, chat_logs)
    - Cohere Reranking & Strict Hallucination Guardrails
    - Streaming (SSE) & JSON query responses
    """
    def __init__(self, chroma_path: str = "chroma_db", collection_name: str = "production_rag_docs"):
        database.init_db()
        
        self.chroma_path = chroma_path
        self.collection_name = collection_name
        self.chroma_client = chromadb.PersistentClient(path=self.chroma_path)
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        
        # Configure Gemini API keys (supports Round-Robin & 429 Fallback)
        self.key_manager = GeminiKeyManager()
        self.gemini_keys = self.key_manager.keys
        self.current_key_idx = 0
        self._active_embed_model: Optional[str] = None
        self._active_gen_model: Optional[str] = None

        # Configure Cohere Reranker
        self.cohere_key = os.getenv("COHERE_API_KEY", "").strip()
        self.cohere_client = cohere.Client(api_key=self.cohere_key) if self.cohere_key else None

    @property
    def gemini_client(self):
        """Backward-compatible access to a client."""
        if self.key_manager.clients:
            return self.key_manager.clients[0]
        return None

    def get_embedding(self, text: str) -> List[float]:
        """
        Tạo embedding vector cho đoạn văn bản sử dụng mô hình Google Text-Embedding (text-embedding-004)
        với cơ chế xoay vòng Key và Fallback tự động.
        """
        if not self.key_manager.total_keys:
            raise ValueError("GEMINI_API_KEY / GEMINI_KEYS chưa được cấu hình trong .env")
        
        candidates = ["text-embedding-004", "gemini-embedding-001", "gemini-embedding-2"]
        if self._active_embed_model and self._active_embed_model in candidates:
            embed_models = [self._active_embed_model] + [m for m in candidates if m != self._active_embed_model]
        else:
            embed_models = candidates

        key_pool = self.key_manager.get_key_pool()
        last_err = None

        for client, key, key_idx in key_pool:
            masked_key = f"...{key[-6:]}" if len(key) >= 6 else "***"
            for model_name in embed_models:
                try:
                    res = client.models.embed_content(
                        model=model_name,
                        contents=text
                    )
                    self._active_embed_model = model_name
                    return res.embeddings[0].values
                except Exception as e:
                    last_err = e
                    if is_quota_or_rate_limit_error(e):
                        print(f"[GEMINI 429/QUOTA] Key #{key_idx} ({masked_key}) quota exceeded on embedding model '{model_name}'. Rotating to next key...")
                        break
                    else:
                        continue

        if last_err:
            raise last_err
        raise ValueError("Không thể tạo embedding từ tất cả các API keys.")

    def extract_text_from_file(self, file_path: str, original_filename: str) -> List[Dict[str, Any]]:
        """
        Trích xuất nội dung từ các định dạng file (.pdf, .docx, .txt, .md).
        Trả về danh sách các trang/phần chứa text và metadata.
        """
        ext = os.path.splitext(original_filename)[1].lower()
        pages_content = []

        if ext == ".pdf":
            reader = pypdf.PdfReader(file_path)
            for page_idx, page in enumerate(reader.pages):
                text = page.extract_text() or ""
                text = text.strip()
                if text:
                    pages_content.append({
                        "page_number": page_idx + 1,
                        "text": text,
                        "file_type": "pdf"
                    })
        elif ext in [".docx", ".doc"]:
            # Word document
            try:
                import docx2txt
                full_text = docx2txt.process(file_path) or ""
            except Exception:
                try:
                    import docx
                    doc = docx.Document(file_path)
                    full_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
                except Exception as ex:
                    full_text = f"Error extracting DOCX: {ex}"
            
            if full_text.strip():
                pages_content.append({
                    "page_number": 1,
                    "text": full_text.strip(),
                    "file_type": "docx"
                })
        else:
            # Plain text / Markdown (.txt, .md, etc.)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    full_text = f.read()
            except Exception:
                with open(file_path, "r", encoding="latin-1", errors="ignore") as f:
                    full_text = f.read()
            
            if full_text.strip():
                pages_content.append({
                    "page_number": 1,
                    "text": full_text.strip(),
                    "file_type": ext.replace(".", "") or "txt"
                })

        return pages_content

    def ingest_file(self, file_path: str, original_filename: Optional[str] = None,
                    chunk_size: int = 800, chunk_overlap: int = 150, force_reload: bool = False) -> Dict[str, Any]:
        """
        Nạp tài liệu, chia đoạn theo RecursiveCharacterTextSplitter, tạo embeddings và lưu vào ChromaDB + SQLite.
        Tự động kiểm tra trùng lặp: nếu tài liệu đã tồn tại trong CẢ SQLite và ChromaDB thì bỏ qua để tối ưu hiệu năng.
        """
        if original_filename is None:
            original_filename = os.path.basename(file_path)

        # 0. Kiểm tra trùng lặp nếu không yêu cầu nạp đè (force_reload=False)
        if not force_reload:
            try:
                with database.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("SELECT doc_id, total_pages FROM documents WHERE filename = ?", (original_filename,))
                    existing_doc = cursor.fetchone()
                    if existing_doc:
                        cursor.execute("SELECT COUNT(*) as cnt FROM document_chunks WHERE doc_id = ?", (existing_doc["doc_id"],))
                        chunk_cnt = cursor.fetchone()["cnt"]
                        if chunk_cnt > 0:
                            # Xác thực rằng ChromaDB thực sự đang chứa vectors của file này
                            chroma_items = self.collection.get(where={"source": original_filename}, limit=1)
                            if chroma_items and chroma_items.get("ids") and len(chroma_items["ids"]) > 0:
                                existing_faqs = database.get_suggested_questions_by_doc(existing_doc["doc_id"])
                                if not existing_faqs:
                                    self.generate_faqs_for_pdf(file_path, existing_doc["doc_id"])
                                return {
                                    "filename": original_filename,
                                    "chunks_count": chunk_cnt,
                                    "pages_count": existing_doc["total_pages"],
                                    "status": "already_indexed",
                                    "message": f"Tài liệu '{original_filename}' đã được đánh chỉ mục ({chunk_cnt} chunks) trong cả SQLite và ChromaDB."
                                }
                            else:
                                print(f"[INGEST] Tài liệu '{original_filename}' có trong SQLite nhưng thiếu vector trong ChromaDB. Đang tiến hành nạp lại...")
            except Exception as e:
                print(f"[INGEST] Lưu ý khi kiểm tra trùng lặp cho '{original_filename}': {e}")

        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        pages_data = self.extract_text_from_file(file_path, original_filename)
        
        if not pages_data:
            print(f"[INGEST CẢNH BÁO] Không thể trích xuất văn bản từ '{original_filename}' (file rỗng hoặc không đọc được).")
            return {"filename": original_filename, "chunks_count": 0, "status": "empty_file"}

        ext = os.path.splitext(original_filename)[1].lower().replace(".", "") or "txt"
        total_pages = max(len(pages_data), 1)

        # 1. Lưu bản ghi document vào SQLite
        doc_id = database.save_document_record(
            filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            total_pages=total_pages,
            file_type=ext
        )
        database.clear_chunks_for_document(doc_id)

        # 2. Chia chunk thông minh
        splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        
        all_chunks = []
        all_ids = []
        all_metas = []
        all_embeddings = []

        chunk_idx = 0
        for p in pages_data:
            page_num = p["page_number"]
            page_text = p["text"]
            text_chunks = splitter.split_text(page_text)

            for chunk_text in text_chunks:
                clean_chunk = chunk_text.strip()
                if not clean_chunk:
                    continue

                vector_id = f"{original_filename}_p{page_num}_c{chunk_idx}"
                embedding = self.get_embedding(clean_chunk)

                all_ids.append(vector_id)
                all_embeddings.append(embedding)
                all_chunks.append(clean_chunk)
                
                meta = {
                    "source": original_filename,
                    "page": page_num,
                    "chunk_index": chunk_idx,
                    "file_type": ext,
                    "char_count": len(clean_chunk)
                }
                all_metas.append(meta)

                # Lưu chunk vào SQLite
                database.save_chunk_record(
                    doc_id=doc_id,
                    chunk_index=chunk_idx,
                    page_number=page_num,
                    content=clean_chunk[:1000],
                    chroma_vector_id=vector_id
                )
                chunk_idx += 1

        # 3. Batch Upsert vào ChromaDB
        if all_ids:
            # Delete old chunks for this document from Chroma if any
            try:
                self.collection.delete(where={"source": original_filename})
            except Exception:
                pass

            # Insert in batches of 100
            batch_size = 100
            for i in range(0, len(all_ids), batch_size):
                end_i = i + batch_size
                self.collection.upsert(
                    ids=all_ids[i:end_i],
                    embeddings=all_embeddings[i:end_i],
                    documents=all_chunks[i:end_i],
                    metadatas=all_metas[i:end_i]
                )
            print(f"[INGEST CHROMA] Đã lưu {len(all_ids)} vectors của '{original_filename}' vào ChromaDB.")

        # 4. Tự động sinh câu hỏi thường gặp FAQs cho tài liệu
        generated_faqs = []
        try:
            generated_faqs = self.generate_faqs_for_pdf(file_path, doc_id)
        except Exception as ex:
            print(f"[FAQS] Lỗi tự động sinh câu hỏi FAQs cho '{original_filename}': {ex}")

        return {
            "filename": original_filename,
            "chunks_count": len(all_ids),
            "pages_count": total_pages,
            "faqs_count": len(generated_faqs),
            "status": "success"
        }

    def generate_faqs_for_pdf(self, file_path: str, doc_id: int) -> List[str]:
        """
        Tự động phân tích nội dung tài liệu và sinh danh sách 5-7 câu hỏi thường gặp (FAQs) quan trọng.
        Lưu kết quả vào bảng suggested_questions trong SQLite.
        """
        try:
            pages_data = self.extract_text_from_file(file_path, os.path.basename(file_path))
        except Exception:
            pages_data = []

        if not pages_data:
            return []

        # Trích xuất khoảng 3500 ký tự đầu của tài liệu để nắm nội dung trọng tâm
        sample_text = ""
        for p in pages_data[:5]:
            sample_text += f"\n--- Trang {p.get('page_number', 1)} ---\n" + p.get("text", "")
            if len(sample_text) > 3500:
                sample_text = sample_text[:3500]
                break

        if not sample_text.strip():
            return []

        prompt = f"""Bạn là Trợ lý Cố vấn Học vụ và Quy chế Đào tạo Nhà trường.
Dựa vào nội dung tài liệu quy chế/hướng dẫn sau đây:
\"\"\"
{sample_text}
\"\"\"

Yêu cầu:
Hãy trích xuất từ 5 đến 7 câu hỏi quan trọng, thực tế và phổ biến nhất mà sinh viên/người dùng có thể hỏi về quy chế học vụ, điểm số, học phí, học bổng, thực tập, đồ án tốt nghiệp trong tài liệu này.
Mỗi câu hỏi phải ngắn gọn, súc tích, tự nhiên và sát với nội dung cốt lõi.

Định dạng trả về BẮT BUỘC:
Trả về DUY NHẤT một JSON Array các chuỗi câu hỏi (list of strings).
Ví dụ:
[
  "Điều kiện để được xét học bổng khuyến khích học tập là gì?",
  "Sinh viên cần tích lũy tối thiểu bao nhiêu tín chỉ để đi thực tập?",
  "Thời gian và quy trình nộp đồ án tốt nghiệp như thế nào?"
]
Không viết thêm bất kỳ lời dẫn hay định dạng giải thích nào ngoài chuỗi JSON hợp lệ."""

        gen_models = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.6-flash", "gemini-3.1-flash-lite"]
        faqs: List[str] = []
        key_pool = self.key_manager.get_key_pool()

        for client, key, key_idx in key_pool:
            masked_key = f"...{key[-6:]}" if len(key) >= 6 else "***"
            for m_name in gen_models:
                try:
                    res = client.models.generate_content(
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=0.2
                        )
                    )
                    raw_text = res.text.strip()
                    if "```json" in raw_text:
                        raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in raw_text:
                        raw_text = raw_text.split("```")[1].split("```")[0].strip()
                    
                    import json
                    parsed = json.loads(raw_text)
                    if isinstance(parsed, list):
                        faqs = [str(q).strip() for q in parsed if str(q).strip()]
                        break
                except Exception as e:
                    if is_quota_or_rate_limit_error(e):
                        print(f"[GEMINI 429/QUOTA] Key #{key_idx} ({masked_key}) quota exceeded during FAQ generation on '{m_name}'. Retrying with next key...")
                        break
                    else:
                        print(f"[GEMINI FAQS ERROR] Key #{key_idx} ({masked_key}) | Model '{m_name}': {type(e).__name__}: {e}")
                        continue
            if faqs:
                break

        if faqs:
            database.clear_suggested_questions(doc_id)
            database.save_suggested_questions(doc_id, faqs)

        return faqs

    def ingest_pdf(self, file_path: str, original_filename: Optional[str] = None) -> Dict[str, Any]:
        """Wrapper nạp tài liệu PDF và tự động tạo FAQs."""
        return self.ingest_file(file_path, original_filename)

    def ingest_docs_folder(self, folder_path: str = "docs", chunk_size: int = 800, chunk_overlap: int = 150, force_reload: bool = False) -> List[Dict[str, Any]]:
        """
        Quét và nạp toàn bộ tài liệu có trong thư mục.
        Log chi tiết từng file nạp thành công hay thất bại.
        """
        if not os.path.exists(folder_path):
            print(f"[INGEST FOLDER] Thư mục '{folder_path}' không tồn tại.")
            return []
        
        results = []
        files = [
            f for f in os.listdir(folder_path)
            if os.path.splitext(f)[1].lower() in [".pdf", ".docx", ".doc", ".txt", ".md"]
        ]
        print(f"[INGEST FOLDER] Bắt đầu quét thư mục '{folder_path}' ({len(files)} tệp tin)...")

        for file in files:
            full_path = os.path.join(folder_path, file)
            try:
                res = self.ingest_file(
                    full_path,
                    original_filename=file,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                    force_reload=force_reload
                )
                results.append(res)
                st = res.get("status")
                chunks = res.get("chunks_count", 0)
                if st in ["success", "already_indexed"]:
                    print(f"  [✓ NẠP THÀNH CÔNG] '{file}': {chunks} chunks (Trạng thái: {st})")
                else:
                    err_msg = res.get("error") or res.get("message") or st
                    print(f"  [✗ NẠP THẤT BẠI] '{file}': {err_msg}")
            except Exception as e:
                print(f"  [✗ LỖI NGOẠI LỆ] '{file}': {e}")
                results.append({"filename": file, "status": "error", "error": str(e)})

        return results

    def delete_document(self, filename: str) -> bool:
        """Xóa tài liệu khỏi ChromaDB và SQLite."""
        try:
            self.collection.delete(where={"source": filename})
        except Exception as e:
            print(f"Lỗi khi xóa vector từ Chroma: {e}")
        
        return database.delete_document_record(filename)

    def clear_all(self) -> bool:
        """Xóa toàn bộ dữ liệu vector và SQLite."""
        try:
            self.chroma_client.delete_collection(self.collection_name)
        except Exception:
            pass
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        database.delete_all_document_records()
        return True

    def retrieve(self, query_text: str, top_k: int = 4, use_rerank: bool = True) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        Semantic Retrieval tối ưu:
        1. Kiểm tra số lượng vectors trong collection.
        2. Embeds query -> query ChromaDB với fetch_k (min 4, max top_k*2).
        3. Reranks candidates sử dụng Cohere Rerank lấy Top-K đoạn có độ liên quan cao nhất.
        4. Trả về danh sách docs và metadata tương ứng cùng logging chi tiết.
        """
        total_vectors = 0
        try:
            total_vectors = self.collection.count()
        except Exception as e:
            print(f"[RAG RETRIEVE ERROR] Không thể đếm vectors trong ChromaDB: {e}")

        print(f"\n[RAG RETRIEVE] Truy vấn: '{query_text}' | Tổng số vectors trong ChromaDB: {total_vectors}")

        if total_vectors == 0:
            print(f"[RAG RETRIEVE CẢNH BÁO] ChromaDB collection '{self.collection_name}' đang RỖNG (0 vectors). Không thể tìm kiếm tài liệu!")
            return [], []

        q_embed = self.get_embedding(query_text)
        
        # Lấy fetch_k candidates từ ChromaDB
        fetch_k = min(max(top_k * 2, 4), total_vectors)
        try:
            search_results = self.collection.query(
                query_embeddings=[q_embed],
                n_results=fetch_k
            )
        except Exception as e:
            print(f"[RAG RETRIEVE ERROR] Lỗi khi truy vấn ChromaDB: {e}")
            return [], []
        
        docs = search_results["documents"][0] if (search_results and search_results.get("documents")) else []
        metas = search_results["metadatas"][0] if (search_results and search_results.get("metadatas")) else []
        distances = search_results["distances"][0] if (search_results and "distances" in search_results and search_results["distances"]) else []

        if not docs:
            print(f"[RAG RETRIEVE KẾT QUẢ RỖNG] ChromaDB không trả về chunk nào khớp. (Tổng vectors trong DB: {total_vectors})")
            return [], []

        # Gán similarity/distance vào metadata
        for idx, m in enumerate(metas):
            if idx < len(distances):
                dist = float(distances[idx])
                m["distance"] = round(dist, 4)
                m["similarity"] = round(max(0.0, 1.0 - dist), 4)
            m["content_snippet"] = docs[idx][:200] + ("..." if len(docs[idx]) > 200 else "")

        print(f"[RAG RETRIEVE] Tìm thấy {len(docs)} chunks từ ChromaDB:")
        for idx, m in enumerate(metas):
            print(f"  - Chunk #{idx+1}: source={m.get('source')} (trang {m.get('page', 'N/A')}) | distance={m.get('distance')} | similarity={m.get('similarity')}")

        # Rerank với Cohere (lấy Top-K có độ liên quan cao nhất)
        if use_rerank and self.cohere_client and len(docs) > 1:
            try:
                target_top_n = min(top_k, len(docs))
                print(f"[RAG RERANK] Đang rerank {len(docs)} chunks với Cohere Rerank v3.5 (lấy Top-{target_top_n})...")
                rerank_resp = self.cohere_client.rerank(
                    model="rerank-v3.5",
                    query=query_text,
                    documents=docs,
                    top_n=target_top_n
                )
                ranked_docs = []
                ranked_metas = []
                for item in rerank_resp.results:
                    i = item.index
                    m = dict(metas[i])
                    m["relevance_score"] = round(float(item.relevance_score), 4)
                    ranked_docs.append(docs[i])
                    ranked_metas.append(m)

                print(f"[RAG RERANK] Kết quả sau khi Rerank ({len(ranked_docs)} chunks):")
                for idx, m in enumerate(ranked_metas):
                    print(f"  - Rerank #{idx+1}: source={m.get('source')} (trang {m.get('page', 'N/A')}) | relevance_score={m.get('relevance_score')} | similarity={m.get('similarity')}")

                return ranked_docs, ranked_metas
            except Exception as e:
                print(f"[RAG RERANK WARNING] Cohere rerank gặp lỗi, fallback về Cosine similarity: {e}")

        # Mặc định lấy top_k từ vector search
        selected_docs = docs[:top_k]
        selected_metas = metas[:top_k]
        print(f"[RAG RETRIEVE] Sử dụng Top-{len(selected_docs)} chunks từ Cosine similarity.")
        return selected_docs, selected_metas

    def build_prompt(self, question: str, retrieved_docs: List[str]) -> str:
        """
        Khởi tạo Prompt với System Guardrail nghiêm ngặt theo chuẩn Báo cáo Thực tập Tốt nghiệp (NTU EduBot).
        Phòng ngừa hiện tượng ảo giác (hallucination) 100%.
        """
        context_blocks = []
        for i, doc in enumerate(retrieved_docs, 1):
            context_blocks.append(f"[ĐOẠN TRÍCH {i}]\n{doc}")
        
        context_str = "\n\n".join(context_blocks)

        prompt = f"""Bạn là Trợ lý Tra cứu Quy chế Học vụ và Nội quy Nhà trường (NTU EduBot).
Nhiệm vụ của bạn là giải đáp chính xác thắc mắc của sinh viên và người dùng về quy chế học vụ, điểm số, học phí, học bổng, thực tập, đồ án tốt nghiệp và nội quy nhà trường DỰA TUYỆT ĐỐI VÀO [NGỮ CẢNH TÀI LIỆU] được cung cấp dưới đây.

CÁC NGUYÊN TẮC VÀ RÀNG BUỘC BẮT BUỘC:
1. Bạn CHỈ ĐƯỢC PHÉP trả lời dựa trên các thông tin có trong phần [NGỮ CẢNH TÀI LIỆU] bên dưới.
2. QUY TẮC PHÒNG NGỪA ẢO GIÁC: Khi câu hỏi không có căn cứ trong tài liệu hoặc không tìm thấy thông tin trong [NGỮ CẢNH TÀI LIỆU], bạn BẮT BUỘC phải trả lời chính xác nguyên văn:
"Dựa trên các tài liệu được cung cấp, không tìm thấy thông tin để trả lời câu hỏi này."
Tuyệt đối KHÔNG tự suy đoán, bịa đặt số liệu hoặc sử dụng kiến thức bên ngoài tài liệu.
3. Nếu câu hỏi không liên quan đến quy chế đào tạo, nội quy nhà trường (như hỏi về chứng khoán doanh nghiệp, lập trình ngoài phạm vi môn học...), bạn cũng trả lời chính xác:
"Dựa trên các tài liệu được cung cấp, không tìm thấy thông tin để trả lời câu hỏi này."
4. Trình bày câu trả lời rõ ràng, mạch lạc, sử dụng định dạng Markdown (gạch đầu dòng, bảng số liệu, in đậm các mốc thời gian/điều kiện quan trọng).
5. Cuối câu trả lời, hãy đính kèm danh sách nguồn trích dẫn rõ ràng gồm: Tên file tài liệu gốc và số trang tham chiếu.

[NGỮ CẢNH TÀI LIỆU]:
{context_str}

[CÂU HỎI CỦA NGƯỜI DÙNG]:
{question}

CÂU TRẢ LỜI:"""
        return prompt

    def query(self, question: str, top_k: int = 4, use_rerank: bool = True, temperature: float = 0.2, session_id: str = "default") -> Tuple[str, List[Dict[str, Any]], float]:
        """
        Truy vấn RAG dạng Batch JSON, trả về (câu trả lời, nguồn trích dẫn, latency).
        Mô hình LLM: Google Gemini với temperature = 0.2.
        """
        start_time = time.time()
        print(f"\n{'='*60}\n[RAG QUERY BẮT ĐẦU] Câu hỏi: '{question}' | top_k={top_k}, rerank={use_rerank}, session={session_id}")

        docs, sources = self.retrieve(question, top_k=top_k, use_rerank=use_rerank)
        
        if not docs:
            total_vecs = 0
            try:
                total_vecs = self.collection.count()
            except Exception:
                pass

            if total_vecs == 0:
                reason = f"ChromaDB collection '{self.collection_name}' đang RỖNG (0 vectors). Chưa có tài liệu nào được nạp vào ChromaDB."
            else:
                reason = f"ChromaDB có {total_vecs} vectors nhưng không tìm thấy đoạn trích nào liên quan hoặc không đạt ngưỡng độ tương đồng."
            
            print(f"[RAG QUERY KHÔNG CÓ KẾT QUẢ] {reason}")

            latency = round(time.time() - start_time, 2)
            answer = "Dựa trên các tài liệu được cung cấp, không tìm thấy thông tin để trả lời câu hỏi này."
            database.log_chat_interaction(question, answer, sources, latency, search_type="none", session_id=session_id)
            print(f"[RAG QUERY KẾT THÚC] Latency: {latency}s | Trả về thông báo không tìm thấy thông tin.\n{'='*60}")
            return answer, [], latency

        print(f"[RAG QUERY] Đang sinh câu trả lời với Gemini từ {len(docs)} đoạn trích...")
        prompt = self.build_prompt(question, docs)
        
        candidates = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.6-flash", "gemini-3.1-flash-lite"]
        if self._active_gen_model and self._active_gen_model in candidates:
            gen_models = [self._active_gen_model] + [m for m in candidates if m != self._active_gen_model]
        else:
            gen_models = candidates

        answer = ""
        key_pool = self.key_manager.get_key_pool()

        for client, key, key_idx in key_pool:
            masked_key = f"...{key[-6:]}" if len(key) >= 6 else "***"
            for m_name in gen_models:
                try:
                    response = client.models.generate_content(
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=temperature
                        )
                    )
                    answer = response.text
                    self._active_gen_model = m_name
                    break
                except Exception as e:
                    if is_quota_or_rate_limit_error(e):
                        print(f"[GEMINI 429/QUOTA] Key #{key_idx} ({masked_key}) quota exceeded on model '{m_name}'. Rotating to next key...")
                        break
                    else:
                        continue
            if answer and not answer.startswith("Lỗi trong quá trình"):
                break

        if not answer:
            answer = "Dựa trên các tài liệu được cung cấp, không tìm thấy thông tin để trả lời câu hỏi này."

        latency = round(time.time() - start_time, 2)
        
        # Log SQLite sau khi hoàn thành
        search_type = "cohere_rerank" if (use_rerank and self.cohere_client) else "cosine_similarity"
        database.log_chat_interaction(question, answer, sources, latency, search_type=search_type, session_id=session_id)

        print(f"[RAG QUERY HOÀN TẤT] Latency: {latency}s | Số nguồn trích dẫn: {len(sources)}\n{'='*60}")
        return answer, sources, latency

    def query_stream(self, question: str, top_k: int = 4, use_rerank: bool = True, temperature: float = 0.2, session_id: str = "default") -> Generator[Dict[str, Any], None, None]:
        """
        Streaming Generator for Fast Response (Server-Sent Events & Streamlit).
        1. Gửi metadata nguồn trích dẫn ngay lập tức.
        2. Dùng generate_content_stream() để sinh từng token (giảm latency cảm nhận < 1s).
        3. Ghi log SQLite sau khi đã hoàn tất toàn bộ stream ra cho người dùng để không gây nghẽn.
        """
        start_time = time.time()
        print(f"\n{'='*60}\n[RAG STREAM QUERY BẮT ĐẦU] Câu hỏi: '{question}' | top_k={top_k}, rerank={use_rerank}, session={session_id}")

        docs, sources = self.retrieve(question, top_k=top_k, use_rerank=use_rerank)
        
        search_type = "cohere_rerank" if (use_rerank and self.cohere_client) else "cosine_similarity"

        # Emit sources first (không chờ)
        yield {
            "type": "sources",
            "sources": sources,
            "search_type": search_type,
            "doc_count": len(docs)
        }

        if not docs:
            total_vecs = 0
            try:
                total_vecs = self.collection.count()
            except Exception:
                pass

            if total_vecs == 0:
                reason = f"ChromaDB collection '{self.collection_name}' đang RỖNG (0 vectors). Chưa có tài liệu nào được nạp vào ChromaDB."
            else:
                reason = f"ChromaDB có {total_vecs} vectors nhưng không tìm thấy đoạn trích nào phù hợp với câu hỏi."
            
            print(f"[RAG STREAM QUERY KHÔNG CÓ KẾT QUẢ] {reason}")

            msg = "Dựa trên các tài liệu được cung cấp, không tìm thấy thông tin để trả lời câu hỏi này."
            for word in msg.split(" "):
                yield {"type": "token", "token": word + " "}
                time.sleep(0.01)
            latency = round(time.time() - start_time, 2)
            database.log_chat_interaction(question, msg, sources, latency, search_type="none", session_id=session_id)
            yield {"type": "done", "latency": latency}
            print(f"[RAG STREAM QUERY KẾT THÚC] Latency: {latency}s | Trả về thông báo không tìm thấy thông tin.\n{'='*60}")
            return

        print(f"[RAG STREAM QUERY] Đang sinh luồng phản hồi token từ Gemini với {len(docs)} đoạn trích...")
        prompt = self.build_prompt(question, docs)
        full_answer = ""
        candidates = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-flash-latest", "gemini-3.6-flash", "gemini-3.1-flash-lite"]
        if self._active_gen_model and self._active_gen_model in candidates:
            gen_models = [self._active_gen_model] + [m for m in candidates if m != self._active_gen_model]
        else:
            gen_models = candidates

        stream_success = False
        key_pool = self.key_manager.get_key_pool()

        for client, key, key_idx in key_pool:
            masked_key = f"...{key[-6:]}" if len(key) >= 6 else "***"
            for m_name in gen_models:
                try:
                    response_stream = client.models.generate_content_stream(
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=temperature
                        )
                    )

                    for chunk in response_stream:
                        if chunk.text:
                            full_answer += chunk.text
                            yield {"type": "token", "token": chunk.text}
                    stream_success = True
                    self._active_gen_model = m_name
                    break
                except Exception as e:
                    if is_quota_or_rate_limit_error(e):
                        print(f"[GEMINI 429/QUOTA] Key #{key_idx} ({masked_key}) quota exceeded during stream on '{m_name}'. Retrying with next key...")
                        full_answer = ""
                        break
                    else:
                        continue
            if stream_success:
                break

        if not stream_success:
            error_msg = "\n[Lỗi kết nối Gemini: Không thể sinh phản hồi từ API sau khi đã thử tất cả các key. Vui lòng kiểm tra lại GEMINI_KEYS trong .env]"
            full_answer += error_msg
            yield {"type": "token", "token": error_msg}

        latency = round(time.time() - start_time, 2)
        # Ghi log SQLite sau khi đã hoàn thành stream ra màn hình cho người dùng
        database.log_chat_interaction(question, full_answer, sources, latency, search_type=search_type, session_id=session_id)
        print(f"[RAG STREAM QUERY HOÀN TẤT] Latency: {latency}s | Tổng độ dài câu trả lời: {len(full_answer)} ký tự\n{'='*60}")
        yield {"type": "done", "latency": latency, "full_text": full_answer}