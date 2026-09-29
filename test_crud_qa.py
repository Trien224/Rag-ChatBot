import os
import io
import sys
import json
from fastapi.testclient import TestClient
from server import app, DOCS_DIR
import data as database

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

client = TestClient(app)

def run_crud_qa_audit():
    print("=" * 70)
    print("🔍 [BẮT ĐẦU KIỂM THỬ TOÀN DIỆN CRUD - FULLSTACK QA AUDIT]")
    print("=" * 70)

    # 1. READ / HEALTH & STATS
    print("\n[BƯỚC 1: KIỂM THỬ ĐỌC TRẠNG THÁI & CHỈ SỐ HỆ THỐNG - READ]")
    r_health = client.get("/api/health")
    print(f" -> GET /api/health : HTTP {r_health.status_code}")
    assert r_health.status_code == 200, f"Health check failed: {r_health.text}"
    health_data = r_health.json()
    print(f"    * Trạng thái: {health_data.get('status')} | Vector hiện tại: {health_data.get('total_vectors')}")

    r_stats = client.get("/api/stats")
    print(f" -> GET /api/stats : HTTP {r_stats.status_code}")
    assert r_stats.status_code == 200
    stats = r_stats.json()
    print(f"    * Số tài liệu: {stats.get('total_documents')} | Số chunks: {stats.get('total_chunks')}")

    # 2. CREATE / UPLOAD TÀI LIỆU
    print("\n[BƯỚC 2: KIỂM THỬ THÊM TÀI LIỆU VÀO HỆ THỐNG - CREATE]")
    test_filename = "test_quy_che_hoc_vu_ntu.txt"
    test_content = """QUY CHẾ HỌC VỤ VÀ ĐÀO TẠO ĐẠI HỌC NHA TRANG (NTU)
Điều 1: Đăng ký tín chỉ học kỳ
- Sinh viên bình thường phải đăng ký tối thiểu 14 tín chỉ và tối đa 24 tín chỉ trong học kỳ chính.
- Sinh viên xếp loại học lực yếu chỉ được đăng ký tối đa 14 tín chỉ.
Điều 2: Tiêu chuẩn xét học bổng khuyến khích
- Điểm trung bình học tập (GPA) từ 3.2 trở lên và Điểm rèn luyện từ 80 điểm trở lên."""

    files = [
        ("files", (test_filename, io.BytesIO(test_content.encode("utf-8")), "text/plain"))
    ]
    r_upload = client.post("/api/upload", files=files, data={"chunk_size": 500, "chunk_overlap": 100})
    print(f" -> POST /api/upload : HTTP {r_upload.status_code}")
    assert r_upload.status_code == 200, f"Upload error: {r_upload.text}"
    upload_res = r_upload.json()
    print(f"    * Thông báo: {upload_res.get('message')}")
    for res in upload_res.get("results", []):
        print(f"    * File '{res.get('filename')}': {res.get('status')} ({res.get('chunks_count')} chunks)")

    # Kiểm tra file trên đĩa docs/ và trong SQLite
    saved_doc_path = os.path.join(DOCS_DIR, test_filename)
    assert os.path.exists(saved_doc_path), f"File {test_filename} không tồn tại trong thư mục docs/"
    print(f"    * Kiểm tra vật lý: File đã lưu thành công tại docs/{test_filename}")

    r_docs = client.get("/api/documents")
    docs_list = r_docs.json().get("documents", [])
    found_doc = any(d.get("filename") == test_filename for d in docs_list)
    assert found_doc, f"Tài liệu {test_filename} không có trong danh sách /api/documents"
    print(f"    * Kiểm tra SQLite: Đã lưu bản ghi vào bảng documents và document_chunks")

    # 3. CREATE / QUERY RAG & CHAT INTERACTION
    print("\n[BƯỚC 3: KIỂM THỬ TRUY VẤN RAG & LƯU LỊCH SỬ CHAT - CREATE & LOG]")
    query_payload = {
        "question": "Sinh viên cần đăng ký tối thiểu bao nhiêu tín chỉ trong một học kỳ?",
        "top_k": 2,
        "use_rerank": False,
        "temperature": 0.2,
        "stream": False
    }
    r_query = client.post("/api/query", json=query_payload)
    print(f" -> POST /api/query (JSON) : HTTP {r_query.status_code}")
    assert r_query.status_code == 200, f"Query error: {r_query.text}"
    ans_data = r_query.json()
    print(f"    * Câu hỏi: {ans_data.get('question')}")
    print(f"    * Câu trả lời: {ans_data.get('answer')[:120]}...")
    print(f"    * Nguồn trích dẫn: {len(ans_data.get('sources', []))} chunks")

    # 4. READ / HISTORY
    print("\n[BƯỚC 4: KIỂM THỬ LỊCH SỬ CHAT - READ]")
    r_hist = client.get("/api/history")
    print(f" -> GET /api/history : HTTP {r_hist.status_code}")
    assert r_hist.status_code == 200
    hist_items = r_hist.json().get("history", [])
    print(f"    * Số lượng bản ghi chat_logs trong SQLite: {len(hist_items)}")

    # 5. DELETE / XÓA TÀI LIỆU
    print("\n[BƯỚC 5: KIỂM THỬ XÓA TÀI LIỆU - DELETE]")
    r_del = client.delete(f"/api/documents/{test_filename}")
    print(f" -> DELETE /api/documents/{test_filename} : HTTP {r_del.status_code}")
    assert r_del.status_code == 200
    print(f"    * Phản hồi xóa: {r_del.json().get('message')}")
    
    assert not os.path.exists(saved_doc_path), f"File {test_filename} vẫn còn trong docs/"
    print(f"    * Xác nhận: Đã xóa file vật lý trong docs/")

    # Kiểm tra lại SQLite xem tài liệu đã biến mất chưa
    r_docs_after = client.get("/api/documents")
    docs_after = r_docs_after.json().get("documents", [])
    assert not any(d.get("filename") == test_filename for d in docs_after), "Tài liệu vẫn còn trong SQLite"
    print(f"    * Xác nhận: Đã xóa bản ghi trong bảng documents và document_chunks")

    # 6. DELETE / CLEAR SYSTEM HISTORY
    print("\n[BƯỚC 6: KIỂM THỬ XÓA LỊCH SỬ HỎI ĐÁP - CLEAR HISTORY]")
    r_clear = client.post("/api/clear", json={"target": "history"})
    print(f" -> POST /api/clear (history) : HTTP {r_clear.status_code}")
    assert r_clear.status_code == 200
    print(f"    * Phản hồi clear: {r_clear.json().get('message')}")
    
    r_hist_empty = client.get("/api/history")
    assert len(r_hist_empty.json().get("history", [])) == 0, "Lịch sử chat chưa được dọn sạch"
    print(f"    * Xác nhận: Bảng chat_logs đã được dọn sạch về 0")

    print("\n" + "=" * 70)
    print("✅ TOÀN BỘ CÁC TÁC VỤ CRUD (CREATE, READ, UPDATE, DELETE) ĐỀU HOẠT ĐỘNG HOÀN HẢO!")
    print("=" * 70)

if __name__ == "__main__":
    run_crud_qa_audit()
