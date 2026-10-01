import json
import os
import re
import sys
import threading
import time
from typing import Any, Dict, Generator, List, Optional, Tuple

import chromadb
import cohere
from dotenv import load_dotenv
from google import genai
from google.genai import types
import pypdf

import data as database

# UTF-8 stdout/stderr reconfiguration for Windows terminals
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

load_dotenv()

# System Messages & Guardrails
FRIENDLY_OVERLOAD_MESSAGE = (
    "Xin lỗi cậu nha, hiện tại hệ thống AI đang bị quá tải lượt truy vấn trong giây lát. "
    "Cậu vui lòng đợi khoảng 1-2 phút rồi thử gửi lại câu hỏi giúp tớ nhé!"
)

NO_INFO_FALLBACK_MESSAGE = (
    "Xin lỗi cậu nha, tớ không tìm thấy thông tin này trong tài liệu học vụ hiện có của trường mình. "
    "Cậu thử kiểm tra lại từ khóa hoặc hỏi phòng đào tạo xem sao nhé!"
)

OUT_OF_SCOPE_MESSAGE = (
    "Xin lỗi cậu nhé, tớ chỉ có thể hỗ trợ các thông tin liên quan đến học vụ và quy chế của NTU thôi nè."
)

DEFAULT_EMBED_MODELS = [
    "gemini-embedding-001",
    "text-embedding-004",
    "models/gemini-embedding-001",
    "models/text-embedding-004",
    "gemini-embedding-2"
]

DEFAULT_GEN_MODELS = [
    "gemini-3.7-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-flash-latest"
]


def expand_query_variants(query: str) -> str:
    """Expands query with common abbreviations, inverted terms, and aliases (e.g. LP06 <-> PL06, LP04 <-> PL04)."""
    expanded = query
    # Match LP06, LP6, LP-06, LP 06, etc. -> add PL06, PL6, Phụ lục 6, Phụ lục 06
    lp_matches = re.findall(r'\b(?:lp)[\s\-_]*0*(\d+)\b', query, flags=re.IGNORECASE)
    for m in lp_matches:
        num = int(m)
        expanded += f" PL{num:02d} PL{num} Phụ lục {num} Phụ lục {num:02d} PL-{num:02d}"
    # Match PL06, PL6, PL-06, PL 06 -> add Phụ lục 6, Phụ lục 06, PL06, PL6
    pl_matches = re.findall(r'\b(?:pl)[\s\-_]*0*(\d+)\b', query, flags=re.IGNORECASE)
    for m in pl_matches:
        num = int(m)
        expanded += f" Phụ lục {num} Phụ lục {num:02d} PL{num:02d} PL{num}"
    return expanded.strip()




def is_quota_or_rate_limit_error(e: Exception) -> bool:
    """Detects 429 Quota Exceeded / Rate Limit / Resource Exhausted errors from Gemini API."""
    if hasattr(e, "code") and getattr(e, "code") == 429:
        return True
    if hasattr(e, "status_code") and getattr(e, "status_code") == 429:
        return True
    if hasattr(e, "status") and "RESOURCE_EXHAUSTED" in str(getattr(e, "status", "")):
        return True

    err_msg = str(e).lower()
    err_type = type(e).__name__.lower()
    keywords = ["429", "resource_exhausted", "resourceexhausted", "quota", "rate limit", "too many requests", "exhausted", "quota_exceeded"]
    return any(kw in err_msg or kw in err_type for kw in keywords)


def get_gemini_error_info(e: Exception) -> Tuple[int, str]:
    """Parses status codes and readable error labels from Gemini API exceptions."""
    code = getattr(e, "code", None) or getattr(e, "status_code", None)
    err_str = str(e).lower()
    err_type = type(e).__name__

    if code is None:
        if is_quota_or_rate_limit_error(e):
            code = 429
        elif any(k in err_str for k in ["invalid", "api_key", "api key not valid", "api_key_invalid"]):
            code = 400
        elif any(k in err_str for k in ["permission_denied", "forbidden"]):
            code = 403
        elif "not_found" in err_str:
            code = 404
        elif "unavailable" in err_str:
            code = 503
        else:
            code = 500

    try:
        code_int = int(code)
    except Exception:
        code_int = 500

    if code_int == 429 or is_quota_or_rate_limit_error(e):
        detail = "429 ResourceExhausted / QuotaExceeded"
    elif code_int == 400 or "invalid" in err_str or "api_key" in err_str:
        detail = f"{code_int} InvalidKey / InvalidArgument"
    elif code_int == 403:
        detail = f"{code_int} PermissionDenied"
    elif code_int == 404:
        detail = f"{code_int} ModelNotFound"
    elif code_int in [500, 502, 503, 504]:
        detail = f"{code_int} ServerUnavailable"
    else:
        detail = f"{code_int} {err_type}"

    return code_int, detail


class GeminiKeyManager:
    """
    Thread-safe Round-Robin Key Manager and Cycler for Google Gemini API Keys.
    Handles robust key parsing, normalization, client instantiation, and request rotation.
    """
    def __init__(self, raw_keys_str: Optional[str] = None):
        self.lock = threading.Lock()
        self.keys: List[str] = []
        self.clients: List[genai.Client] = []
        self._counter: int = 0
        self.load_keys(raw_keys_str)

    @staticmethod
    def mask_key(k: str) -> str:
        """Masks key for safe logging, e.g. ...5Kfvuw or ...F8q2Pg."""
        if not k:
            return "***"
        clean = str(k).strip()
        if len(clean) <= 6:
            return f"...{clean[-3:]}" if len(clean) >= 3 else "***"
        return f"...{clean[-6:]}"

    def get_masked_keys_summary(self) -> str:
        """Returns readable summary of all loaded keys, e.g., '...5Kfvuw, ...F8q2Pg'."""
        if not self.keys:
            return "Không có key nào"
        return ", ".join([self.mask_key(k) for k in self.keys])

    def load_keys(self, raw_keys_str: Optional[str] = None) -> None:
        if raw_keys_str is None:
            raw_sources = []
            env_keys = os.getenv("GEMINI_KEYS", "").strip()
            env_single = os.getenv("GEMINI_API_KEY", "").strip()
            if env_keys:
                raw_sources.append(env_keys)
            if env_single and env_single not in raw_sources:
                raw_sources.append(env_single)
            raw_keys_str = ",".join(raw_sources)

        parsed_keys: List[str] = []
        raw_clean = str(raw_keys_str).strip().strip("[]").strip("()").strip("{}")
        chunks = re.split(r'[,;\n\r]+', raw_clean)
        
        for k in chunks:
            cleaned = k.strip().strip('"').strip("'").strip('`').strip()
            if cleaned and cleaned not in parsed_keys:
                parsed_keys.append(cleaned)

        self.keys = parsed_keys
        self.clients = []
        for idx, k in enumerate(self.keys, 1):
            masked = self.mask_key(k)
            try:
                client = genai.Client(api_key=k)
                self.clients.append(client)
            except Exception as e:
                code_int, label = get_gemini_error_info(e)
                print(f"[GeminiKeyManager] Cảnh báo khởi tạo client cho Key #{idx} ({masked}) [{label}]: {e}")

        masked_summary = self.get_masked_keys_summary()
        print(f"[GeminiKeyManager] Đã nạp {len(self.keys)} Gemini keys: {masked_summary}")

    @property
    def total_keys(self) -> int:
        return len(self.keys)

    def get_key_pool(self) -> List[Tuple[genai.Client, str, int]]:
        """Returns a round-robin ordered list of (client, key, idx) starting from next rotated index."""
        if not self.keys or not self.clients:
            return []

        with self.lock:
            start_idx = self._counter % len(self.clients)
            self._counter += 1

        n = len(self.clients)
        return [(self.clients[(start_idx + i) % n], self.keys[(start_idx + i) % n], (start_idx + i) % n) for i in range(n)]


# Recursive Character Text Splitter (LangChain with self-contained fallback)
try:
    from langchain_text_splitters import RecursiveCharacterTextSplitter  # type: ignore
except ImportError:
    try:
        from langchain.text_splitter import RecursiveCharacterTextSplitter  # type: ignore
    except ImportError:
        class RecursiveCharacterTextSplitter:  # type: ignore
            """Pure Python fallback for RecursiveCharacterTextSplitter."""
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
                            if m:
                                good_splits.append(m)
                            current_chunk, current_len = [], 0
                        good_splits.extend(self._split(item, remaining))
                    elif current_len + item_len <= self.chunk_size:
                        current_chunk.append(item)
                        current_len += item_len
                    else:
                        m = "".join(current_chunk).strip()
                        if m:
                            good_splits.append(m)
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
                    if m:
                        good_splits.append(m)
                return [c for c in good_splits if c.strip()]


class RAGEngine:
    """
    Production-Grade RAG Engine supporting:
    - Multi-format document ingestion (.pdf, .docx, .txt, .md)
    - Recursive Character text splitting
    - ChromaDB Vector Store with Cosine distance
    - Google Embedding & Gemini generation with round-robin key management and rate limit fallbacks
    - SQLite database for documents, chunks, suggested questions, and chat history
    - Cohere Reranking with graceful fallback to cosine similarity
    - Streaming (SSE) and JSON responses
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

        # Gemini Multi-Key Manager
        self.key_manager = GeminiKeyManager()
        self.gemini_keys = self.key_manager.keys
        self._active_embed_model: Optional[str] = None
        self._active_gen_model: Optional[str] = None

        # Cohere Reranker
        self.cohere_key = os.getenv("COHERE_API_KEY", "").strip()
        self.cohere_client = cohere.Client(api_key=self.cohere_key) if self.cohere_key else None

    def reload_collection(self):
        """Refreshes and syncs ChromaDB collection state from persistent storage, re-initializing client and collection."""
        try:
            if hasattr(self.chroma_client, "persist"):
                self.chroma_client.persist()
        except Exception:
            pass

        try:
            self.chroma_client = chromadb.PersistentClient(path=self.chroma_path)
            self.collection = self.chroma_client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        except Exception as e:
            print(f"[RELOAD COLLECTION ERROR] {e}")

        return self.collection

    @property
    def gemini_client(self) -> Optional[genai.Client]:
        """Provides backward-compatible access to primary client."""
        return self.key_manager.clients[0] if self.key_manager.clients else None

    def get_embedding(self, text: str) -> List[float]:
        """Generates embedding vector with automatic key rotation, backoff, and model fallback."""
        if not self.key_manager.total_keys:
            raise ValueError("GEMINI_API_KEY hoặc GEMINI_KEYS chưa được cấu hình trong .env")

        candidates = DEFAULT_EMBED_MODELS
        if self._active_embed_model and self._active_embed_model in candidates:
            embed_models = [self._active_embed_model] + [m for m in candidates if m != self._active_embed_model]
        else:
            embed_models = candidates

        last_err: Optional[Exception] = None

        for model_idx, model_name in enumerate(embed_models):
            key_pool = self.key_manager.get_key_pool()
            for client, key, key_idx in key_pool:
                masked_key = self.key_manager.mask_key(key)
                try:
                    res = client.models.embed_content(
                        model=model_name,
                        contents=text
                    )
                    self._active_embed_model = model_name
                    return res.embeddings[0].values
                except Exception as e:
                    last_err = e
                    code_int, label = get_gemini_error_info(e)
                    print(f"[GEMINI EMBED ERROR] Key #{key_idx+1} ({masked_key}) | Model '{model_name}' | Status: {code_int} ({label}) | Chi tiết: {e}")
                    if code_int == 429 or is_quota_or_rate_limit_error(e):
                        print(f"[GEMINI EMBED ROTATE] Quota/RateLimit trên Key #{key_idx+1}. Chờ 0.5s và xoay sang Key tiếp theo...")
                    elif code_int in [400, 403]:
                        print(f"[GEMINI EMBED ROTATE] Key #{key_idx+1} không hợp lệ hoặc bị cấm ({label}). Chuyển sang Key tiếp theo...")
                    time.sleep(0.5)
                    continue

            next_embed_model = embed_models[model_idx + 1] if model_idx + 1 < len(embed_models) else None
            if next_embed_model:
                print(f"[GEMINI EMBED FALLBACK] Tất cả {len(key_pool)} keys đều lỗi với embed model '{model_name}'. Chuyển sang fallback model '{next_embed_model}'...")
                time.sleep(0.5)

        if last_err:
            raise last_err
        raise ValueError("Không thể tạo embedding từ tất cả các API keys.")

    def extract_text_from_file(self, file_path: str, original_filename: str) -> List[Dict[str, Any]]:
        """Extracts text content and pages from (.pdf, .docx, .doc, .txt, .md)."""
        ext = os.path.splitext(original_filename)[1].lower()
        pages_content: List[Dict[str, Any]] = []

        if ext == ".pdf":
            reader = pypdf.PdfReader(file_path)
            for page_idx, page in enumerate(reader.pages):
                text = (page.extract_text() or "").strip()
                if text:
                    pages_content.append({
                        "page_number": page_idx + 1,
                        "text": text,
                        "file_type": "pdf"
                    })
        elif ext in [".docx", ".doc"]:
            full_text = ""
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
            full_text = ""
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

    def ingest_file(
        self,
        file_path: str,
        original_filename: Optional[str] = None,
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        force_reload: bool = False
    ) -> Dict[str, Any]:
        """Splits, embeds, and stores documents in ChromaDB and SQLite."""
        if original_filename is None:
            original_filename = os.path.basename(file_path)

        # 0. Check for existing indexed document
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
                                    "message": f"Tài liệu '{original_filename}' đã được đánh chỉ mục ({chunk_cnt} chunks)."
                                }
            except Exception as e:
                print(f"[INGEST] Kiểm tra trùng lặp cho '{original_filename}': {e}")

        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        pages_data = self.extract_text_from_file(file_path, original_filename)

        if not pages_data:
            print(f"[INGEST CẢNH BÁO] Không thể trích xuất văn bản từ '{original_filename}'.")
            return {"filename": original_filename, "chunks_count": 0, "status": "empty_file"}

        ext = os.path.splitext(original_filename)[1].lower().replace(".", "") or "txt"
        total_pages = max(len(pages_data), 1)

        # 1. Save document to SQLite
        doc_id = database.save_document_record(
            filename=original_filename,
            file_path=file_path,
            file_size=file_size,
            total_pages=total_pages,
            file_type=ext
        )
        database.clear_chunks_for_document(doc_id)

        # 2. Text splitting & embeddings
        splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        all_chunks: List[str] = []
        all_ids: List[str] = []
        all_metas: List[Dict[str, Any]] = []
        all_embeddings: List[List[float]] = []

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

                database.save_chunk_record(
                    doc_id=doc_id,
                    chunk_index=chunk_idx,
                    page_number=page_num,
                    content=clean_chunk[:1000],
                    chroma_vector_id=vector_id
                )
                chunk_idx += 1

        # 3. Batch Upsert into ChromaDB
        if all_ids:
            try:
                self.collection.delete(where={"source": original_filename})
            except Exception:
                pass

            batch_size = 100
            for i in range(0, len(all_ids), batch_size):
                end_i = i + batch_size
                self.collection.upsert(
                    ids=all_ids[i:end_i],
                    embeddings=all_embeddings[i:end_i],
                    documents=all_chunks[i:end_i],
                    metadatas=all_metas[i:end_i]
                )
            self.reload_collection()
            print(f"[INGEST CHROMA] Đã lưu và đồng bộ {len(all_ids)} vectors của '{original_filename}' vào ChromaDB.")

        # 4. Generate suggested FAQs
        generated_faqs: List[str] = []
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
        """Generates 5-7 frequent questions (FAQs) from document content and saves to SQLite."""
        try:
            pages_data = self.extract_text_from_file(file_path, os.path.basename(file_path))
        except Exception:
            pages_data = []

        if not pages_data:
            return []

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
  "Sinh viên cần tích lũy tối thiểu bao nhiêu tín chỉ để đi thực tập?"
]
Không viết thêm bất kỳ lời dẫn hay định dạng giải thích nào ngoài chuỗi JSON hợp lệ."""

        faqs: List[str] = []
        for m_name in DEFAULT_GEN_MODELS:
            key_pool = self.key_manager.get_key_pool()
            for client, key, key_idx in key_pool:
                masked_key = self.key_manager.mask_key(key)
                try:
                    res = client.models.generate_content(
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(temperature=0.2)
                    )
                    raw_text = res.text.strip()
                    if "```json" in raw_text:
                        raw_text = raw_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in raw_text:
                        raw_text = raw_text.split("```")[1].split("```")[0].strip()

                    parsed = json.loads(raw_text)
                    if isinstance(parsed, list):
                        faqs = [str(q).strip() for q in parsed if str(q).strip()]
                        break
                except Exception as e:
                    code_int, label = get_gemini_error_info(e)
                    print(f"[GEMINI FAQ ERROR] Key #{key_idx+1} ({masked_key}) | Model '{m_name}' | Status: {code_int} ({label}) | Chi tiết: {e}")
                    if code_int == 429 or is_quota_or_rate_limit_error(e):
                        print(f"[GEMINI FAQ ROTATE] Quota/RateLimit trên Key #{key_idx+1}. Chờ 0.5s và xoay sang Key tiếp theo...")
                    elif code_int in [400, 403]:
                        print(f"[GEMINI FAQ ROTATE] Key #{key_idx+1} không hợp lệ hoặc bị cấm ({label}). Chuyển sang Key tiếp theo...")
                    time.sleep(0.5)
                    continue
            if faqs:
                break

        if faqs:
            database.clear_suggested_questions(doc_id)
            database.save_suggested_questions(doc_id, faqs)

        return faqs

    def ingest_pdf(self, file_path: str, original_filename: Optional[str] = None) -> Dict[str, Any]:
        """Convenience wrapper for PDF ingestion."""
        return self.ingest_file(file_path, original_filename)

    def ingest_docs_folder(
        self,
        folder_path: str = "docs",
        chunk_size: int = 800,
        chunk_overlap: int = 150,
        force_reload: bool = False
    ) -> List[Dict[str, Any]]:
        """Scans and ingests all supported documents in folder."""
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

        self.reload_collection()
        return results

    def delete_document(self, filename: str) -> bool:
        """Deletes document vectors from ChromaDB and metadata from SQLite."""
        try:
            self.collection.delete(where={"source": filename})
        except Exception as e:
            print(f"Lỗi khi xóa vector từ Chroma: {e}")

        self.reload_collection()
        return database.delete_document_record(filename)

    def clear_all(self) -> bool:
        """Wipes all vectors from ChromaDB and document records from SQLite."""
        try:
            self.chroma_client.delete_collection(self.collection_name)
        except Exception:
            pass
        self.collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )
        self.reload_collection()
        database.delete_all_document_records()
        return True

    def retrieve(self, query_text: str, top_k: int = 4, use_rerank: bool = True) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        Retrieves top relevant chunks from ChromaDB with query expansion, document tag matching, and Cohere Reranking.
        """
        total_vectors = 0
        try:
            total_vectors = self.collection.count()
        except Exception as e:
            print(f"[RAG RETRIEVE ERROR] Không thể đếm vectors trong ChromaDB: {e}")

        print(f"\n[RAG RETRIEVE] Truy vấn: '{query_text}' | Tổng số vectors trong ChromaDB: {total_vectors}")

        if total_vectors == 0:
            print(f"[RAG RETRIEVE CẢNH BÁO] ChromaDB collection '{self.collection_name}' đang RỖNG (0 vectors).")
            return [], []

        expanded_query = expand_query_variants(query_text)
        q_embed = self.get_embedding(expanded_query)
        fetch_k = min(max(top_k * 3, 6), total_vectors)

        try:
            search_results = self.collection.query(
                query_embeddings=[q_embed],
                n_results=fetch_k
            )
        except Exception as e:
            print(f"[RAG RETRIEVE ERROR] Lỗi khi truy vấn ChromaDB: {e}")
            return [], []

        docs = list(search_results["documents"][0]) if (search_results and search_results.get("documents")) else []
        metas = list(search_results["metadatas"][0]) if (search_results and search_results.get("metadatas")) else []
        distances = list(search_results["distances"][0]) if (search_results and search_results.get("distances")) else []

        for idx, m in enumerate(metas):
            if idx < len(distances):
                dist = float(distances[idx])
                m["distance"] = round(dist, 4)
                m["similarity"] = round(max(0.0, 1.0 - dist), 4)
            m["content_snippet"] = docs[idx][:200] + ("..." if len(docs[idx]) > 200 else "")

        # Check for direct document tag / abbreviation matches (e.g. LP06/PL06, LP04/PL04) in indexed documents
        tag_matches = re.findall(r'\b(?:pl|lp)[\s\-_]*0*(\d+)\b', query_text, flags=re.IGNORECASE)
        if tag_matches:
            for tag_num in tag_matches:
                t_int = int(tag_num)
                target_tags = [f"PL{t_int:02d}", f"PL{t_int}", f"PL-{t_int:02d}", f"Phụ lục {t_int}", f"Phụ lục {t_int:02d}"]
                try:
                    all_meta_sample = self.collection.get(include=["documents", "metadatas"])
                    if all_meta_sample and all_meta_sample.get("documents"):
                        for doc_text, meta_dict in zip(all_meta_sample["documents"], all_meta_sample["metadatas"]):
                            src = str(meta_dict.get("source", "")) if meta_dict else ""
                            matched = any(tag.lower() in src.lower() or tag.lower() in doc_text[:100].lower() for tag in target_tags)
                            if matched and doc_text not in docs:
                                m = dict(meta_dict or {})
                                m["similarity"] = 0.90
                                m["distance"] = 0.10
                                m["content_snippet"] = doc_text[:200] + ("..." if len(doc_text) > 200 else "")
                                docs.insert(0, doc_text)
                                metas.insert(0, m)
                except Exception as ex:
                    print(f"[RAG RETRIEVE TAG BOOST] {ex}")

        if not docs:
            return [], []

        # Rerank with Cohere if available
        if use_rerank and self.cohere_client and len(docs) > 1:
            try:
                target_top_n = min(top_k, len(docs))
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
                return ranked_docs, ranked_metas
            except Exception as e:
                print(f"[RAG RERANK WARNING] Cohere rerank lỗi, fallback về Cosine similarity: {e}")

        return docs[:top_k], metas[:top_k]

    def build_prompt(self, question: str, retrieved_docs: List[str]) -> str:
        """Constructs prompt with flexible context understanding, abbreviation handling, and conversational style."""
        context_blocks = [f"[ĐOẠN TRÍCH {i}]\n{doc}" for i, doc in enumerate(retrieved_docs, 1)]
        context_str = "\n\n".join(context_blocks)

        return f"""Bạn là NTU EduBot - một người bạn đại học đồng hành thông minh, thân thiện, chu đáo và nhiệt tình của các bạn sinh viên Đại học Nha Trang (NTU) và người dùng tra cứu thông tin học vụ, quy chế, kế hoạch và tài liệu liên quan.
Nhiệm vụ của bạn là giải đáp thắc mắc, tóm tắt và hướng dẫn DỰA TRÊN [NGỮ CẢNH TÀI LIỆU] được cung cấp dưới đây.

CÁC NGUYÊN TẮC GIAO TIẾP VÀ HƯỚNG DẪN XỬ LÝ BẮT BUỘC:
1. XƯNG HÔ VÀ GIỌNG ĐIỆU THÂN THIỆN:
   - Luôn xưng hô là "tớ" và gọi người dùng là "cậu" như một người bạn đại học đồng hành gần gũi, ấm áp, nhiệt tình và lịch sự.
   - Trình bày câu trả lời rõ ràng, mạch lạc bằng các gạch đầu dòng ngắn gọn, bôi đậm các từ khóa hoặc mốc thông tin quan trọng.

2. NHẬN DIỆN BIẾN THỂ VIẾT TẮT & ĐẢO CHỮ:
   - Chấp nhận các biến thể viết tắt hoặc đảo chữ của người dùng (ví dụ: LP04/PL04, LP06/PL06, Phụ lục 4/Phụ lục 6, ĐTT/Đinh Tiến Triển, TTTN/Thực tập tốt nghiệp, CNTT & CĐS...).
   - Nếu người dùng hỏi "LP06", "tài liệu LP06", tự động hiểu và liên kết với bối cảnh từ file/biểu mẫu "PL06" hoặc "Phụ lục 06" có trong context.

3. ƯU TIÊN PHÂN TÍCH VÀ GIẢI THÍCH NỘI DUNG TÀI LIỆU MỚI NẠP:
   - Ưu tiên phân tích và giải thích nội dung dựa trên các đoạn trích từ tài liệu mới nạp được cung cấp trong [NGỮ CẢNH TÀI LIỆU].
   - Nếu context chứa văn bản của biểu mẫu/tài liệu đó, hãy trích xuất công dụng và mục đích sử dụng, thông tin người thực hiện, cơ quan tiếp nhận và kế hoạch công việc để trả lời ngay lập tức, KHÔNG ĐƯỢC TỪ CHỐI nếu context có dữ liệu.

4. QUY TẮC BẢO VỆ VÀ XỬ LÝ KHI THIẾU THÔNG TIN (GUARDRAILS):
   - Chỉ đưa ra thông tin có căn cứ từ [NGỮ CẢNH TÀI LIỆU], không tự bịa đặt số liệu hoặc suy diễn sai lệch ngoài tài liệu.
   - CHỈ trả lời chính xác nguyên văn câu sau khi [NGỮ CẢNH TÀI LIỆU] HOÀN TOÀN TRỐNG RỖNG hoặc 100% KHÔNG CHỨA BẤT KỲ THÔNG TIN NÀO liên quan đến câu hỏi:
   "{NO_INFO_FALLBACK_MESSAGE}"
   - Với các câu hỏi hoàn toàn ngoài lề, nhạy cảm hoặc vi phạm (như chứng khoán, chính trị, xúc phạm...), hãy trả lời chính xác:
   "{OUT_OF_SCOPE_MESSAGE}"

[NGỮ CẢNH TÀI LIỆU]:
{context_str}

[CÂU HỎI CỦA NGƯỜI DÙNG]:
{question}

CÂU TRẢ LỜI:"""

    def query(
        self,
        question: str,
        top_k: int = 4,
        use_rerank: bool = True,
        temperature: float = 0.2,
        session_id: str = "default"
    ) -> Tuple[str, List[Dict[str, Any]], float]:
        """Synchronous batch query returning (answer, sources, latency) with robust multi-key rotation and model fallback."""
        start_time = time.time()
        docs, sources = self.retrieve(question, top_k=top_k, use_rerank=use_rerank)

        if not docs:
            latency = round(time.time() - start_time, 2)
            answer = NO_INFO_FALLBACK_MESSAGE
            database.log_chat_interaction(question, answer, sources, latency, search_type="none", session_id=session_id)
            return answer, [], latency

        prompt = self.build_prompt(question, docs)
        candidates = DEFAULT_GEN_MODELS
        if self._active_gen_model and self._active_gen_model in candidates:
            gen_models = [self._active_gen_model] + [m for m in candidates if m != self._active_gen_model]
        else:
            gen_models = candidates

        answer = ""
        for model_idx, m_name in enumerate(gen_models):
            key_pool = self.key_manager.get_key_pool()
            if not key_pool:
                print("[GEMINI ERROR] Không có Gemini API key nào khả dụng.")
                break

            for client, key, key_idx in key_pool:
                masked_key = self.key_manager.mask_key(key)
                try:
                    response = client.models.generate_content(
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(temperature=temperature)
                    )
                    if response and response.text:
                        answer = response.text
                        self._active_gen_model = m_name
                        break
                except Exception as e:
                    code_int, label = get_gemini_error_info(e)
                    print(f"[GEMINI ERROR] Key #{key_idx+1} ({masked_key}) | Model: '{m_name}' | Status: {code_int} ({label}) | Chi tiết: {e}")
                    if code_int == 429 or is_quota_or_rate_limit_error(e):
                        print(f"[GEMINI ROTATE] Gặp lỗi 429 Quota/RateLimit trên Key #{key_idx+1}. Chờ 0.5s và tự động chuyển sang Key tiếp theo...")
                    elif code_int in [400, 403]:
                        print(f"[GEMINI ROTATE] Key #{key_idx+1} bị lỗi xác thực/quyền ({label}). Chuyển sang Key tiếp theo...")
                    else:
                        print(f"[GEMINI RETRY] Lỗi gọi Gemini API ({label}). Thử key tiếp theo...")
                    time.sleep(0.5)
                    continue

            if answer and not answer.startswith("Lỗi trong quá trình"):
                break
            else:
                next_model = gen_models[model_idx + 1] if model_idx + 1 < len(gen_models) else None
                if next_model:
                    print(f"[GEMINI FALLBACK] Tất cả {len(key_pool)} keys đều bị nghẽn quota hoặc lỗi với model '{m_name}'. Tự động fallback sang model '{next_model}'...")
                    time.sleep(0.5)

        if not answer:
            answer = FRIENDLY_OVERLOAD_MESSAGE

        latency = round(time.time() - start_time, 2)
        search_type = "cohere_rerank" if (use_rerank and self.cohere_client) else "cosine_similarity"
        database.log_chat_interaction(question, answer, sources, latency, search_type=search_type, session_id=session_id)

        return answer, sources, latency

    def query_stream(
        self,
        question: str,
        top_k: int = 4,
        use_rerank: bool = True,
        temperature: float = 0.2,
        session_id: str = "default"
    ) -> Generator[Dict[str, Any], None, None]:
        """Streaming generator yielding token events for SSE and real-time UI with robust multi-key rotation and model fallback."""
        start_time = time.time()
        docs, sources = self.retrieve(question, top_k=top_k, use_rerank=use_rerank)
        search_type = "cohere_rerank" if (use_rerank and self.cohere_client) else "cosine_similarity"

        # Emit sources first
        yield {
            "type": "sources",
            "sources": sources,
            "search_type": search_type,
            "doc_count": len(docs)
        }

        if not docs:
            msg = NO_INFO_FALLBACK_MESSAGE
            for word in msg.split(" "):
                yield {"type": "token", "token": word + " "}
                time.sleep(0.01)
            latency = round(time.time() - start_time, 2)
            database.log_chat_interaction(question, msg, sources, latency, search_type="none", session_id=session_id)
            yield {"type": "done", "latency": latency}
            return

        prompt = self.build_prompt(question, docs)
        full_answer = ""
        candidates = DEFAULT_GEN_MODELS
        if self._active_gen_model and self._active_gen_model in candidates:
            gen_models = [self._active_gen_model] + [m for m in candidates if m != self._active_gen_model]
        else:
            gen_models = candidates

        stream_success = False

        for model_idx, m_name in enumerate(gen_models):
            key_pool = self.key_manager.get_key_pool()
            if not key_pool:
                print("[GEMINI ERROR] Không có Gemini API key nào khả dụng.")
                break

            for client, key, key_idx in key_pool:
                masked_key = self.key_manager.mask_key(key)
                partial_stream_text = ""
                try:
                    response_stream = client.models.generate_content_stream(
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(temperature=temperature)
                    )

                    for chunk in response_stream:
                        if chunk.text:
                            partial_stream_text += chunk.text
                            yield {"type": "token", "token": chunk.text}

                    if partial_stream_text.strip():
                        full_answer = partial_stream_text
                        stream_success = True
                        self._active_gen_model = m_name
                        break
                except Exception as e:
                    code_int, label = get_gemini_error_info(e)
                    print(f"[GEMINI ERROR] Key #{key_idx+1} ({masked_key}) | Model: '{m_name}' | Status: {code_int} ({label}) | Chi tiết: {e}")
                    if code_int == 429 or is_quota_or_rate_limit_error(e):
                        print(f"[GEMINI ROTATE] Gặp lỗi 429 Quota/RateLimit trên Key #{key_idx+1}. Chờ 0.5s và tự động chuyển sang Key tiếp theo...")
                    elif code_int in [400, 403]:
                        print(f"[GEMINI ROTATE] Key #{key_idx+1} bị lỗi xác thực/quyền ({label}). Chuyển sang Key tiếp theo...")
                    else:
                        print(f"[GEMINI RETRY] Lỗi khi gọi stream ({label}). Thử key tiếp theo...")

                    time.sleep(0.5)
                    continue

            if stream_success:
                break
            else:
                next_model = gen_models[model_idx + 1] if model_idx + 1 < len(gen_models) else None
                if next_model:
                    print(f"[GEMINI FALLBACK] Tất cả {len(key_pool)} keys đều bị nghẽn quota hoặc lỗi với model '{m_name}'. Tự động fallback sang model '{next_model}'...")
                    time.sleep(0.5)

        if not stream_success:
            full_answer = FRIENDLY_OVERLOAD_MESSAGE
            for word in FRIENDLY_OVERLOAD_MESSAGE.split(" "):
                yield {"type": "token", "token": word + " "}
                time.sleep(0.01)

        latency = round(time.time() - start_time, 2)
        database.log_chat_interaction(question, full_answer, sources, latency, search_type=search_type, session_id=session_id)
        yield {"type": "done", "latency": latency, "full_text": full_answer}