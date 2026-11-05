# Kết quả dọn mã và tài liệu

Ngày thực hiện: 30 tháng 10 năm 2026. Đây là bản cải thiện nền tảng JavaScript, chưa hoàn thành toàn bộ đề tài.

## Đã sửa

- Thêm session.js quản lý mốc phiên và AbortController. Request/refresh thuộc phiên cũ không ghi lại token, không xóa phiên mới; đồng thời 401 dùng chung một lần refresh.
- Auth, danh bạ và chat store bỏ qua kết quả cũ sau đổi tài khoản. Kết quả tìm kiếm chỉ áp dụng cho truy vấn gần nhất. Lỗi mạng khi tải profile hoặc refresh không tự xóa token; refresh thành công cập nhật token store và kết nối lại socket nếu cần.
- Reconnect tải các trang lịch sử tới mốc đã đồng bộ thay vì chỉ lấy trang mới nhất. Có xử lý lịch sử trước đó rỗng, giữ cursor cũ, gộp request trùng và đợi request tải trang cũ trước khi đồng bộ trang mới. Khi lỗi giữa chừng không ghi một phần lịch sử.
- Sự kiện tin đến muộn không đẩy preview hội thoại lùi về tin cũ; sự kiện seen không tự tăng unread.
- App dùng key theo hội thoại để reset khung soạn tin khi đổi hội thoại; bỏ setState trong effect và dependency phức tạp. Callback gửi/upload kiểm tra phiên và trạng thái mount. FormData để trình duyệt tự đặt multipart boundary.
- Backend trả 400 cho JSON sai và 413 cho body quá lớn; mật khẩu đăng ký giới hạn 72 byte UTF-8, tránh bcrypt cắt mật khẩu nhiều byte.

## Tài liệu và asset đã dọn

ZIP đầu vào không có file .docx. Đã gộp nội dung hữu ích từ các tài liệu sau vào README, TEST_PLAN, TEAM_PLAN và tài liệu này, rồi loại bản trùng/lỗi thời:

- client/README.md
- docs/CHANGELOG_REVIEW.md
- docs/CHUYEN_DOI_JAVASCRIPT.md
- docs/DO_AN_CUOI_KY_DIEU_CHINH.md
- docs/VERIFICATION.md

Loại hai PNG sơ đồ mục tiêu trong docs/figures; sơ đồ Mermaid trong ARCHITECTURE vẫn được giữ. Loại hero.png, react.svg, vite.svg và icons.svg không được mã nguồn tham chiếu. Giữ favicon được index.html sử dụng và hai model nhóm để nhóm phát triển tiếp.

## Kiểm chứng

- npm ci chạy thành công ở server và client.
- 18 test backend và 18 test client đạt, tổng 36. Test frontend có mô phỏng API/axios adapter; một số test backend dùng stub. Không xem đây là kết quả end-to-end.
- Kiểm tra cú pháp 24 file backend đạt.
- Frontend production build đạt; lint không lỗi/cảnh báo.
- Đã kiểm tra JSON/YAML, import nội bộ và ZIP đóng gói. Không đóng gói node_modules, dist, Git metadata hoặc secret.

## Giới hạn và yêu cầu còn lại

| Tiêu chí | Hiện trạng |
|---|---|
| Chức năng 30 phần trăm | Có nền tảng cá nhân/đa phương tiện; nhóm chưa đầy đủ nên chưa công nhận Cấp 2 |
| Kỹ thuật 20 phần trăm | Có chia module, kiểm tra quyền và chống trùng; WebRTC/Redis Adapter chưa hoàn thành |
| Frontend 20 phần trăm | Build và lint đạt; chưa kiểm thử UX, responsive hoặc độ mượt trong trình duyệt |
| Docker 15 phần trăm | Có cấu hình; chưa chạy Docker build/up trong môi trường rà soát |
| Báo cáo 15 phần trăm | Có tài liệu nguồn; cần báo cáo nộp chính thức và minh chứng chạy/đo thực tế |

Môi trường rà soát không có Docker/MongoDB chạy sẵn; chưa chạy smoke với database, UI, gọi hoặc chịu tải. Chat nhóm, media WebRTC, Redis Adapter/cache/presence phân tán còn thiếu. Upload vẫn công khai và chưa có metadata/quyền tải, kiểm tra chữ ký nội dung, rate limit và dọn file bỏ dở. Đổi tài khoản giữa nhiều tab qua localStorage cần xử lý storage event và kiểm thử riêng.

Tải bù có thể cần nhiều request khi offline lâu; chưa có giới hạn bộ nhớ hoặc virtualized list. Mở lại app chỉ tải trang mới nhất vì mốc đồng bộ hiện ở bộ nhớ tab. Dữ liệu/index cũ và điều kiện đua khi nhiều sender vẫn cần thử trên MongoDB thật. Không có benchmark hoặc điểm số dự đoán.
