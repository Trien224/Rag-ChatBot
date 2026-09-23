import sys
import time
from rag_engine import RAGEngine

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

def main():
    print("=" * 60)
    print("BẮT ĐẦU KIỂM THỬ TRỰC TIẾP BACKEND RAG ENGINE")
    print("=" * 60)

    # 1. Khởi tạo Engine
    print("\n[1/3] Đang khởi tạo RAGEngine...")
    engine = RAGEngine()
    print(" -> Khởi tạo thành công!")

    # 2. Ingest 5 tài liệu trong thư mục docs/
    print("\n[2/3] Quét và vector hóa toàn bộ 5 file PDF trong thư mục docs/...")
    t0_ingest = time.time()
    engine.ingest_docs_folder("docs")
    t1_ingest = time.time()
    
    total_docs = engine.collection.count()
    print(f" -> Hoàn tất nạp tài liệu vào ChromaDB trong {t1_ingest - t0_ingest:.2f} giây.")
    print(f" -> Tổng số vector/chunks hiện có trong ChromaDB: {total_docs}")

    # 3. Chạy câu hỏi thử nghiệm
    test_question = "Sinh viên đi thực tập doanh nghiệp cần tích lũy tối thiểu bao nhiêu tín chỉ và thời gian bao lâu?"
    print(f"\n[3/3] Thực hiện truy vấn thử nghiệm:")
    print(f" -> Câu hỏi: \"{test_question}\"")
    
    t0_query = time.time()
    result = engine.query(test_question)
    if isinstance(result, tuple) and len(result) >= 3:
        answer, sources, latency = result[0], result[1], result[2]
    elif isinstance(result, tuple) and len(result) == 2:
        answer, sources = result[0], result[1]
        latency = time.time() - t0_query
    else:
        answer, sources, latency = str(result), [], time.time() - t0_query

    print("\n" + "=" * 60)
    print("KẾT QUẢ PHẢN HỒI TỪ GEMINI:")
    print("=" * 60)
    print(answer)
    print("\n" + "-" * 60)
    print(f"THỜI GIAN PHẢN HỒI (LATENCY): {latency:.2f} giây")
    print("-" * 60)
    print("DANH SÁCH NGUỒN TRÍCH DẪN:")
    if sources:
        for idx, src in enumerate(sources, 1):
            file_name = src.get("source", "N/A")
            page = src.get("page", "N/A")
            print(f"  {idx}. Tệp: {file_name} (Trang {page})")
    else:
        print("  Không có nguồn trích dẫn nào.")
    print("=" * 60)

if __name__ == "__main__":
    main()
