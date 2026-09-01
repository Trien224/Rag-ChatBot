import os
from pathlib import Path
from pypdf import PdfReader
import chromadb
import cohere
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

class RAGEngine:
    def __init__(self, db_path="./chroma_db"):
        # 1. Cấu hình Gemini Keys (Xoay vòng)
        keys_str = os.getenv("GEMINI_KEYS") or os.getenv("GEMINI_API_KEY")
        if not keys_str:
            raise ValueError("Thiếu GEMINI_KEYS trong file .env")
        
        self.gemini_keys = [k.strip() for k in keys_str.split(",") if k.strip()]
        self.current_gemini_idx = 0
        self._init_gemini_client()

        # 2. Cấu hình Cohere Client (Dùng cho Rerank)
        cohere_key = os.getenv("COHERE_API_KEY")
        self.cohere_client = cohere.ClientV2(api_key=cohere_key) if cohere_key else None

        # 3. Khởi tạo ChromaDB lưu trữ cục bộ
        self.chroma_client = chromadb.PersistentClient(path=db_path)
        self.collection = self.chroma_client.get_or_create_collection(
            name="rag_knowledge_base",
            metadata={"hnsw:space": "cosine"}
        )

    def _init_gemini_client(self):
        """Khởi tạo client Gemini với key hiện tại"""
        key = self.gemini_keys[self.current_gemini_idx]
        self.gemini_client = genai.Client(api_key=key)

    def _rotate_gemini_key(self):
        """Chuyển sang API key Gemini tiếp theo khi chạm giới hạn lượt gọi"""
        if len(self.gemini_keys) > 1:
            self.current_gemini_idx = (self.current_gemini_idx + 1) % len(self.gemini_keys)
            self._init_gemini_client()

    def extract_text_from_pdf(self, pdf_file_path_or_bytes, filename: str) -> list[dict]:
        """Đọc PDF và chia nhỏ thành các đoạn tối ưu"""
        reader = PdfReader(pdf_file_path_or_bytes)
        chunks = []
        
        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            text = text.replace("\xa0", " ").strip()
            if not text:
                continue
            
            # Cắt đoạn ~800 ký tự, gối đầu 150 ký tự
            step = 800
            overlap = 150
            for i in range(0, len(text), step - overlap):
                chunk = text[i:i + step].strip()
                if len(chunk) > 50:
                    chunks.append({
                        "text": chunk,
                        "source": filename,
                        "page": page_num
                    })
        return chunks

    def get_embeddings(self, texts: list[str], batch_size: int = 50) -> list[list[float]]:
        """Tạo vector embedding bằng Gemini (tự động đổi key nếu lỗi)"""
        if not texts:
            return []
            
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_success = False
            
            for _ in range(len(self.gemini_keys)):
                try:
                    res = self.gemini_client.models.embed_content(
                        model="gemini-embedding-001",
                        contents=batch,
                    )
                    all_embeddings.extend([e.values for e in res.embeddings])
                    batch_success = True
                    break
                except Exception:
                    self._rotate_gemini_key()
            
            if not batch_success:
                # Nếu tất cả key đều lỗi, gọi lại để ném exception chi tiết
                res = self.gemini_client.models.embed_content(
                    model="gemini-embedding-001",
                    contents=batch,
                )
                all_embeddings.extend([e.values for e in res.embeddings])
                
        return all_embeddings

    def add_documents_to_db(self, chunks: list[dict]):
        """Nạp các đoạn văn bản vào ChromaDB (tránh trùng lặp)"""
        if not chunks:
            return
            
        docs = [c["text"] for c in chunks]
        metadatas = [{"source": c["source"], "page": c["page"]} for c in chunks]
        ids = [f"{c['source']}_p{c['page']}_{idx}" for idx, c in enumerate(chunks)]
        
        existing = self.collection.get(ids=ids)
        existing_ids = set(existing.get("ids", []))
        
        new_docs, new_metadatas, new_ids = [], [], []
        for d, m, i in zip(docs, metadatas, ids):
            if i not in existing_ids:
                new_docs.append(d)
                new_metadatas.append(m)
                new_ids.append(i)
                
        if not new_ids:
            return

        embeddings = self.get_embeddings(new_docs)
        self.collection.upsert(
            documents=new_docs,
            embeddings=embeddings,
            metadatas=new_metadatas,
            ids=new_ids
        )

    def ingest_docs_folder(self, folder_path="docs"):
        """Tự động quét và nạp file trong thư mục docs/"""
        docs_dir = Path(folder_path)
        if not docs_dir.exists():
            docs_dir.mkdir(parents=True, exist_ok=True)
            return
            
        pdf_files = list(docs_dir.glob("*.pdf"))
        for pdf_path in pdf_files:
            chunks = self.extract_text_from_pdf(str(pdf_path), pdf_path.name)
            self.add_documents_to_db(chunks)

    def _rerank_with_cohere(self, query: str, docs: list[str], metadatas: list[dict], top_n: int = 4):
        """Dùng Cohere Rerank model để xếp hạng lại độ liên quan của tài liệu"""
        if not self.cohere_client or not docs:
            return docs[:top_n], metadatas[:top_n]
        
        try:
            response = self.cohere_client.rerank(
                model="rerank-v3.5",
                query=query,
                documents=docs,
                top_n=top_n
            )
            
            reranked_docs = []
            reranked_metas = []
            for item in response.results:
                idx = item.index
                reranked_docs.append(docs[idx])
                reranked_metas.append(metadatas[idx])
                
            return reranked_docs, reranked_metas
        except Exception:
            # Nếu Cohere gặp lỗi hoặc hết hạn mức, fallback về thứ tự mặc định của ChromaDB
            return docs[:top_n], metadatas[:top_n]

    def query(self, user_question: str, fetch_k: int = 8, top_k: int = 4) -> tuple[str, list[dict]]:
        """Truy xuất context -> Rerank qua Cohere -> Trả lời qua Gemini"""
        q_embedding = self.get_embeddings([user_question])[0]
        
        # 1. Lấy ra fetch_k đoạn tiềm năng từ ChromaDB
        results = self.collection.query(
            query_embeddings=[q_embedding],
            n_results=fetch_k
        )
        
        raw_docs = results.get("documents", [[]])[0]
        raw_metas = results.get("metadatas", [[]])[0]
        
        if not raw_docs:
            return "Không tìm thấy dữ liệu liên quan trong kho tài liệu.", []

        # 2. Xếp hạng lại bằng Cohere Rerank
        final_docs, final_metas = self._rerank_with_cohere(
            query=user_question,
            docs=raw_docs,
            metadatas=raw_metas,
            top_n=top_k
        )

        # 3. Tạo context
        context_parts = []
        for doc, meta in zip(final_docs, final_metas):
            src = meta.get("source", "Tài liệu")
            page = meta.get("page", "?")
            context_parts.append(f"[Tệp: {src} - Trang {page}]\n{doc}")
            
        context_str = "\n\n---\n\n".join(context_parts)

        system_instruction = """
        Bạn là một trợ lý AI thông minh hỗ trợ giải đáp văn bản, tài liệu và quy chế.
        Quy tắc nghiêm ngặt:
        1. CHỈ sử dụng thông tin trong phần 'Ngữ cảnh được cung cấp' để trả lời.
        2. Nếu thông tin không có trong ngữ cảnh, hãy trả lời trung thực: 'Tài liệu hiện tại không đề cập đến thông tin này'. Không được tự ý suy đoán hoặc bịa đặt.
        3. Trả lời rõ ràng, mạch lạc, có cấu trúc bullet point dễ đọc và ghi chú điều khoản/trang tham chiếu.
        """

        prompt = f"""Ngữ cảnh được cung cấp:
{context_str}

Câu hỏi của người dùng:
{user_question}
"""
        # 4. Sinh câu trả lời từ Gemini
        for _ in range(len(self.gemini_keys)):
            try:
                response = self.gemini_client.models.generate_content(
                    model="gemini-3.6-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=0.2,
                    )
                )
                return response.text, final_metas
            except Exception:
                self._rotate_gemini_key()

        return "Đã xảy ra lỗi khi kết nối với Gemini API. Vui lòng kiểm tra lại cấu hình key.", []