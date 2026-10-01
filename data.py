import json
import sqlite3
from typing import Any, Dict, List

DB_FILE = "system_data.db"

def get_connection():
    """Tạo kết nối tới SQLite database."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Khởi tạo cấu trúc các bảng quản lý tài liệu, chunks và lịch sử chat."""
    with get_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Bảng quản lý người dùng
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 2. Bảng quản lý tài liệu (Documents)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                doc_id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL UNIQUE,
                file_path TEXT NOT NULL,
                file_size INTEGER DEFAULT 0,
                file_type TEXT DEFAULT 'pdf',
                total_pages INTEGER DEFAULT 1,
                status TEXT DEFAULT 'indexed',
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 3. Bảng quản lý các đoạn trích xuất (Document Chunks)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS document_chunks (
                chunk_id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                page_number INTEGER NOT NULL DEFAULT 1,
                content TEXT NOT NULL,
                chroma_vector_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (doc_id) REFERENCES documents (doc_id) ON DELETE CASCADE
            )
        ''')
        
        # 4. Bảng lưu lịch sử hỏi đáp và đánh giá (Chat Logs)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER DEFAULT 1,
                session_id TEXT DEFAULT 'default',
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                sources_cited TEXT,
                latency_seconds REAL DEFAULT 0.0,
                search_type TEXT DEFAULT 'semantic',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id)
            )
        ''')

        # Tự động kiểm tra và nâng cấp schema nếu bảng cũ chưa có cột session_id
        cursor.execute("PRAGMA table_info(chat_logs)")
        columns = [col[1] for col in cursor.fetchall()]
        if "session_id" not in columns:
            cursor.execute("ALTER TABLE chat_logs ADD COLUMN session_id TEXT DEFAULT 'default'")

        # 5. Bảng lưu câu hỏi gợi ý tự động (Suggested Questions / Pre-generated FAQs)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS suggested_questions (
                question_id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                pre_computed_answer TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (doc_id) REFERENCES documents (doc_id) ON DELETE CASCADE
            )
        ''')
        
        # Thêm user mặc định nếu bảng trống
        cursor.execute("INSERT OR IGNORE INTO users (user_id, username, role) VALUES (1, 'default_user', 'user')")
        conn.commit()

def save_document_record(filename: str, file_path: str, file_size: int = 0, total_pages: int = 1, file_type: str = "pdf") -> int:
    """Lưu hoặc cập nhật thông tin tài liệu vào bảng documents."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO documents (filename, file_path, file_size, total_pages, file_type, status)
            VALUES (?, ?, ?, ?, ?, 'indexed')
            ON CONFLICT(filename) DO UPDATE SET
                file_path = excluded.file_path,
                file_size = excluded.file_size,
                total_pages = excluded.total_pages,
                file_type = excluded.file_type,
                uploaded_at = CURRENT_TIMESTAMP
        ''', (filename, file_path, file_size, total_pages, file_type))
        conn.commit()
        
        # Get actual doc_id
        cursor.execute('SELECT doc_id FROM documents WHERE filename = ?', (filename,))
        row = cursor.fetchone()
        return row["doc_id"] if row else cursor.lastrowid

def delete_document_record(filename: str) -> bool:
    """Xóa tài liệu và các chunk liên quan khỏi SQLite."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT doc_id FROM documents WHERE filename = ?', (filename,))
        row = cursor.fetchone()
        if not row:
            return False
        doc_id = row["doc_id"]
        cursor.execute('DELETE FROM document_chunks WHERE doc_id = ?', (doc_id,))
        cursor.execute('DELETE FROM documents WHERE doc_id = ?', (doc_id,))
        conn.commit()
        return True

def delete_all_document_records() -> bool:
    """Xóa toàn bộ tài liệu và chunks trong SQLite."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM document_chunks')
        cursor.execute('DELETE FROM documents')
        conn.commit()
        return True

def clear_chunks_for_document(doc_id: int):
    """Xóa các chunk cũ của một tài liệu trước khi nạp lại."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM document_chunks WHERE doc_id = ?', (doc_id,))
        conn.commit()

def save_chunk_record(doc_id: int, chunk_index: int, page_number: int, content: str, chroma_vector_id: str):
    """Lưu thông tin đoạn chunk đã vector hóa vào bảng document_chunks."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO document_chunks (doc_id, chunk_index, page_number, content, chroma_vector_id)
            VALUES (?, ?, ?, ?, ?)
        ''', (doc_id, chunk_index, page_number, content, chroma_vector_id))
        conn.commit()

def log_chat_interaction(
    question: str, 
    answer: str, 
    sources: List[Dict[str, Any]], 
    latency: float = 0.0, 
    search_type: str = "semantic", 
    user_id: int = 1,
    session_id: str = "default"
):
    """Lưu lịch sử câu hỏi, câu trả lời, nguồn trích dẫn, thời gian phản hồi và session_id vào chat_logs."""
    sources_json = json.dumps(sources, ensure_ascii=False)
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO chat_logs (user_id, session_id, question, answer, sources_cited, latency_seconds, search_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (user_id, session_id, question, answer, sources_json, latency, search_type))
        conn.commit()

def get_recent_chat_history(session_id: str = "default", limit: int = 30) -> List[Dict[str, Any]]:
    """Lấy danh sách các câu hỏi đáp gần nhất theo session_id."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT log_id, session_id, user_id, question, answer, sources_cited, latency_seconds, search_type, created_at
            FROM chat_logs
            WHERE session_id = ?
            ORDER BY log_id DESC
            LIMIT ?
        ''', (session_id, limit))
        rows = cursor.fetchall()
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["sources_cited"] = json.loads(d["sources_cited"]) if d["sources_cited"] else []
            except Exception:
                d["sources_cited"] = []
            results.append(d)
        return results

def clear_chat_logs() -> bool:
    """Xóa toàn bộ lịch sử hỏi đáp."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('DELETE FROM chat_logs')
        conn.commit()
        return True

def get_all_documents() -> List[Dict[str, Any]]:
    """Lấy danh sách tất cả tài liệu đã được nạp vào hệ thống."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT d.doc_id, d.filename, d.file_path, d.file_size, d.file_type, d.total_pages, d.uploaded_at,
                   COUNT(c.chunk_id) as total_chunks
            FROM documents d
            LEFT JOIN document_chunks c ON d.doc_id = c.doc_id
            GROUP BY d.doc_id
            ORDER BY d.doc_id DESC
        ''')
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

def get_system_stats() -> Dict[str, Any]:
    """Tổng hợp số liệu thống kê hệ thống RAG."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT COUNT(*) as count FROM documents')
        total_docs = cursor.fetchone()["count"]
        
        cursor.execute('SELECT COUNT(*) as count FROM document_chunks')
        total_chunks = cursor.fetchone()["count"]
        
        cursor.execute('SELECT COUNT(*) as count, AVG(latency_seconds) as avg_latency FROM chat_logs')
        log_stat = cursor.fetchone()
        total_queries = log_stat["count"]
        avg_latency = round(log_stat["avg_latency"] or 0.0, 2)
        
        return {
            "total_documents": total_docs,
            "total_chunks": total_chunks,
            "total_queries": total_queries,
            "average_latency_seconds": avg_latency
        }

def save_suggested_questions(doc_id: int, questions_list: List[Any]):
    """Lưu danh sách câu hỏi gợi ý tự động sinh từ tài liệu vào SQLite."""
    with get_connection() as conn:
        cursor = conn.cursor()
        for q in questions_list:
            if isinstance(q, dict):
                q_text = str(q.get("question", "") or q.get("question_text", "")).strip()
                q_ans = q.get("answer") or q.get("pre_computed_answer")
            else:
                q_text = str(q).strip()
                q_ans = None
            if q_text:
                cursor.execute('''
                    INSERT INTO suggested_questions (doc_id, question_text, pre_computed_answer)
                    VALUES (?, ?, ?)
                ''', (doc_id, q_text, q_ans))
        conn.commit()

def get_suggested_questions(limit: int = 6) -> List[Dict[str, Any]]:
    """Lấy danh sách câu hỏi gợi ý từ các tài liệu đã nạp."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT sq.question_id, sq.doc_id, sq.question_text, sq.pre_computed_answer, sq.created_at, d.filename
            FROM suggested_questions sq
            LEFT JOIN documents d ON sq.doc_id = d.doc_id
            ORDER BY sq.question_id DESC
            LIMIT ?
        ''', (limit,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def get_suggested_questions_by_doc(doc_id: int) -> List[Dict[str, Any]]:
    """Lấy câu hỏi gợi ý theo doc_id cụ thể."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute('''
            SELECT question_id, doc_id, question_text, pre_computed_answer, created_at
            FROM suggested_questions
            WHERE doc_id = ?
            ORDER BY question_id ASC
        ''', (doc_id,))
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def clear_suggested_questions(doc_id: int = None):
    """Xóa câu hỏi gợi ý của một tài liệu hoặc toàn bộ."""
    with get_connection() as conn:
        cursor = conn.cursor()
        if doc_id:
            cursor.execute('DELETE FROM suggested_questions WHERE doc_id = ?', (doc_id,))
        else:
            cursor.execute('DELETE FROM suggested_questions')
        conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database SQLite đã sẵn sàng.")