# Phân công phần còn lại cho hai thành viên

A là người đã làm nền tảng; B nhận module bổ sung. Chốt hạn từng mốc trên GitLab trước khi bắt đầu. Mỗi người tự viết, test, sửa lỗi, demo và viết phần báo cáo của mình.

| Mốc | Chủ việc | Việc cần làm | Điều kiện bàn giao |
|---|---|---|---|
| Nền tảng | Cả hai | Chạy bản JavaScript trên hai máy, kiểm tra auth, danh bạ, chat cá nhân và file | Test/build đạt; có kết quả smoke với MongoDB và ghi lỗi còn lại |
| Nhóm backend | B | group.controller.js và group.service.js; cập nhật Group/GroupMember/Conversation/Message, kiểm tra quyền, message service, API và socket | Tạo/thêm/xóa/rời/chuyển quyền/giải tán đúng vai trò; người ngoài bị chặn |
| Nhóm frontend | B | CreateGroupModal.jsx, GroupMembersModal.jsx, useGroupStore.js; cập nhật Sidebar, ChatArea và chat store | Demo 3 tài khoản: chat/file, reload, thêm/xóa; người bị xóa mất quyền nhận/gửi mới |
| Cuộc gọi 1–1 | B | useWebRTC.js, IncomingCallModal.jsx, CallPanel.jsx, call.service.js; nối socket, callId và trạng thái | Hai thiết bị khác mạng gọi được; mic/camera/end, timeout và từ chối đúng; dọn media tracks |
| Redis và presence | A | redis.js, cache.service.js, presence.service.js; Adapter pub/sub, TTL/invalidation và heartbeat | Hai người ở hai backend vẫn chat được, nhiều tab online đúng, cache không cũ |
| Triển khai | A | Docker/Nginx nhiều backend, HTTPS và môi trường TURN | Máy mới chạy bằng một lệnh; cấp cấu hình ICE để B thử cuộc gọi |
| File và độ tin cậy | A phối hợp B | Quyền tải file, metadata/chữ ký file; kiểm tra session, multi-tab và mạng lỗi | Không lộ file cho người ngoài; không hiện dữ liệu tài khoản cũ; không thiếu/trùng tin sau đồng bộ |
| Đo tải | A | Socket.IO workload, ACK/peer latency, lỗi và CPU/RAM | So sánh một/hai backend bằng số đo thật, lưu script và cấu hình máy |
| Báo cáo | Cả hai | A viết hệ thống/Redis/Docker/hiệu năng; B viết nhóm/UI/WebRTC | Hình, log và mô tả khớp code; ghi đóng góp thực tế |

B làm nhóm backend và frontend trước, nghiệm thu xong mới chuyển sang WebRTC. A làm Redis trên nhánh riêng. Chốt schema, envelope API và payload socket trước khi ghép. Các file dễ trùng: socket.js, message.service.js, app.js, App.jsx, package.json và lockfile; review từng mốc trước khi merge.

Nguồn quyền nhóm đề xuất là GroupMember; Conversation liên kết groupId; tin nhóm không có một recipient cố định; mốc đọc theo từng thành viên. Chỉ trưởng nhóm quản trị thành viên và giải tán; chuyển quyền trước khi rời. Đây là thiết kế cần triển khai, chưa phải chức năng đã có.

Mỗi mốc bàn giao gồm merge request, lệnh chạy/test, log kết quả, video demo và lỗi còn mở. Theo thang điểm cần Cấp 2 ổn định và WebRTC hoặc Scaling cho phần kỹ thuật; phạm vi đầy đủ của đề gồm cả gọi và scaling. RabbitMQ/Kafka là tùy chọn.
