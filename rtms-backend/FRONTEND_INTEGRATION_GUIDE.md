# HƯỚNG DẪN KẾT NỐI FRONTEND VỚI BACKEND API (RTMS)

Tài liệu này hướng dẫn chi tiết cách kết nối file giao diện HTML Frontend (`s_c_b_o_h_ng_c_p_nh_t.html`) với hệ thống Backend Node.js Express + PostgreSQL + Socket.IO vừa được xây dựng.

---

## 1. Khởi chạy Backend Server

```bash
cd rtms-backend

# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Sinh Prisma Client và Chạy Migration Cơ sở dữ liệu
npm run prisma:generate
npm run prisma:migrate

# 3. Nạp dữ liệu mẫu ban đầu (Seeding: Tài khoản, Phòng, Hợp đồng, Hóa đơn)
npm run prisma:seed

# 4. Chạy Backend ở chế độ Development
npm run dev
```
Backend sẽ khởi động tại địa chỉ: `http://localhost:5000`

---

## 2. Thư viện kết nối Socket.IO trên Frontend

Thêm thẻ script này vào `<head>` của file HTML:
```html
<!-- Socket.IO Client -->
<script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
```

---

## 3. Khởi tạo Cấu hình API Client & Socket.IO (`api.js`)

Thay vì lưu dữ liệu cục bộ trong các mảng biến `let dbRooms`, `let dbContracts`..., nhúng đoạn mã dưới đây vào đầu phần `<script>` của Frontend:

```javascript
const API_BASE_URL = 'http://localhost:5000/api';
let authToken = localStorage.getItem('rtms_token') || null;
let currentUser = JSON.parse(localStorage.getItem('rtms_user') || 'null');
let socket = null;

// Helper gọi API tự động đính kèm Bearer Token
async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Lỗi kết nối máy chủ');
        }
        return data;
    } catch (err) {
        showToast(err.message, 'error');
        throw err;
    }
}

// Khởi tạo Socket.IO Real-time
function initSocket() {
    socket = io('http://localhost:5000');

    socket.on('connect', () => {
        console.log('⚡ Đã kết nối Socket.IO thành công:', socket.id);
    });

    // Lắng nghe tin nhắn mới
    socket.on('receive_message', (msg) => {
        appendIncomingChatMessage(msg);
    });

    // Lắng nghe cập nhật thông báo sự cố mới
    socket.on('badge_issue_update', (data) => {
        loadIssues(); // Tự động cập nhật lại danh sách và huy hiệu
    });

    // Lắng nghe hóa đơn được thanh toán
    socket.on('payment_received', (data) => {
        showToast(`Hóa đơn ${data.invId} vừa được gạch nợ thành công!`, 'info');
        loadRooms();
        loadInvoices();
    });
}
```

---

## 4. Bảng Tra Cứu Thay Thế Hàm Mock Bằng API Backend

| Chức năng Frontend | Hàm Mock cũ | API Endpoint Backend tương ứng |
| :--- | :--- | :--- |
| **Đăng nhập** | `handleLogin(e)` | `POST /api/auth/login` |
| **Quên mật khẩu** | `handleSendForgotRequest(e)` | `POST /api/auth/forgot-password` |
| **Lấy danh sách phòng** | `dbRooms` | `GET /api/rooms?status={status}` |
| **Thêm phòng mới** | `handleAddRoomSubmit(e)` | `POST /api/rooms` |
| **Cập nhật phòng** | `saveRoomEdit()` | `PUT /api/rooms/:id` |
| **Hoàn thành sửa chữa** | `finishRepairRoom(id)` | `PATCH /api/rooms/:id/finish-repair` |
| **Danh mục dịch vụ** | `dbServices` | `GET /api/services` |
| **Thêm dịch vụ** | `handleAddServiceSubmit(e)` | `POST /api/services` |
| **Lập hợp đồng mới** | `handleCreateContractSubmit(e)` | `POST /api/contracts` |
| **Duyệt gia hạn HĐ** | `approveRenewal(id)` | `POST /api/contracts/:id/approve-renew` |
| **Gia hạn (Khách thuê)** | `requestContractRenew(months)` | `POST /api/contracts/:id/renew-request` |
| **Khôi phục mật khẩu KH** | `resetUserPassword(id)` | `POST /api/tenants/:id/reset-password` |
| **Xuất hóa đơn & VietQR** | `handleExportInvoice(e)` | `POST /api/invoices/export` |
| **Xác nhận chuyển khoản** | `confirmTenantPayment(invId)` | `POST /api/payments/submit` |
| **Đăng bài bảng tin** | `handleAddPost(e)` | `POST /api/posts` |
| **Gửi báo hỏng sự cố** | `handleCreateIssue(e)` | `POST /api/issues` |
| **Duyệt xử lý sự cố** | `resolveIssue(id)` | `PATCH /api/issues/:id/process` |
| **Lịch sử Chat phòng** | `roomChats[roomId]` | `GET /api/chat/messages/:roomId` |
| **Gửi tin nhắn Chat** | `sendChatMessage()` | `socket.emit('send_message', ...)` |
| **AI OCR Quét CCCD** | `scanCccdWithGemini()` | `POST /api/ai/scan-cccd` |
| **AI OCR Quét Đồng hồ điện** | `scanMeterWithGemini()` | `POST /api/ai/scan-meter` |

---

## 5. Ví dụ Triển Khai Thực Tế

### 5.1. Xử Lý Đăng Nhập
```javascript
async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();
    const role = selectedLoginRole === 'landlord' ? 'LANDLORD' : 'TENANT';

    try {
        const res = await apiRequest('/auth/login', 'POST', { username: u, password: p, role });
        authToken = res.data.token;
        currentUser = res.data.user;
        localStorage.setItem('rtms_token', authToken);
        localStorage.setItem('rtms_user', JSON.stringify(currentUser));

        document.getElementById('auth-screen').classList.add('hidden');
        initSocket();
        
        if (role === 'LANDLORD') {
            switchRole('landlord');
            loadRooms();
        } else {
            switchRole('tenant');
            loadTenantHome();
        }
        showToast('Đăng nhập thành công!');
    } catch (err) {
        const errEl = document.getElementById('login-error-msg');
        errEl.innerText = err.message;
        errEl.classList.remove('hidden');
    }
}
```

### 5.2. Tải Danh Sách Phòng Trọ Từ Database
```javascript
async function loadRooms() {
    const filter = document.getElementById('room-filter-status')?.value || 'ALL';
    const res = await apiRequest(`/rooms?status=${encodeURIComponent(filter)}`);
    dbRooms = res.data; // Gán lại mảng dữ liệu lấy từ backend
    renderLandlordOverview(); // Gọi hàm render giao diện đã có
}
```

### 5.3. Gửi Tin Nhắn Thời Gian Thực (Socket.IO)
```javascript
function sendChatMessage() {
    const input = document.getElementById('chat-input-text');
    const text = input.value.trim();
    if (!text) return;

    socket.emit('send_message', {
        roomId: activeChatRoomId,
        senderRole: currentRole, // 'landlord' | 'tenant'
        text: text
    });

    input.value = '';
}
```

