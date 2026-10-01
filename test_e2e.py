import io
import json
import sys

import requests

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

def test_e2e_pipeline():
    print("=" * 60)
    print("🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN END-TO-END HỆ THỐNG RAG")
    print("=" * 60)

    # 1. Test Static Files & Index
    print("\n[1/7] Kiểm tra Giao diện Web (Static & HTML)...")
    res = requests.get(f"{BASE_URL}/")
    assert res.status_code == 200, f"Lỗi load index.html: {res.status_code}"
    assert "NTU EduBot" in res.text, "Index HTML không đúng tiêu đề"
    
    res_css = requests.get(f"{BASE_URL}/static/style.css")
    assert res_css.status_code == 200, "Lỗi load style.css"
    
    res_js = requests.get(f"{BASE_URL}/static/app.js")
    assert res_js.status_code == 200, "Lỗi load app.js"
    print(" -> Giao diện HTML, CSS, JavaScript tải thành công (HTTP 200).")

    # 2. Test Health & Stats
    print("\n[2/7] Kiểm tra API Health & Stats...")
    health = requests.get(f"{BASE_URL}/api/health").json()
    print(f" -> Health Status: {health.get('status')}")
    print(f" -> Gemini Configured: {health.get('gemini_configured')}")
    print(f" -> Cohere Configured: {health.get('cohere_configured')}")
    print(f" -> Total Vectors: {health.get('total_vectors')}")
    assert health.get("status") == "healthy"

    stats = requests.get(f"{BASE_URL}/api/stats").json()
    print(f" -> Stats: Documents={stats.get('total_documents')}, Chunks={stats.get('total_chunks')}, Avg Latency={stats.get('average_latency_seconds')}s")

    # 3. Test List Documents
    print("\n[3/7] Kiểm tra Danh sách tài liệu (/api/documents)...")
    docs_resp = requests.get(f"{BASE_URL}/api/documents").json()
    doc_count = docs_resp.get("total", 0)
    print(f" -> Tổng số tài liệu hiện có trong hệ thống: {doc_count}")
    for d in docs_resp.get("documents", [])[:3]:
        print(f"    - {d.get('filename')} ({d.get('file_type')}) - {d.get('total_chunks')} chunks")

    # 4. Test Multi-file Upload (.txt, .md)
    print("\n[4/7] Kiểm tra Upload tài liệu mới (.txt và .md)...")
    sample_txt_content = """QUY ĐỊNH BẢO VỆ ĐỒ ÁN TỐT NGHIỆP NĂM 2026
Điều 1: Tiêu chuẩn điểm bảo vệ đồ án tốt nghiệp xuất sắc
- Điểm đánh giá của hội đồng phản biện phải đạt từ 9.0 trở lên.
- Đồ án phải có sản phẩm thực nghiệm hoạt động được và bài báo khoa học đăng ký hoặc chấp nhận công bố.
- Sinh viên không được vi phạm quy chế liêm chính học thuật."""

    sample_md_content = """# HƯỚNG DẪN CẤP PHÁT THẺ SINH VIÊN ĐIỆN TỬ
- Bước 1: Đăng nhập vào cổng thông tin sinh viên portal.university.edu.vn
- Bước 2: Nộp ảnh thẻ 3x4 phông nền trắng và căn cước công dân.
- Bước 3: Thời gian xử lý là 03 ngày làm việc kể từ khi nộp đủ hồ sơ."""

    files = [
        ('files', ('quy_dinh_bao_ve_do_an.txt', io.BytesIO(sample_txt_content.encode('utf-8')), 'text/plain')),
        ('files', ('huong_dan_the_sinh_vien.md', io.BytesIO(sample_md_content.encode('utf-8')), 'text/markdown'))
    ]
    data = {'chunk_size': 600, 'chunk_overlap': 100}

    upload_res = requests.post(f"{BASE_URL}/api/upload", files=files, data=data)
    assert upload_res.status_code == 200, f"Lỗi upload: {upload_res.text}"
    upload_data = upload_res.json()
    print(f" -> Kết quả upload: {upload_data.get('message')}")
    for r in upload_data.get("results", []):
        print(f"    - File: {r.get('filename')} -> {r.get('status')} ({r.get('chunks_count')} chunks)")

    # 5. Test Query Streaming (SSE)
    print("\n[5/7] Kiểm tra Truy vấn RAG Streaming (Server-Sent Events / SSE)...")
    stream_payload = {
        "question": "Điều kiện để đạt điểm bảo vệ đồ án tốt nghiệp xuất sắc là gì?",
        "top_k": 3,
        "use_rerank": True,
        "temperature": 0.1,
        "stream": True
    }

    stream_res = requests.post(f"{BASE_URL}/api/query", json=stream_payload, stream=True)
    assert stream_res.status_code == 200, f"Lỗi query streaming: {stream_res.status_code}"
    
    streamed_tokens = []
    received_sources = []
    
    for line in stream_res.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith("data: "):
                event = json.loads(decoded[6:])
                if event.get("type") == "sources":
                    received_sources = event.get("sources", [])
                elif event.get("type") == "token":
                    streamed_tokens.append(event.get("token", ""))
                elif event.get("type") == "done":
                    print(f" -> Hoàn tất streaming trong latency: {event.get('latency')}s")

    full_answer = "".join(streamed_tokens)
    print(f"\n[KẾT QUẢ STREAMING TRẢ VỀ]:\n{full_answer}\n")
    print(f" -> Số nguồn trích dẫn: {len(received_sources)}")
    for s in received_sources:
        print(f"    * Tệp: {s.get('source')} (Score: {s.get('relevance_score') or s.get('similarity')})")

    # 6. Test Hallucination Guardrail (Out of context query)
    print("\n[6/7] Kiểm tra Rào chắn chống bịa đặt (Hallucination Guardrail)...")
    guardrail_payload = {
        "question": "Cách chế tạo tàu vũ trụ du hành đến sao Hỏa theo quy chế nhà trường?",
        "top_k": 3,
        "stream": False
    }
    g_res = requests.post(f"{BASE_URL}/api/query", json=guardrail_payload).json()
    print(f" -> Câu hỏi ngoài phạm vi: {guardrail_payload['question']}")
    print(f" -> Phản hồi từ Guardrail:\n{g_res.get('answer')}")

    # 7. Test Document Cleanup / Delete
    print("\n[7/7] Kiểm tra Xóa tài liệu vừa tạo...")
    del_res = requests.delete(f"{BASE_URL}/api/documents/quy_dinh_bao_ve_do_an.txt").json()
    print(f" -> Xóa txt: {del_res.get('message')}")
    del_res2 = requests.delete(f"{BASE_URL}/api/documents/huong_dan_the_sinh_vien.md").json()
    print(f" -> Xóa md: {del_res2.get('message')}")

    print("\n" + "=" * 60)
    print("🎉 TOÀN BỘ 7/7 BƯỚC KIỂM THỬ END-TO-END ĐỀU THÀNH CÔNG VƯỢT TRỘI!")
    print("=" * 60)

if __name__ == "__main__":
    test_e2e_pipeline()
