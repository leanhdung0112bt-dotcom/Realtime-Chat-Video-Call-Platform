# Prompt cho Codex trong VS Code

Mở thư mục gốc dự án trong VS Code, rồi gửi nội dung dưới đây cho Codex. Nếu nhóm đã có code mới, Codex phải đọc code mới và giữ các thay đổi đó.

```text
Bạn là kỹ sư full stack phụ trách rà soát và cải thiện dự án đang mở.

Bối cảnh:
- Đây là đồ án nhóm hai người: React/Vite/Zustand, Express/Socket.IO, MongoDB, Docker/Nginx; JavaScript ESM.
- Backend, service, store, script dùng .js; giao diện React dùng .jsx. Không chuyển sang TypeScript hoặc thay stack.
- Bản nền tảng đã có auth JWT, danh bạ, chat cá nhân, upload, typing/presence một backend, cursor, khóa chống trùng và mốc phiên client.
- Chat nhóm mới có model; WebRTC mới có signaling; Redis trong Compose chưa tích hợp. Đọc lại code vì thành viên khác có thể đã triển khai thêm.

Hãy thực hiện công việc, không dừng ở việc đưa lời khuyên:

1. Đọc AGENTS.md nếu có, README và docs/API_DOCUMENTATION.md, ARCHITECTURE.md, TEST_PLAN.md, TEAM_PLAN.md, REVIEW_NOTES.md. Kiểm tra git status, nhận diện thay đổi chưa commit và code của thành viên khác. Không ghi đè hoặc reset công việc đó.

2. Chạy baseline thực tế:
   npm --prefix server ci
   npm --prefix client ci
   npm run check:server
   npm test
   npm run build:client
   npm --prefix client run lint
   Ghi kết quả thật. Dependency có binary theo hệ điều hành phải cài bằng npm ci, không chép node_modules từ máy khác.

3. Ưu tiên chất lượng các chức năng hiện có:
   a. Kiểm tra rotateSession, hủy request, response cũ, refresh đồng thời, logout/login nhanh và callback socket. Bổ sung đồng bộ thay đổi tài khoản/token qua storage event giữa nhiều tab; không để dữ liệu tài khoản A xuất hiện dưới tài khoản B.
   b. Nghiệm thu lịch sử với MongoDB thật: hơn 150 tin khi offline, ban đầu rỗng, tải tin cũ đồng thời reconnect, lỗi giữa chừng, gửi lại cùng clientMessageId, thứ tự khi trùng thời gian và seen. Không sửa cursor theo cách bỏ mất trang đã tải.
   c. Hoàn thiện quyền file: thiết kế metadata uploader/conversation và đường tải có xác thực, kiểm tra thành viên, chữ ký nội dung, giới hạn dung lượng và dọn file bỏ dở. Giữ preview/tải ảnh hoạt động sau khi bỏ public URL; có kế hoạch cho file cũ, không xóa dữ liệu tùy tiện.
   d. Bổ sung rate limit phù hợp cho auth/upload/chat. Nêu rõ giới hạn của cách lưu trong một process nếu chưa có Redis.
   e. Kiểm tra giao diện trong trình duyệt ở desktop/mobile: chọn hội thoại, đổi tab, draft khi gửi lỗi, preview/progress, trạng thái mất mạng, tài khoản đổi nhanh và cuộn lịch sử. Sửa lỗi thao tác thực; giữ giao diện hiện tại nếu không cần đổi.

4. Viết test cho lỗi có tác động thực tế, đặc biệt các ca phiên, quyền và đồng bộ. Phân biệt test dùng mock/stub với integration thật. Không thêm test chỉ kiểm tra một file hoặc tên hàm tồn tại. Test database dùng môi trường demo riêng và có hướng dẫn chạy rõ ràng.

5. Kiểm tra Docker khi máy hỗ trợ: docker compose config, npm run docker:up, readiness, proxy API/socket, volume và npm run test:smoke. Chạy smoke trên môi trường demo vì có tạo dữ liệu. Nếu thiếu Docker/MongoDB/browser hoặc bị chặn, hoàn thành phần độc lập rồi ghi chính xác phần chưa chạy; không ghi đạt thay cho kết quả chưa xác minh.

6. Dọn tài liệu trùng/lỗi thời sau khi chuyển nội dung hữu ích. Giữ README, contract API, kiến trúc, kế hoạch test, phân công và ghi chú kiểm chứng. Chỉ xóa asset sau khi tìm toàn bộ tham chiếu, sửa link hỏng. Giữ báo cáo nộp và tài liệu có giá trị riêng nếu có; không xóa theo đuôi file. Không đóng gói node_modules, dist, .git hoặc .env thật.

7. Giữ phạm vi lần làm này ở việc ổn định nền tảng hiện có. Phần chat nhóm và WebRTC do thành viên B nhận, Redis/scaling do A nhận theo TEAM_PLAN; nếu đã có các module đó thì kiểm thử hồi quy và phối hợp, không tạo bản trùng. Không tự đánh dấu đạt Level 2/3/4 chỉ vì có model, nút gọi hoặc container Redis.

8. Sau mỗi nhóm sửa có ý nghĩa, chạy kiểm tra phù hợp. Kết thúc với bản code đã sửa, tài liệu khớp code và báo cáo ngắn gồm: lỗi tìm thấy; file đã đổi và lý do; lệnh/kết quả đã chạy; phần chưa kiểm chứng; các rủi ro còn lại. Không bịa điểm số, ảnh chạy hoặc kết quả chịu tải. Không tự push hoặc deploy khi chưa được yêu cầu.
```
