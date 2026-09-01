import streamlit as st
from pathlib import Path
from rag_engine import RAGEngine

# Cấu hình trang giao diện
st.set_page_config(
    page_title="Trợ lý Tra Cứu Tài Liệu AI (Gemini + Cohere)", 
    page_icon="📚", 
    layout="wide"
)

@st.cache_resource
def get_rag_engine():
    """Khởi tạo RAG Engine và nạp file mẫu từ thư mục docs"""
    engine = RAGEngine()
    engine.ingest_docs_folder("docs")
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
        default_files = [f.name for f in docs_dir.glob("*.pdf")]
        if default_files:
            st.markdown("**Tài liệu mặc định (`docs/`):**")
            for f in default_files:
                st.caption(f"📄 {f}")
        else:
            st.info("Thư mục `docs/` hiện chưa có file PDF mẫu.")
            
    # Hiển thị tài liệu tải lên thêm
    if st.session_state.uploaded_files_list:
        st.markdown("**Tài liệu tải lên thêm:**")
        for uf in st.session_state.uploaded_files_list:
            st.caption(f"📑 {uf}")

    st.divider()
    
    # Tải lên tài liệu PDF mới
    st.subheader("Tải lên tài liệu mới")
    uploaded_file = st.file_uploader("Chọn file PDF bổ sung", type=["pdf"])
    
    if uploaded_file is not None:
        if st.button("Xử lý & Nạp vào Database", use_container_width=True):
            with st.spinner("Đang trích xuất và vector hóa dữ liệu..."):
                chunks = rag.extract_text_from_pdf(uploaded_file, uploaded_file.name)
                rag.add_documents_to_db(chunks)
                if uploaded_file.name not in st.session_state.uploaded_files_list:
                    st.session_state.uploaded_files_list.append(uploaded_file.name)
                st.success(f"Đã nạp thành công {len(chunks)} đoạn từ `{uploaded_file.name}`!")

    st.divider()
    
    # Nút xóa lịch sử trò chuyện
    if st.button("🗑️ Xóa lịch sử trò chuyện", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

# --- GIAO DIỆN CHÍNH: Chatbot ---
st.title("📚 Trợ Lý Tra Cứu Quy Chế & Tài Liệu")
st.caption("Kiến trúc RAG nâng cao: ChromaDB + Cohere Rerank + Google Gemini 2.5 Flash")

# Hiển thị lịch sử chat
for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])
        if "sources" in msg and msg["sources"]:
            with st.expander("📍 Nguồn tham chiếu"):
                seen = set()
                for s in msg["sources"]:
                    key = f"{s.get('source')}_p{s.get('page')}"
                    if key not in seen:
                        st.write(f"- Tệp: **{s.get('source')}** (Trang {s.get('page')})")
                        seen.add(key)

# Nhận câu hỏi từ người dùng
if user_query := st.chat_input("Nhập câu hỏi cần tra cứu..."):
    # 1. Hiển thị câu hỏi
    st.session_state.messages.append({"role": "user", "content": user_query})
    with st.chat_message("user"):
        st.markdown(user_query)

    # 2. Sinh câu trả lời
    with st.chat_message("assistant"):
        with st.spinner("Đang tìm kiếm, xếp hạng (Cohere) và tổng hợp kết quả (Gemini)..."):
            answer, sources = rag.query(user_query)
            st.markdown(answer)
            
            # Hiển thị nguồn trích dẫn
            if sources:
                with st.expander("📍 Nguồn tham chiếu"):
                    seen = set()
                    for s in sources:
                        key = f"{s.get('source')}_p{s.get('page')}"
                        if key not in seen:
                            st.write(f"- Tệp: **{s.get('source')}** (Trang {s.get('page')})")
                            seen.add(key)

            # Lưu vào session state
            st.session_state.messages.append({
                "role": "assistant",
                "content": answer,
                "sources": sources
            })