# Realtime Chat and Video Call Platform

Ứng dụng React/Vite và Express/Socket.IO/MongoDB bằng JavaScript. Frontend giao diện dùng .jsx; backend, store, service và script dùng .js. Backend chạy trực tiếp bằng Node.js ESM, không cần TypeScript hoặc thư mục dist.

## Trạng thái

| Phần | Hiện tại |
|---|---|
| Auth, danh bạ và chat cá nhân | Có code; đã kiểm tra logic/HTTP; còn cần nghiệm thu đầy đủ với MongoDB |
| Ảnh/file, typing, presence | Có code; presence dành cho một backend; file đang có URL công khai |
| Độ tin cậy client | Chặn response thuộc phiên cũ; gộp refresh token; tải bù lịch sử theo cursor; bỏ kết quả tìm kiếm lỗi thời |
| Chat nhóm | Mới có Group/GroupMember; chưa có luồng API/socket/UI đầy đủ |
| Audio/Video | Signaling sơ bộ; chưa có media/call lifecycle trên client |
| Redis và scaling | Compose chuẩn bị Redis; chưa tích hợp Adapter/cache/presence phân tán |
| Kiểm chứng | 18 test backend + 18 test client đạt; build production đạt; lint sạch |

36 test hiện tại gồm logic, HTTP và các mô phỏng request/adapter. Chưa chạy MongoDB integration, Docker build/up, UI trong trình duyệt, cuộc gọi hoặc benchmark tải trong phiên này. Xem docs/REVIEW_NOTES.md.

## Khởi động bằng Docker

Yêu cầu Node.js từ 22.12, Docker đang chạy và Docker Compose hỗ trợ --wait. Tại thư mục gốc:

```bash
npm run docker:up
```

Script tự tạo .env với hai JWT secret khác nhau nếu file chưa có; sau đó build và chờ các dịch vụ sẵn sàng. Nếu đã có .env, điền đủ hai secret khác nhau, tối thiểu 32 ký tự mỗi secret. Mở http://localhost:3000. APP_PORT/CORS_ORIGIN có thể đổi trong .env.

`npm run docker:down` dừng dịch vụ và giữ named volume. Compose hiện chạy một backend. MongoDB, Redis và server không mở cổng trực tiếp ra host; API, socket và file dùng cùng origin của Nginx.

## Phát triển local

1. Chuẩn bị MongoDB phát triển.
2. Chạy npm --prefix server ci và npm --prefix client ci tại gốc dự án.
3. Sao chép server/.env.example thành server/.env; điền MONGO_URI và hai JWT secret ngẫu nhiên khác nhau.
4. Mở terminal thứ nhất: cd server rồi npm run dev. Backend nghe cổng 5000.
5. Mở terminal thứ hai: cd client rồi npm run dev. Mở http://localhost:3000; Vite proxy /api, /uploads và /socket.io tới backend.

Backend chạy bình thường bằng npm --prefix server start. Lệnh build của server là alias kiểm tra cú pháp, không tạo file biên dịch. Frontend cần Vite build để đóng gói JSX/CSS cho trình duyệt.

## Kiểm tra

```bash
npm run check:server
npm test
npm run build:client
npm --prefix client run lint
```

Khi hệ thống và MongoDB đã chạy: npm run test:smoke. Script cần dependency client đã cài trên máy chạy lệnh, tạo ba tài khoản smoke_* và dữ liệu mẫu; dùng môi trường demo riêng. BASE_URL mặc định http://localhost:3000. Smoke chưa bao phủ upload, nhóm, cuộc gọi hoặc tải.

## Dữ liệu và phiên

- Danh tính người gửi lấy từ JWT; server kiểm tra thành viên và suy ra người nhận.
- Sent nghĩa là đã lưu; seen xác nhận đọc tới lastReadMessageId. Không suy ra delivered từ online.
- REST/socket dùng chung message.service.js; unique index và clientMessageId giúp retry cùng một lần gửi không tạo thêm bản ghi; client gộp theo _id.
- Lịch sử mỗi trang tối đa 100, mặc định 50. Client giữ mốc đồng bộ thành công gần nhất; reconnect tải các trang mới tới mốc đó. Khi mở app mới, tải trang mới nhất rồi dùng nút tải lịch sử cũ.
- Đổi phiên trong tab hủy request và bỏ response cũ, dọn state và socket. Refresh token trong cùng phiên không đổi mốc phiên. Đồng bộ thay đổi tài khoản qua sự kiện storage giữa nhiều tab còn cần triển khai/kiểm thử riêng.
- Logout thu hồi các phiên trên mọi thiết bị bằng tokenVersion. Mật khẩu đăng ký tối đa 72 byte UTF-8 để tránh bcrypt cắt ngắn.
- Upload tối đa 20 MB/file, 5 file/tin; URL tải vẫn công khai. Quyền tải theo hội thoại, chữ ký file và dọn file bỏ dở còn là công việc cần làm.
- Sao lưu database cũ, kiểm tra trùng và tạo index trước khi dùng bản sửa. Không xóa dữ liệu để vượt lỗi index.

Không chia sẻ .env thật, không chép node_modules giữa hệ điều hành. Dùng npm ci theo lockfile trên từng môi trường.

## Tài liệu

- docs/API_DOCUMENTATION.md: contract REST, socket và dữ liệu.
- docs/ARCHITECTURE.md: kiến trúc đang chạy và mục tiêu còn phải làm.
- docs/TEST_PLAN.md: lệnh kiểm tra và kịch bản nghiệm thu.
- docs/TEAM_PLAN.md: trách nhiệm và mốc của hai thành viên.
- docs/REVIEW_NOTES.md: thay đổi lần dọn mã, kết quả thực tế và giới hạn.
- docs/CODEX_VSCODE_PROMPT.md: prompt tiếp tục rà soát trong VS Code.
