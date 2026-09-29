import os
from pathlib import Path
# pyrefly: ignore [missing-import]
import streamlit as st
from rag_engine import RAGEngine
import database

# Cấu hình trang giao diện
st.set_page_config(
    page_title="Trợ lý Tra Cứu Nội Quy & Quy Chế Học Vụ (Gemini 2.5 Flash + Cohere)", 
    page_icon="🎓", 
    layout="wide"
)

@st.cache_resource
def get_rag_engine():
    """Khởi tạo RAG Engine và nạp file mẫu từ thư mục docs (tự động bỏ qua file đã đánh chỉ mục)."""
    engine = RAGEngine()
    docs_dir = Path("docs")
    docs_dir.mkdir(parents=True, exist_ok=True)
    engine.ingest_docs_folder(str(docs_dir))
    return engine

# Khởi tạo engine với bắt lỗi chi tiết
try:
    rag = get_rag_engine()
except Exception as e:
    st.error(f"⚠️ Lỗi khởi tạo hệ thống: {e}")
    st.info("Vui lòng kiểm tra lại file .env (GEMINI_KEYS và COHERE_API_KEY).")
    st.stop()

# Khởi tạo session state
if "messages" not in st.session_state:
    st.session_state.messages = []

if "uploaded_files_list" not in st.session_state:
    st.session_state.uploaded_files_list = []

# --- SIDEBAR: Quản lý tài liệu ---
with st.sidebar:
    st.header("📂 Kho Tài Liệu")
    
    # Hiển thị tài liệu mặc định
    docs_dir = Path("docs")
    if docs_dir.exists():
        default_files = [f.name for f in docs_dir.glob("*.*") if f.suffix.lower() in [".pdf", ".docx", ".doc", ".txt", ".md"]]
        if default_files:
            st.markdown("**Tài liệu trong kho (`docs/`):**")
            for f in default_files:
                st.caption(f"📄 {f}")
        else:
            st.info("Thư mục `docs/` hiện chưa có tài liệu mẫu.")
            
    # Hiển thị tài liệu tải lên thêm
    if st.session_state.uploaded_files_list:
        st.markdown("**Tài liệu vừa tải lên:**")
        for uf in st.session_state.uploaded_files_list:
            st.caption(f"📑 {uf}")

    st.divider()
    
    # Tải lên tài liệu mới
    st.subheader("Tải lên tài liệu mới")
    uploaded_file = st.file_uploader("Chọn file (.pdf, .docx, .txt, .md)", type=["pdf", "docx", "doc", "txt", "md"])
    
    if uploaded_file is not None:
        if st.button("Xử lý & Nạp vào Database", use_container_width=True):
            with st.spinner("Đang trích xuất và vector hóa dữ liệu..."):
                dest_path = os.path.join("docs", uploaded_file.name)
                with open(dest_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())
                
                res = rag.ingest_file(dest_path, original_filename=uploaded_file.name)
                if uploaded_file.name not in st.session_state.uploaded_files_list:
                    st.session_state.uploaded_files_list.append(uploaded_file.name)
                
                if res.get("status") == "already_indexed":
                    st.info(f"ℹ️ {res.get('message', 'Tài liệu đã tồn tại trong hệ thống.')}")
                else:
                    st.success(f"✅ Đã nạp thành công {res.get('chunks_count', 0)} đoạn từ `{uploaded_file.name}`!")

    st.divider()
    
    # Nút xóa lịch sử trò chuyện
    if st.button("🗑️ Xóa lịch sử trò chuyện", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

# --- GIAO DIỆN CHÍNH: Chatbot ---
st.title("🎓 Trợ Lý Tra Cứu Nội Quy & Quy Chế Đào Tạo Nhà Trường")
st.caption("Chuyên tra cứu Quy chế học vụ, Điểm số, Học phí, Học bổng, Thực tập, Đồ án tốt nghiệp | Gemini 2.5 Flash + Cohere Rerank")

# Hiển thị các câu hỏi gợi ý thường gặp (Pre-generated FAQs)
suggested_faqs = database.get_suggested_questions(limit=6)
clicked_question = None

if suggested_faqs:
    with st.container():
        st.markdown("##### 💡 Gợi ý câu hỏi nhanh (FAQs):")
        cols = st.columns(2)
        for idx, faq in enumerate(suggested_faqs):
            target_col = cols[idx % 2]
            with target_col:
                q_text = faq["question_text"]
                doc_name = faq.get("filename") or ""
                btn_caption = f"📄 {doc_name}: {q_text}" if doc_name else f"💬 {q_text}"
                if st.button(btn_caption, key=f"faq_btn_{faq['question_id']}", use_container_width=True):
                    clicked_question = q_text

st.divider()

# Hiển thị lịch sử chat
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if msg.get("latency"):
            st.caption(f"⏱️ Phản hồi trong {msg['latency']:.2f}s")
        if "sources" in msg and msg["sources"]:
            with st.expander("📍 Nguồn tham chiếu"):
                seen = set()
                for s in msg["sources"]:
                    key = f"{s.get('source')}_p{s.get('page')}"
                    if key not in seen:
                        st.write(f"- Tệp: **{s.get('source')}** (Trang {s.get('page')})")
                        seen.add(key)

# Nhận câu hỏi từ người dùng (nhập bàn phím hoặc bấm nút gợi ý)
user_query = st.chat_input("Nhập câu hỏi cần tra cứu...") or clicked_question

if user_query:
    # 1. Hiển thị câu hỏi người dùng
    st.session_state.messages.append({"role": "user", "content": user_query})
    with st.chat_message("user"):
        st.markdown(user_query)

    # 2. Sinh câu trả lời dạng Streaming
    with st.chat_message("assistant"):
        # Lưu container tạm để chứa sources và latency trong quá trình stream
        stream_meta = {
            "collected_sources": [],
            "latency_val": 0.0
        }

        def stream_generator():
            for event in rag.query_stream(user_query, top_k=2, use_rerank=True):
                evt_type = event.get("type")
                if evt_type == "sources":
                    stream_meta["collected_sources"] = event.get("sources", [])
                elif evt_type == "token":
                    yield event.get("token", "")
                elif evt_type == "done":
                    stream_meta["latency_val"] = event.get("latency", 0.0)

        # Phát trực tiếp văn bản ra màn hình ngay khi AI sinh token
        full_response = st.write_stream(stream_generator())

        # Hiển thị thời gian phản hồi
        if stream_meta["latency_val"] > 0:
            st.caption(f"⚡ Tốc độ phản hồi: {stream_meta['latency_val']:.2f}s | Tối ưu Perceived Latency < 1s")

        # Hiển thị nguồn trích dẫn
        if stream_meta["collected_sources"]:
            with st.expander("📍 Nguồn tham chiếu"):
                seen = set()
                for s in stream_meta["collected_sources"]:
                    key = f"{s.get('source')}_p{s.get('page')}"
                    if key not in seen:
                        st.write(f"- Tệp: **{s.get('source')}** (Trang {s.get('page')})")
                        seen.add(key)

        # Lưu vào session state
        st.session_state.messages.append({
            "role": "assistant",
            "content": full_response,
            "sources": stream_meta["collected_sources"],
            "latency": stream_meta["latency_val"]
        })
