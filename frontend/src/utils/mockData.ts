import { ChatMessage, ChatSession, DocumentItem, SourceItem } from '../types/rag';

export const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-1',
    filename: 'Bao_cao_tai_chinh_2025.pdf',
    file_size: 2450000,
    file_type: 'pdf',
    chunk_count: 142,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'indexed',
    summary: 'Báo cáo kết quả hoạt động kinh doanh, cân đối kế toán & kế hoạch ngân sách tài chính năm 2025.',
  },
  {
    id: 'doc-2',
    filename: 'Huong_dan_nhan_vien.docx',
    file_size: 890000,
    file_type: 'docx',
    chunk_count: 58,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'indexed',
    summary: 'Sổ tay văn hóa doanh nghiệp, quy chế làm việc, chế độ nghỉ phép và quyền lợi bảo hiểm nhân sự.',
  },
  {
    id: 'doc-3',
    filename: 'Quy_che_thuc_tap_OJT.pdf',
    file_size: 1280000,
    file_type: 'pdf',
    chunk_count: 84,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    status: 'indexed',
    summary: 'Quy định chi tiết điều kiện số tín chỉ tích lũy, quy trình đánh giá và bảo vệ đồ án thực tập doanh nghiệp.',
  },
];

export const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Phân tích Báo cáo Tài chính Q4 & Dự báo 2025',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    message_count: 2,
    pinned: true,
  },
  {
    id: 'session-2',
    title: 'Quy chế Làm việc, Nghỉ phép & Chế độ Phúc lợi',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2 + 1800000).toISOString(),
    message_count: 2,
  },
  {
    id: 'session-3',
    title: 'Hướng dẫn Thực tập Doanh nghiệp (OJT) & Tín chỉ',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 5 + 3600000).toISOString(),
    message_count: 2,
  },
];

export const INITIAL_MESSAGES_MAP: Record<string, ChatMessage[]> = {
  'session-1': [
    {
      id: 'm1-u',
      role: 'user',
      content: 'Tóm tắt các chỉ số tài chính trọng yếu trong quý 4 và mục tiêu doanh thu năm 2025 từ báo cáo tài chính?',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'm1-a',
      role: 'assistant',
      content: `Dựa trên tài liệu **Báo cáo Tài chính 2025**, dưới đây là bản tóm tắt các chỉ số kinh doanh trọng yếu:

### 1. Tổng quan kết quả Quý 4
* **Tổng doanh thu thuần:** Đạt **148.5 tỷ VNĐ** (tăng trưởng **18.2%** so với cùng kỳ năm trước).
* **Lợi nhuận gộp:** Đạt **52.4 tỷ VNĐ**, biên lợi nhuận gộp duy trì ở mức **35.3%**.
* **Lợi nhuận trước thuế (EBT):** Đạt **28.6 tỷ VNĐ**, hoàn thành **105%** kế hoạch quý đặt ra.

### 2. Bảng so sánh chỉ tiêu tài chính
| Chỉ số | Thực hiện Q4 | Kế hoạch Q4 | Tăng trưởng YoY |
| :--- | :--- | :--- | :--- |
| **Doanh thu thuần** | 148.5 tỷ | 140.0 tỷ | +18.2% |
| **EBITDA** | 34.1 tỷ | 31.5 tỷ | +14.6% |
| **Lợi nhuận ròng (PAT)** | 22.8 tỷ | 20.0 tỷ | +21.0% |
| **Dòng tiền từ HĐKD** | +41.2 tỷ | +35.0 tỷ | +26.5% |

### 3. Mục tiêu chiến lược năm 2025
1. **Mục tiêu doanh thu năm 2025:** Hướng tới mốc **650 tỷ VNĐ** (+22% so với 2024).
2. **Trọng tâm đầu tư:** Dành **15% ngân sách** cho việc mở rộng hạ tầng Cloud và ứng dụng AI tự động hóa quy trình.`,
      sources: [
        {
          id: 'src-101',
          source: 'Bao_cao_tai_chinh_2025.pdf',
          page: 8,
          chunk_index: 24,
          char_count: 650,
          file_type: 'pdf',
          similarity: 0.94,
          relevance_score: 0.96,
          content_snippet: 'Mục 3.2 Kết quả kinh doanh Quý 4 ghi nhận doanh thu thuần 148.5 tỷ VNĐ (+18.2% YoY). Lợi nhuận trước thuế đạt 28.6 tỷ VNĐ tương đương 105% kế hoạch. Dòng tiền thuần từ hoạt động kinh doanh duy trì dương 41.2 tỷ VNĐ.',
          highlight_text: 'doanh thu thuần 148.5 tỷ VNĐ (+18.2% YoY). Lợi nhuận trước thuế đạt 28.6 tỷ VNĐ',
        },
        {
          id: 'src-102',
          source: 'Bao_cao_tai_chinh_2025.pdf',
          page: 15,
          chunk_index: 45,
          char_count: 512,
          file_type: 'pdf',
          similarity: 0.89,
          relevance_score: 0.91,
          content_snippet: 'Phần V: Kế hoạch ngân sách 2025 dự kiến tổng doanh thu đạt 650 tỷ đồng. Trong đó, chi phí CAPEX dành cho chuyển đổi số và công nghệ trí tuệ nhân tạo (AI) chiếm 15% tổng mức đầu tư.',
          highlight_text: 'tổng doanh thu đạt 650 tỷ đồng. Trong đó, chi phí CAPEX dành cho chuyển đổi số và công nghệ trí tuệ nhân tạo (AI) chiếm 15%',
        },
      ],
      latency: 0.84,
      timestamp: new Date(Date.now() - 3600000 * 2 + 15000).toISOString(),
      feedback: 'like',
      model: 'Gemini 3.6 Flash • Cohere Rerank',
    },
  ],
  'session-2': [
    {
      id: 'm2-u',
      role: 'user',
      content: 'Quy định về số ngày nghỉ phép năm và thủ tục xin làm việc từ xa (Remote/Hybrid) như thế nào?',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'm2-a',
      role: 'assistant',
      content: `Theo tài liệu **Huong_dan_nhan_vien.docx** (Sổ tay nhân sự), các chính sách nghỉ phép và làm việc linh hoạt được quy định cụ thể:

### 1. Chính sách Nghỉ phép năm (Annual Leave)
- **Số ngày phép tiêu chuẩn:** Nhân viên chính thức được hưởng **12 ngày phép có hưởng lương/năm**.
- **Thâm niên:** Cứ mỗi **03 năm làm việc liên tục** tại công ty, nhân viên được cộng thêm **01 ngày phép năm**.
- **Chuyển tiếp phép:** Phép năm chưa dùng hết được chuyển sang năm tiếp theo và phải sử dụng trước ngày **31/03**.

### 2. Quy trình đăng ký Làm việc từ xa (Remote / Hybrid)
1. **Hạn mức:** Nhân viên khối kỹ thuật và văn phòng được tối đa **02 ngày WFH/tuần** (thứ Tư hoặc thứ Sáu).
2. **Quy trình gửi đơn:** 
   - Tạo yêu cầu trên cổng thông tin nội bộ (HR Portal) trước ít nhất **24 giờ**.
   - Phải được Quản lý trực tiếp (Team Lead/Manager) phê duyệt.
   - Đảm bảo sẵn sàng kết nối qua Slack/Teams trong khung giờ làm việc chính (09:00 - 18:00).`,
      sources: [
        {
          id: 'src-201',
          source: 'Huong_dan_nhan_vien.docx',
          page: 12,
          chunk_index: 18,
          char_count: 580,
          file_type: 'docx',
          similarity: 0.92,
          relevance_score: 0.95,
          content_snippet: 'Điều 14: Nghỉ phép năm và ngày nghỉ lễ. Nhân viên có hợp đồng lao động chính thức được hưởng 12 ngày phép hưởng nguyên lương mỗi năm. Với mỗi chu kỳ 3 năm thâm niên, nhân sự được cộng thêm 1 ngày.',
          highlight_text: 'được hưởng 12 ngày phép hưởng nguyên lương mỗi năm. Với mỗi chu kỳ 3 năm thâm niên, nhân sự được cộng thêm 1 ngày',
        },
        {
          id: 'src-202',
          source: 'Huong_dan_nhan_vien.docx',
          page: 19,
          chunk_index: 31,
          char_count: 490,
          file_type: 'docx',
          similarity: 0.88,
          relevance_score: 0.89,
          content_snippet: 'Chương 4: Quy chế làm việc linh hoạt (Hybrid Work). Cho phép nhân sự WFH tối đa 2 ngày/tuần. Yêu cầu tạo ticket trên HR Portal trước 24h và có xác nhận của Trưởng bộ phận.',
          highlight_text: 'WFH tối đa 2 ngày/tuần. Yêu cầu tạo ticket trên HR Portal trước 24h',
        },
      ],
      latency: 0.68,
      timestamp: new Date(Date.now() - 86400000 * 2 + 12000).toISOString(),
      model: 'Gemini 3.6 Flash • Cohere Rerank',
    },
  ],
  'session-3': [
    {
      id: 'm3-u',
      role: 'user',
      content: 'Điều kiện để sinh viên đủ điều kiện tham gia học phần Thực tập Doanh nghiệp (OJT)?',
      timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'm3-a',
      role: 'assistant',
      content: `Căn cứ theo **Quy_che_thuc_tap_OJT.pdf**, sinh viên cần đáp ứng đầy đủ các tiêu chuẩn sau để đăng ký thực tập doanh nghiệp:

### 1. Điều kiện về Tín chỉ & Học lực
- **Tín chỉ tích lũy tối thiểu:** Sinh viên phải tích lũy từ **75% tổng số tín chỉ** của chương trình đào tạo trở lên (thường tương đương từ **95 - 105 tín chỉ** tùy ngành).
- **Điểm trung bình tích lũy (CPA / GPA):** Đạt tối thiểu **2.0/4.0** (hoặc tương đương hạng Trung bình trở lên).
- **Học phần tiên quyết:** Không nợ các môn thực hành cơ sở ngành hoặc đồ án chuyên ngành cấp 1.

### 2. Thời gian & Hình thức Thực tập
- **Thời lượng:** Tối thiểu **12 tuần** làm việc liên tục toàn thời gian (Full-time) tại doanh nghiệp đối tác hoặc tiếp nhận.
- **Báo cáo định kỳ:** Nộp nhật ký thực tập (Weekly Log) và báo cáo giữa kỳ có chữ ký/đóng dấu xác nhận của Mentor tại doanh nghiệp.`,
      sources: [
        {
          id: 'src-301',
          source: 'Quy_che_thuc_tap_OJT.pdf',
          page: 4,
          chunk_index: 8,
          char_count: 610,
          file_type: 'pdf',
          similarity: 0.95,
          relevance_score: 0.98,
          content_snippet: 'Điều 5: Tiêu chuẩn xét duyệt thực tập tốt nghiệp. Sinh viên phải hoàn thành tối thiểu 75% khối lượng tín chỉ toàn khóa, điểm trung bình chung tích lũy CPA >= 2.0 và đã đạt tất cả học phần tiên quyết.',
          highlight_text: 'hoàn thành tối thiểu 75% khối lượng tín chỉ toàn khóa, điểm trung bình chung tích lũy CPA >= 2.0',
        },
      ],
      latency: 0.72,
      timestamp: new Date(Date.now() - 86400000 * 5 + 10000).toISOString(),
      model: 'Gemini 3.6 Flash • Cohere Rerank',
    },
  ],
};

/**
 * Intelligent simulated response generator for testing & offline mode
 */
export function generateMockRagAnswer(
  question: string,
  documents: DocumentItem[]
): {
  answer: string;
  sources: SourceItem[];
} {
  const q = question.toLowerCase();

  // Financial / revenue question
  if (q.includes('tài chính') || q.includes('doanh thu') || q.includes('lợi nhuận') || q.includes('chi phí') || q.includes('q4') || q.includes('2025')) {
    return {
      answer: `Theo dữ liệu trích xuất từ tài liệu **Bao_cao_tai_chinh_2025.pdf**:

### 📊 Chỉ số tài chính & Phân tích chuyên sâu
- **Doanh thu thuần:** Đạt **148.5 tỷ VNĐ** trong Q4 (tăng **18.2%** YoY), nâng lũy kế cả năm lên **532.8 tỷ VNĐ**.
- **Lợi nhuận ròng:** Đạt **22.8 tỷ VNĐ** trong quý, biên lợi nhuận ròng đạt **15.3%**.
- **Chỉ số thanh khoản hiện thời (Current Ratio):** Đạt **1.85x**, phản ánh cấu trúc tài chính lành mạnh và an toàn vốn cao.

> *Nhận định:* Tốc độ tăng trưởng doanh thu được thúc đẩy mạnh mẽ nhờ mở rộng tệp khách hàng khối doanh nghiệp (B2B SaaS) và tối ưu hóa chi phí vận hành.`,
      sources: [
        {
          id: 'mock-s1',
          source: 'Bao_cao_tai_chinh_2025.pdf',
          page: 8,
          chunk_index: 24,
          char_count: 650,
          file_type: 'pdf',
          similarity: 0.94,
          relevance_score: 0.96,
          content_snippet: 'Doanh thu thuần Q4 đạt 148.5 tỷ VNĐ (+18.2% YoY). Lợi nhuận trước thuế đạt 28.6 tỷ VNĐ tương đương 105% kế hoạch. Dòng tiền thuần từ hoạt động kinh doanh duy trì dương 41.2 tỷ VNĐ.',
          highlight_text: 'Doanh thu thuần Q4 đạt 148.5 tỷ VNĐ (+18.2% YoY). Lợi nhuận trước thuế đạt 28.6 tỷ VNĐ',
        },
        {
          id: 'mock-s2',
          source: 'Bao_cao_tai_chinh_2025.pdf',
          page: 15,
          chunk_index: 45,
          char_count: 512,
          file_type: 'pdf',
          similarity: 0.89,
          relevance_score: 0.91,
          content_snippet: 'Kế hoạch kinh doanh và chỉ số thanh khoản: Current ratio duy trì 1.85x. Mục tiêu doanh thu toàn niên 2025 là 650 tỷ VNĐ.',
          highlight_text: 'Current ratio duy trì 1.85x. Mục tiêu doanh thu toàn niên 2025 là 650 tỷ VNĐ',
        },
      ],
    };
  }

  // HR / leave / remote policy
  if (q.includes('nghỉ phép') || q.includes('nhân viên') || q.includes('phúc lợi') || q.includes('remote') || q.includes('wfh') || q.includes('bảo hiểm')) {
    return {
      answer: `Đối chiếu với tài liệu **Huong_dan_nhan_vien.docx**:

### 📌 Quy định chế độ nhân sự
1. **Nghỉ phép thường niên:** Nhân viên chính thức có **12 ngày phép/năm**. Cứ 3 năm gắn bó tăng thêm **1 ngày phép**.
2. **Chế độ bảo hiểm:** Công ty đóng đầy đủ BHXH, BHYT, BHTN theo 100% lương gross, kèm gói bảo hiểm sức khỏe cao cấp PVI Care.
3. **Làm việc từ xa (WFH):** Cho phép tối đa **2 ngày/tuần** sau khi đăng ký qua HR Portal và được Leader phê duyệt trước 24h.`,
      sources: [
        {
          id: 'mock-s3',
          source: 'Huong_dan_nhan_vien.docx',
          page: 12,
          chunk_index: 18,
          char_count: 580,
          file_type: 'docx',
          similarity: 0.93,
          relevance_score: 0.95,
          content_snippet: 'Điều 14: Nhân viên chính thức hưởng 12 ngày phép/năm. Thâm niên 3 năm cộng thêm 1 ngày. Chế độ WFH tối đa 2 ngày/tuần sau khi tạo đơn trên portal.',
          highlight_text: 'hưởng 12 ngày phép/năm. Thâm niên 3 năm cộng thêm 1 ngày. Chế độ WFH tối đa 2 ngày/tuần',
        },
      ],
    };
  }

  // Internship / training / OJT
  if (q.includes('thực tập') || q.includes('ojt') || q.includes('tín chỉ') || q.includes('học bổng') || q.includes('sinh viên')) {
    return {
      answer: `Căn cứ theo văn bản **Quy_che_thuc_tap_OJT.pdf**:

### 🎓 Quy định Thực tập Doanh nghiệp (OJT)
- **Khối lượng tích lũy:** Tối thiểu **75% tổng tín chỉ** của chương trình đào tạo.
- **Điểm CPA:** Đạt tối thiểu **2.0/4.0** và không trong thời gian bị cảnh cáo học vụ.
- **Thời lượng thực tập:** Tối thiểu **12 tuần liên tục** tại doanh nghiệp.
- **Đánh giá:** Điểm tổng kết = 40% Đánh giá từ Doanh nghiệp + 60% Điểm Hội đồng bảo vệ báo cáo.`,
      sources: [
        {
          id: 'mock-s4',
          source: 'Quy_che_thuc_tap_OJT.pdf',
          page: 4,
          chunk_index: 8,
          char_count: 610,
          file_type: 'pdf',
          similarity: 0.95,
          relevance_score: 0.97,
          content_snippet: 'Điều 5: Điều kiện thực tập OJT yêu cầu tích lũy 75% số tín chỉ toàn khóa, điểm trung bình CPA >= 2.0. Thời gian thực tập chuẩn là 12 tuần.',
          highlight_text: 'tích lũy 75% số tín chỉ toàn khóa, điểm trung bình CPA >= 2.0. Thời gian thực tập chuẩn là 12 tuần',
        },
      ],
    };
  }

  // Default smart synthesized answer with connected documents
  const docName = documents.length > 0 ? documents[0].filename : 'Tài liệu hệ thống';
  return {
    answer: `Dựa trên kết quả tra cứu ngữ nghĩa vector từ cơ sở tri thức (tài liệu **${docName}**):

### 💡 Thông tin tổng hợp cho câu hỏi:
"${question}"

1. **Nội dung trích xuất chính:** Hệ thống đã đối chiếu và xác thực thông tin thông qua **ChromaDB Vector Store** cùng thuật toán **Cohere Reranker v3.5**.
2. **Điểm quan trọng:** Các dữ liệu được tổng hợp trực tiếp từ các đoạn văn bản (chunks) đã được nạp trong cơ sở dữ liệu.
3. **Khuyến nghị:** Bạn có thể nhấp vào các thẻ trích dẫn nguồn bên dưới để xem toàn văn đoạn trích và vị trí trang chính xác trong tài liệu gốc.`,
    sources: [
      {
        id: 'mock-s-gen',
        source: docName,
        page: 1,
        chunk_index: 1,
        char_count: 420,
        file_type: docName.endsWith('.pdf') ? 'pdf' : 'docx',
        similarity: 0.88,
        relevance_score: 0.92,
        content_snippet: `Đoạn trích từ ${docName}: "Các nội dung quy định, hướng dẫn và số liệu được đối soát tự động theo câu hỏi của người dùng: '${question}'."`,
        highlight_text: question,
      },
    ],
  };
}
