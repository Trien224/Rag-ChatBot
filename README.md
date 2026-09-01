# 🎓 Trợ Lý Tra Cứu Quy Chế Học Vụ AI (RAG-based Chatbot)

Ứng dụng Chatbot AI thông minh ứng dụng kỹ thuật **RAG (Retrieval-Augmented Generation)** nhằm hỗ trợ sinh viên và cán bộ tra cứu nhanh chóng, chính xác các văn bản quy chế đào tạo, sổ tay sinh viên, quy định học bổng và quy trình thực tập tốt nghiệp.

---

## 📌 Điểm Nổi Bật Của Hệ Thống

- **Truy xuất ngữ nghĩa chuẩn xác:** Tìm kiếm văn bản dựa trên ý nghĩa câu hỏi thay vì so khớp từ khóa đơn thuần.
- **Tái xếp hạng nâng cao (Reranking):** Ứng dụng Cohere Rerank để sắp xếp và chọn lọc các đoạn văn bản liên quan nhất trước khi đưa vào mô hình ngôn ngữ lớn.
- **Trích dẫn nguồn rõ ràng:** Mỗi câu trả lời của AI đều đi kèm tên tài liệu và số trang cụ thể, đảm bảo tính minh bạch và kiểm chứng thông tin.
- **Hạn chế ảo giác (Anti-Hallucination):** Prompt được thiết kế nghiêm ngặt; nếu tài liệu không đề cập, AI sẽ thông báo rõ thay vì tự bịa câu trả lời.
- **Giao diện Web trực quan:** Xây dựng trên nền tảng Streamlit, hỗ trợ xem kho tài liệu có sẵn và tải lên (upload) file PDF mới để nạp động vào Vector Database.

---

## 🏗️ Kiến Trúc Hệ Thống (System Architecture)