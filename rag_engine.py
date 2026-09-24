import os
import time
from typing import List, Dict, Any, Tuple, Generator, Optional
import pypdf
import chromadb
from google import genai
from google.genai import types
import cohere
from dotenv import load_dotenv

# Database storage
import data as database

load_dotenv()


class RecursiveTextSplitter:
    """
    Intelligent Recursive Character Text Splitter with configurable chunk size & overlap.
    Preserves natural sentence boundaries and paragraphs.
    """
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
            # Hard split if no more separators
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
        remaining_seps = separators[1:]

        if sep == "":
            splits = list(text)
        else:
            splits = text.split(sep)

        good_splits = []
        current_chunk = []
        current_len = 0

        for s in splits:
            item = s if sep == "" else (s + sep)
            item_len = len(item)

            if item_len > self.chunk_size:
                # Sub-split larger parts
                if current_chunk:
                    merged = "".join(current_chunk).strip()
                    if merged:
                        good_splits.append(merged)
                    current_chunk = []
                    current_len = 0
                sub_chunks = self._split(item, remaining_seps)
                good_splits.extend(sub_chunks)
            elif current_len + item_len <= self.chunk_size:
                current_chunk.append(item)
                current_len += item_len
            else:
                merged = "".join(current_chunk).strip()
                if merged:
                    good_splits.append(merged)
                
                # Handle overlap
                overlap_items = []
                overlap_len = 0
                for prev in reversed(current_chunk):
                    if overlap_len + len(prev) <= self.chunk_overlap:
                        overlap_items.insert(0, prev)
                        overlap_len += len(prev)
                    else:
                        break
                
                current_chunk = overlap_items + [item]
                current_len = sum(len(x) for x in current_chunk)

        if current_chunk:
            merged = "".join(current_chunk).strip()
            if merged:
                good_splits.append(merged)

        return [c for c in good_splits if c.strip()]


class RAGEngine:
    """
    Production-Grade RAG Engine supporting:
    - Multi-format document ingestion (.pdf, .docx, .txt, .md)
    - Recursive Character Text Chunking
    - ChromaDB Vector Store with Cosine distance
    - Multi-Key Gemini Embedding & Generation fallback
    - Cohere Reranking & MMR diversity search
    - Hallucination guardrail prompt augmentation
    - Streaming & JSON query responses
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
        
        # Configure Gemini API keys (supports rotation)
        raw_keys = os.getenv("GEMINI_KEYS", "") or os.getenv("GEMINI_API_KEY", "")
        self.gemini_keys = [k.strip() for k in raw_keys.split(",") if k.strip()]
        self.current_key_idx = 0
        self._init_gemini_client()

        # Configure Cohere Reranker
        self.cohere_key = os.getenv("COHERE_API_KEY", "").strip()
        self.cohere_client = cohere.Client(api_key=self.cohere_key) if self.cohere_key else None

    def _init_gemini_client(self):
        if self.gemini_keys:
            key = self.gemini_keys[self.current_key_idx % len(self.gemini_keys)]
            self.gemini_client = genai.Client(api_key=key)
        else:
            self.gemini_client = None

    def _rotate_key_if_needed(self):
        if len(self.gemini_keys) > 1:
            self.current_key_idx = (self.current_key_idx + 1) % len(self.gemini_keys)
            self._init_gemini_client()

    def get_embedding(self, text: str) -> List[float]:
        """Tạo embedding vector cho đoạn văn bản sử dụng Google Gemini embedding."""
        if not self.gemini_client:
            raise ValueError("GEMINI_API_KEY / GEMINI_KEYS chưa được cấu hình trong .env")
        
        embed_models = ["gemini-embedding-001", "gemini-embedding-2"]
        last_err = None

        for attempt in range(len(self.gemini_keys) or 1):
            current_key = self.gemini_keys[self.current_key_idx % len(self.gemini_keys)] if self.gemini_keys else "N/A"
            for model_name in embed_models:
                try:
                    res = self.gemini_client.models.embed_content(
                        model=model_name,
                        contents=text
                    )
                    return res.embeddings[0].values
                except Exception as e:
                    last_err = e
                    print(f"[GEMINI EMBED ERROR] Key index {self.current_key_idx} ({current_key[:6]}...) | Model '{model_name}' failed: {type(e).__name__}: {e}")
                    continue
            
            self._rotate_key_if_needed()

        if last_err:
            raise last_err
        raise ValueError("Không thể tạo embedding.")

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
        Tự động kiểm tra trùng lặp: nếu tài liệu đã tồn tại trong SQLite/ChromaDB thì bỏ qua để tối ưu hiệu năng.
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
                            # Đảm bảo tài liệu đã có câu hỏi gợi ý FAQs
                            existing_faqs = database.get_suggested_questions_by_doc(existing_doc["doc_id"])
                            if not existing_faqs:
                                self.generate_faqs_for_pdf(file_path, existing_doc["doc_id"])
                            return {
                                "filename": original_filename,
                                "chunks_count": chunk_cnt,
                                "pages_count": existing_doc["total_pages"],
                                "status": "already_indexed",
                                "message": f"Tài liệu '{original_filename}' đã được đánh chỉ mục ({chunk_cnt} chunks), bỏ qua bước trích xuất & embedding."
                            }
            except Exception as e:
                print(f"[INGEST] Lưu ý khi kiểm tra trùng lặp: {e}")

        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        pages_data = self.extract_text_from_file(file_path, original_filename)
        
        if not pages_data:
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
        splitter = RecursiveTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        
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

        # 4. Tự động sinh câu hỏi thường gặp FAQs cho tài liệu
        generated_faqs = []
        try:
            generated_faqs = self.generate_faqs_for_pdf(file_path, doc_id)
        except Exception as ex:
            print(f"[FAQS] Lỗi tự động sinh câu hỏi FAQs: {ex}")

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

        gen_models = ["gemini-2.5-flash", "gemma-4-26b-a4b-it", "gemma-4-31b-it", "gemini-3.6-flash", "gemini-flash-latest"]
        faqs: List[str] = []

        for attempt in range(len(self.gemini_keys) or 1):
            current_key = self.gemini_keys[self.current_key_idx % len(self.gemini_keys)] if self.gemini_keys else "N/A"
            for m_name in gen_models:
                try:
                    res = self.gemini_client.models.generate_content(
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=0.3
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
                    print(f"[GEMINI FAQS ERROR] Key {current_key[:6]}... | Model '{m_name}': {type(e).__name__}: {e}")
                    continue
            if faqs:
                break
            self._rotate_key_if_needed()

        if faqs:
            database.clear_suggested_questions(doc_id)
            database.save_suggested_questions(doc_id, faqs)

        return faqs

    def ingest_pdf(self, file_path: str, original_filename: Optional[str] = None) -> Dict[str, Any]:
        """Wrapper nạp tài liệu PDF và tự động tạo FAQs."""
        return self.ingest_file(file_path, original_filename)

    def ingest_docs_folder(self, folder_path: str = "docs", chunk_size: int = 800, chunk_overlap: int = 150, force_reload: bool = False):
        """Quét và nạp toàn bộ tài liệu có trong thư mục (tự động bỏ qua file đã có trong DB)."""
        if not os.path.exists(folder_path):
            return []
        
        results = []
        for file in os.listdir(folder_path):
            ext = os.path.splitext(file)[1].lower()
            if ext in [".pdf", ".docx", ".doc", ".txt", ".md"]:
                full_path = os.path.join(folder_path, file)
                res = self.ingest_file(full_path, original_filename=file, chunk_size=chunk_size, chunk_overlap=chunk_overlap, force_reload=force_reload)
                results.append(res)
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

    def retrieve(self, query_text: str, top_k: int = 2, use_rerank: bool = True) -> Tuple[List[str], List[Dict[str, Any]]]:
        """
        Semantic Retrieval tối ưu:
        1. Embeds query -> query ChromaDB với n_results=4 (tinh gọn từ 6 xuống 4).
        2. Reranks candidates sử dụng Cohere Rerank lấy Top-2 (top_n=2) đoạn có độ liên quan cao nhất để giảm tải prompt LLM.
        3. Trả về danh sách docs và metadata tương ứng.
        """
        q_embed = self.get_embedding(query_text)
        
        # Lấy tinh gọn 4 chunks từ ChromaDB
        search_results = self.collection.query(
            query_embeddings=[q_embed],
            n_results=4
        )
        
        docs = search_results["documents"][0] if (search_results and search_results["documents"]) else []
        metas = search_results["metadatas"][0] if (search_results and search_results["metadatas"]) else []
        distances = search_results["distances"][0] if (search_results and "distances" in search_results and search_results["distances"]) else []

        if not docs:
            return [], []

        # Gán similarity/distance vào metadata
        for idx, m in enumerate(metas):
            if idx < len(distances):
                m["distance"] = round(float(distances[idx]), 4)
                m["similarity"] = round(max(0.0, 1.0 - float(distances[idx])), 4)
            m["content_snippet"] = docs[idx][:200] + ("..." if len(docs[idx]) > 200 else "")

        # Rerank với Cohere (lấy Top-2 có độ liên quan cao nhất)
        if use_rerank and self.cohere_client and len(docs) > 1:
            try:
                target_top_n = min(top_k, 2, len(docs))
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
                print(f"Cohere rerank fallback to cosine: {e}")

        # Mặc định lấy top_k (mặc định 2) từ vector search
        return docs[:top_k], metas[:top_k]

    def build_prompt(self, question: str, retrieved_docs: List[str]) -> str:
        """
        Constructs context-augmented prompt specifically for University Academic Regulations with strict guardrails.
        """
        context_blocks = []
        for i, doc in enumerate(retrieved_docs, 1):
            context_blocks.append(f"[ĐOẠN TRÍCH {i}]\n{doc}")
        
        context_str = "\n\n".join(context_blocks)

        prompt = f"""Bạn là Trợ lý Tra cứu Nội quy và Quy chế Đào tạo của Nhà trường.
Bạn CHỈ trả lời các câu hỏi liên quan đến quy chế học vụ, điểm số, học phí, rèn luyện, học bổng, thực tập, đồ án tốt nghiệp và nội quy chung dựa TUYỆT ĐỐI vào [NGỮ CẢNH TÀI LIỆU] được cung cấp dưới đây.

NGUYÊN TẮC VÀ RÀNG BUỘC NGHIÊM NGẶT:
1. Bạn CHỈ ĐƯỢC PHÉP trả lời dựa vào thông tin có trong phần [NGỮ CẢNH TÀI LIỆU] dưới đây.
2. Nếu câu hỏi KHÔNG liên quan đến quy chế nhà trường (như hỏi về tài chính doanh nghiệp, đầu tư, code bên ngoài, kiến thức tổng quát ngoài trường học...), hãy lịch sự từ chối và hướng dẫn người dùng: "Tôi là Trợ lý Tra cứu Nội quy và Quy chế Đào tạo của Nhà trường. Tôi chỉ hỗ trợ giải đáp các vấn đề liên quan đến quy chế học vụ, học phí, học bổng, thực tập, điểm số và nội quy sinh viên. Vui lòng đặt câu hỏi liên quan đến các chủ đề này."
3. Nếu câu hỏi liên quan đến quy chế nhưng thông tin KHÔNG có trong tài liệu được cung cấp, bạn PHẢI trả lời rõ ràng: "Dựa trên các tài liệu quy chế được cung cấp, không tìm thấy thông tin để trả lời câu hỏi này." TUYỆT ĐỐI KHÔNG tự suy đoán, bịa đặt hoặc dùng kiến thức bên ngoài tài liệu.
4. Trình bày câu trả lời rõ ràng, mạch lạc, sử dụng định dạng Markdown (gạch đầu dòng, bảng biểu, in đậm số liệu/mốc thời gian quan trọng) để người đọc dễ theo dõi.
5. Cuối câu trả lời, hãy tóm tắt ngắn gọn các nguồn tài liệu quy chế và số trang đã tham chiếu.

[NGỮ CẢNH TÀI LIỆU]:
{context_str}

[CÂU HỎI CỦA NGƯỜI DÙNG]:
{question}

CÂU TRẢ LỜI:"""
        return prompt

    def query(self, question: str, top_k: int = 2, use_rerank: bool = True, temperature: float = 0.2) -> Tuple[str, List[Dict[str, Any]], float]:
        """
        Truy vấn RAG dạng Batch JSON, trả về (câu trả lời, nguồn trích dẫn, latency).
        """
        start_time = time.time()
        docs, sources = self.retrieve(question, top_k=top_k, use_rerank=use_rerank)
        
        if not docs:
            latency = round(time.time() - start_time, 2)
            answer = "Dựa trên các tài liệu quy chế hiện có trong hệ thống, không tìm thấy thông tin phù hợp với câu hỏi của bạn. Vui lòng đặt câu hỏi liên quan đến quy chế học vụ hoặc tải lên tài liệu mới."
            database.log_chat_interaction(question, answer, sources, latency, search_type="none")
            return answer, [], latency

        prompt = self.build_prompt(question, docs)
        
        gen_models = ["gemini-2.5-flash", "gemma-4-26b-a4b-it", "gemma-4-31b-it", "gemini-3.6-flash", "gemini-flash-latest"]
        answer = ""

        for attempt in range(len(self.gemini_keys) or 1):
            current_key = self.gemini_keys[self.current_key_idx % len(self.gemini_keys)] if self.gemini_keys else "N/A"
            for m_name in gen_models:
                try:
                    response = self.gemini_client.models.generate_content(
                        model=m_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=temperature
                        )
                    )
                    answer = response.text
                    break
                except Exception as e:
                    print(f"[GEMINI QUERY ERROR] Key {current_key[:6]}... | Model '{m_name}': {type(e).__name__}: {e}")
                    answer = f"Lỗi trong quá trình sinh câu trả lời: {type(e).__name__} - {e}"
            if answer and not answer.startswith("Lỗi trong quá trình"):
                break
            self._rotate_key_if_needed()

        latency = round(time.time() - start_time, 2)
        
        # Log SQLite sau khi hoàn thành
        search_type = "cohere_rerank" if (use_rerank and self.cohere_client) else "cosine_similarity"
        database.log_chat_interaction(question, answer, sources, latency, search_type=search_type)

        return answer, sources, latency

    def query_stream(self, question: str, top_k: int = 2, use_rerank: bool = True, temperature: float = 0.2) -> Generator[Dict[str, Any], None, None]:
        """
        Streaming Generator for Fast Response (Server-Sent Events & Streamlit).
        1. Gửi metadata nguồn trích dẫn ngay lập tức.
        2. Dùng generate_content_stream() để sinh từng token (giảm latency cảm nhận < 1s).
        3. Ghi log SQLite sau khi đã hoàn tất toàn bộ stream ra cho người dùng để không gây nghẽn.
        """
        start_time = time.time()
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
            msg = "Dựa trên các tài liệu quy chế hiện có trong hệ thống, không tìm thấy thông tin phù hợp với câu hỏi của bạn. Vui lòng đặt câu hỏi liên quan đến quy chế học vụ hoặc tải lên tài liệu mới."
            for word in msg.split(" "):
                yield {"type": "token", "token": word + " "}
                time.sleep(0.01)
            latency = round(time.time() - start_time, 2)
            # Log sau khi stream xong
            database.log_chat_interaction(question, msg, sources, latency, search_type="none")
            yield {"type": "done", "latency": latency}
            return

        prompt = self.build_prompt(question, docs)
        full_answer = ""
        gen_models = ["gemini-2.5-flash", "gemma-4-26b-a4b-it", "gemma-4-31b-it", "gemini-3.6-flash", "gemini-flash-latest"]
        stream_success = False

        for attempt in range(len(self.gemini_keys) or 1):
            current_key = self.gemini_keys[self.current_key_idx % len(self.gemini_keys)] if self.gemini_keys else "N/A"
            for m_name in gen_models:
                try:
                    response_stream = self.gemini_client.models.generate_content_stream(
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
                    break
                except Exception as e:
                    print(f"[GEMINI STREAM ERROR] Key {current_key[:6]}... | Model '{m_name}': {type(e).__name__}: {e}")
                    continue
            if stream_success:
                break
            self._rotate_key_if_needed()

        if not stream_success:
            error_msg = "\n[Lỗi kết nối Gemini: Không thể sinh phản hồi từ API. Vui lòng kiểm tra lại GEMINI_KEYS trong .env]"
            full_answer += error_msg
            yield {"type": "token", "token": error_msg}

        latency = round(time.time() - start_time, 2)
        # Ghi log SQLite sau khi đã hoàn thành stream ra màn hình cho người dùng
        database.log_chat_interaction(question, full_answer, sources, latency, search_type=search_type)
        yield {"type": "done", "latency": latency, "full_text": full_answer}