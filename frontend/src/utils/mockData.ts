import { ChatMessage, ChatSession, DocumentItem, SourceItem } from '../types/rag';

export const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-1',
    filename: 'quy_che_hoc_vu.pdf',
    file_size: 65467,
    file_type: 'pdf',
    chunk_count: 28,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    status: 'indexed',
    summary: 'Quy chế đào tạo đại học, đăng ký tín chỉ, thang điểm GPA/CPA, điều kiện xét tốt nghiệp và xử lý cảnh báo học vụ.',
  },
  {
    id: 'doc-2',
    filename: 'quy_che_thuc_tap_va_do_an.pdf',
    file_size: 67968,
    file_type: 'pdf',
    chunk_count: 24,
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    status: 'indexed',
    summary: 'Quy chế thực tập doanh nghiệp (OJT), tiêu chuẩn xét làm khóa luận tốt nghiệp và bảo vệ đồ án chuyên ngành.',
  },
  {
    id: 'doc-3',
    filename: 'quy_dinh_hoc_phi_va_hoc_bong.pdf',
    file_size: 70347,
    file_type: 'pdf',
    chunk_count: 32,
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
    status: 'indexed',
    summary: 'Quy định mức thu học phí, hạn đóng, thủ tục gia hạn học phí và tiêu chí xét học bổng khuyến khích học tập.',
  },
];

export const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-1',
    title: 'Quy chế Đăng ký Tín chỉ & Điểm số GPA',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    message_count: 2,
    pinned: true,
  },
  {
    id: 'session-2',
    title: 'Điều kiện Thực tập Doanh nghiệp (OJT)',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000 * 2 + 1800000).toISOString(),
    message_count: 2,
  },
  {
    id: 'session-3',
    title: 'Chính sách Học bổng & Gia hạn Học phí',
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
      content: 'Sinh viên cần đăng ký tối thiểu và tối đa bao nhiêu tín chỉ trong một học kỳ chính?',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    },
    {
      id: 'm1-a',
      role: 'assistant',
      content: `Căn cứ theo **quy_che_hoc_vu.pdf**, quy định về số lượng tín chỉ đăng ký như sau:

### 1. Số lượng Tín chỉ quy định
* **Học kỳ chính:** Sinh viên phải đăng ký tối thiểu **12 tín chỉ** và tối đa **24 tín chỉ**.
* **Học kỳ hè (Học kỳ phụ):** Tối đa **10 tín chỉ** (không bắt buộc số lượng tối thiểu).

### 2. Trường hợp đặc biệt
* Sinh viên bị cảnh báo học tập mức 1 hoặc 2: Số tín chỉ đăng ký tối đa bị giới hạn ở mức **14 tín chỉ** trong học kỳ kế tiếp.
* Sinh viên trong học kỳ cuối trước khi tốt nghiệp được phép đăng ký dưới 12 tín chỉ nếu chỉ còn thiếu ít hơn số tín chỉ tối thiểu để hoàn thành chương trình.`,
      sources: [
        {
          id: 'src-101',
          source: 'quy_che_hoc_vu.pdf',
          page: 2,
          chunk_index: 3,
          char_count: 450,
          file_type: 'pdf',
          similarity: 0.95,
          relevance_score: 0.98,
          content_snippet: 'Điều 6. Đăng ký học phần. Trong mỗi học kỳ chính, sinh viên phải đăng ký tối thiểu 12 tín chỉ và tối đa 24 tín chỉ, trừ học kỳ cuối của khóa học.',
          highlight_text: 'tối thiểu 12 tín chỉ và tối đa 24 tín chỉ',
        },
      ],
      latency: 0.72,
      timestamp: new Date(Date.now() - 3600000 * 2 + 15000).toISOString(),
      feedback: 'like',
      model: 'Gemini 2.5 Flash • Cohere Rerank',
    },
  ],
  'session-2': [
    {
      id: 'm2-u',
      role: 'user',
      content: 'Điều kiện để sinh viên đủ điều kiện tham gia học phần Thực tập Doanh nghiệp (OJT)?',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: 'm2-a',
      role: 'assistant',
      content: `Căn cứ theo tài liệu **quy_che_thuc_tap_va_do_an.pdf**, điều kiện đi thực tập doanh nghiệp gồm:

### 1. Tiêu chuẩn về Tín chỉ và Học lực
- **Số tín chỉ tích lũy:** Sinh viên phải tích lũy tối thiểu **105 tín chỉ chuyên ngành**.
- **Kỷ luật:** Không trong thời gian bị kỷ luật từ mức khiển trách trở lên.

### 2. Thời gian thực tập
- **Thời lượng:** Từ **12 đến 16 tuần** làm việc toàn thời gian (Full-time) tại doanh nghiệp đối tác tiếp nhận.`,
      sources: [
        {
          id: 'src-201',
          source: 'quy_che_thuc_tap_va_do_an.pdf',
          page: 1,
          chunk_index: 1,
          char_count: 520,
          file_type: 'pdf',
          similarity: 0.96,
          relevance_score: 0.99,
          content_snippet: 'Mục 1. Điều kiện đi thực tập: Sinh viên tích lũy tối thiểu 105 tín chỉ chuyên ngành, không bị kỷ luật từ mức khiển trách trở lên. Thời gian thực tập tiêu chuẩn từ 12-16 tuần.',
          highlight_text: 'tích lũy tối thiểu 105 tín chỉ chuyên ngành',
        },
      ],
      latency: 0.65,
      timestamp: new Date(Date.now() - 86400000 * 2 + 12000).toISOString(),
      model: 'Gemini 2.5 Flash • Cohere Rerank',
    },
  ],
  'session-3': [
    {
      id: 'm3-u',
      role: 'user',
      content: 'Điều kiện để được xét nhận học bổng khuyến khích học tập của trường là gì?',
      timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
    {
      id: 'm3-a',
      role: 'assistant',
      content: `Căn cứ theo văn bản **quy_dinh_hoc_phi_va_hoc_bong.pdf**, tiêu chuẩn xét cấp học bổng khuyến khích học tập gồm:

### 1. Tiêu chí Học tập và Rèn luyện
- **Điểm trung bình học kỳ (GPA):** Đạt từ **3.2/4.0** trở lên (loại Giỏi) hoặc từ **3.6/4.0** trở lên (loại Xuất sắc).
- **Điểm rèn luyện (ĐRL):** Đạt từ **80 điểm** trở lên (loại Tốt hoặc Xuất sắc).
- **Khối lượng học tập:** Đăng ký và hoàn thành tối thiểu **14 tín chỉ** trong học kỳ xét học bổng.

### 2. Điều kiện loại trừ
- Không có học phần nào bị điểm F hoặc phải thi lại/học lại trong học kỳ đó.`,
      sources: [
        {
          id: 'src-301',
          source: 'quy_dinh_hoc_phi_va_hoc_bong.pdf',
          page: 3,
          chunk_index: 5,
          char_count: 580,
          file_type: 'pdf',
          similarity: 0.94,
          relevance_score: 0.97,
          content_snippet: 'Chương 2. Học bổng khuyến khích học tập. Tiêu chuẩn: GPA >= 3.2, Điểm rèn luyện >= 80, đăng ký tối thiểu 14 tín chỉ, không có môn điểm F.',
          highlight_text: 'GPA >= 3.2, Điểm rèn luyện >= 80, đăng ký tối thiểu 14 tín chỉ',
        },
      ],
      latency: 0.68,
      timestamp: new Date(Date.now() - 86400000 * 5 + 10000).toISOString(),
      model: 'Gemini 2.5 Flash • Cohere Rerank',
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

  // Credit / GPA / course registration
  if (q.includes('tín chỉ') || q.includes('gpa') || q.includes('cpa') || q.includes('đăng ký') || q.includes('rút môn') || q.includes('điểm')) {
    return {
      answer: `Căn cứ theo tài liệu **quy_che_hoc_vu.pdf**:

### 🎓 Quy định Đăng ký & Thang điểm Học tập
- **Số tín chỉ:** Đăng ký tối thiểu **12 tín chỉ** và tối đa **24 tín chỉ** trong học kỳ chính.
- **Thang điểm 4:** Điểm A (3.7 - 4.0), B (3.0 - 3.6), C (2.0 - 2.9), D (1.0 - 1.9), F (< 1.0 - Học lại).
- **Cảnh báo học vụ:** Sinh viên có CPA < 1.2 (năm 1) hoặc < 1.4 (năm 2) sẽ bị cảnh báo học tập mức 1.`,
      sources: [
        {
          id: 'mock-s1',
          source: 'quy_che_hoc_vu.pdf',
          page: 2,
          chunk_index: 3,
          char_count: 450,
          file_type: 'pdf',
          similarity: 0.95,
          relevance_score: 0.98,
          content_snippet: 'Điều 6: Đăng ký học phần tối thiểu 12 tín chỉ, tối đa 24 tín chỉ trong học kỳ chính.',
          highlight_text: 'tối thiểu 12 tín chỉ, tối đa 24 tín chỉ',
        },
      ],
    };
  }

  // Internship / OJT / graduation project
  if (q.includes('thực tập') || q.includes('ojt') || q.includes('đồ án') || q.includes('tốt nghiệp') || q.includes('khóa luận')) {
    return {
      answer: `Căn cứ theo văn bản **quy_che_thuc_tap_va_do_an.pdf**:

### 📌 Tiêu chuẩn Thực tập & Đồ án tốt nghiệp
1. **Thực tập Doanh nghiệp (OJT):** Sinh viên cần tích lũy tối thiểu **105 tín chỉ chuyên ngành**, thời gian thực tập từ **12 - 16 tuần**.
2. **Làm Đồ án Tốt nghiệp:** Đạt điểm tích lũy CPA >= 2.0/4.0 và không nợ các học phần tiên quyết của ngành.`,
      sources: [
        {
          id: 'mock-s2',
          source: 'quy_che_thuc_tap_va_do_an.pdf',
          page: 1,
          chunk_index: 1,
          char_count: 520,
          file_type: 'pdf',
          similarity: 0.96,
          relevance_score: 0.99,
          content_snippet: 'Điều kiện thực tập: Tích lũy tối thiểu 105 tín chỉ chuyên ngành. Thời gian thực tập tiêu chuẩn 12-16 tuần.',
          highlight_text: 'Tích lũy tối thiểu 105 tín chỉ chuyên ngành',
        },
      ],
    };
  }

  // Tuition / Scholarship
  if (q.includes('học phí') || q.includes('học bổng') || q.includes('gia hạn') || q.includes('miễn giảm')) {
    return {
      answer: `Căn cứ theo quy định tại **quy_dinh_hoc_phi_va_hoc_bong.pdf**:

### 💰 Học phí & Chế độ Học bổng
- **Học bổng khuyến khích:** GPA >= 3.2, ĐRL >= 80 và tối thiểu 14 tín chỉ trong kỳ.
- **Gia hạn học phí:** Sinh viên nộp đơn xin gia hạn trước thời hạn quy định, được gia hạn tối đa 30 ngày kể từ ngày hết hạn thông báo.`,
      sources: [
        {
          id: 'mock-s3',
          source: 'quy_dinh_hoc_phi_va_hoc_bong.pdf',
          page: 3,
          chunk_index: 5,
          char_count: 580,
          file_type: 'pdf',
          similarity: 0.94,
          relevance_score: 0.97,
          content_snippet: 'Quy định xét học bổng: GPA >= 3.2, ĐRL >= 80 điểm. Gia hạn học phí tối đa 30 ngày.',
          highlight_text: 'GPA >= 3.2, ĐRL >= 80 điểm',
        },
      ],
    };
  }

  // Default refusal or academic guidance
  const docName = documents.length > 0 ? documents[0].filename : 'quy_che_hoc_vu.pdf';
  return {
    answer: `Tôi là Trợ lý Tra cứu Nội quy và Quy chế Đào tạo của Nhà trường.

Dựa trên tài liệu quy chế **${docName}**:
Nếu câu hỏi của bạn liên quan đến quy chế học vụ, điểm số, đăng ký môn học, học phí, học bổng hoặc thực tập, hệ thống sẽ đối chiếu và trích dẫn số trang chính xác. 

Nếu câu hỏi nằm ngoài phạm vi quy chế nhà trường, vui lòng đặt lại câu hỏi liên quan đến các chủ đề đào tạo học vụ.`,
    sources: [
      {
        id: 'mock-s-gen',
        source: docName,
        page: 1,
        chunk_index: 1,
        char_count: 420,
        file_type: 'pdf',
        similarity: 0.88,
        relevance_score: 0.92,
        content_snippet: `Tài liệu ${docName}: Các điều khoản quy định về đào tạo, học vụ, khảo thí và quản lý sinh viên.`,
        highlight_text: question,
      },
    ],
  };
}
