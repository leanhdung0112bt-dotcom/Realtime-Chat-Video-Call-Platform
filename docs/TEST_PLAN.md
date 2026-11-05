# Kế hoạch kiểm thử và minh chứng

## Kiểm tra tự động hiện tại

Sau khi cài dependency, chạy tại thư mục gốc:

```bash
npm run check:server
npm test
npm run build:client
npm --prefix client run lint
```

| Kiểm tra | Kết quả lần rà soát này | Phạm vi |
|---|---|---|
| Backend | 18 đạt | Logic/HTTP, validation UTF-8; một số truy vấn được stub |
| Client | 18 đạt | Gộp tin, phiên cũ, refresh token đồng thời, tìm kiếm, reconnect và phân trang; API/adapter được mô phỏng |
| Cú pháp backend | 24 file đạt | Node --check |
| Frontend build | Đạt | Vite production bundle |
| Frontend lint | Đạt, không cảnh báo | Không thay thế kiểm thử tương tác trình duyệt |
| Docker, MongoDB, UI, gọi và tải | Chưa nghiệm thu | Cần chạy trên môi trường thật |

## Chức năng và phân quyền cần nghiệm thu

| ID | Kịch bản | Kết quả yêu cầu |
|---|---|---|
| T01 | Đăng ký, đăng nhập, sai mật khẩu, thiếu JWT | Contract đúng; sai thông tin không vào được API riêng tư |
| T02 | Access token hết hạn; refresh; logout | Làm mới phiên; logout thu hồi cả access/refresh theo chính sách hiện tại |
| T03 | Gửi, nhận, chấp nhận, từ chối, hủy lời mời và hủy kết bạn | UI và backend cùng trạng thái; user thứ ba không xử lý lời mời của người khác |
| T04 | Hai client gửi tin; reload | Nhận realtime, nội dung vẫn có trong MongoDB |
| T05 | Cùng clientMessageId gửi qua socket rồi REST | Một bản ghi; UI không nhân đôi hoặc tăng unread nhiều lần |
| T06 | Giả conversationId, recipientId, join room, typing và seen | 400/403 hoặc ACK lỗi; không đọc hay thay đổi dữ liệu người khác |
| T07 | Gửi hơn 50 tin, lấy limit 2, lùi cursor | Lấy trang mới nhất, thứ tự ổn định và không bỏ mất lịch sử |
| T08 | Đọc hội thoại, chuyển tab, ẩn cửa sổ, có tin mới đồng thời | Chỉ cập nhật mốc đọc hợp lệ; không đánh dấu nhầm tin chưa xem |
| T09 | Mở hai tab cùng tài khoản rồi đóng một tab | Tài khoản còn online khi tab còn lại vẫn kết nối |
| T10 | Mất mạng, hơn 100 tin tới trong lúc offline, reconnect | Tải bù tới mốc đồng bộ trước, đối chiếu ID không thiếu/trùng; logic đã có test mô phỏng, còn phải thử mạng và MongoDB thật |
| T11 | Upload ảnh/file, ảnh preview, quá 20 MB, sai MIME, tải bằng tài khoản ngoài nhóm | Tải hợp lệ; từ chối sai loại/quá dung lượng; quyền tải file cần được bổ sung trước khi đạt |
| T12 | Nhóm: tạo, thêm/xóa, rời, chuyển quyền/giải tán | Đúng vai trò; người bị xóa mất quyền gửi/đọc/nhận mới |
| T13 | Gọi: nhận/từ chối/bận/timeout/mute/camera/end/từ chối quyền thiết bị | UI và hai peer cùng trạng thái; dọn media tracks |
| T14 | Gọi khác mạng, ép TURN relay | Kết nối thực tế, thống kê WebRTC xác nhận relay trong phép thử |
| T15 | Hai backend, Redis Adapter và cache | Chat xuyên backend; cache invalidation đúng; presence không phụ thuộc một process |
| T16 | Dừng backend, Redis, MongoDB lần lượt | Ghi nhận hành vi thực; không khẳng định không mất sự kiện khi Pub/Sub bị ngắt |
| T17 | Đăng xuất rồi đăng nhập tài khoản khác khi request cũ đang chạy | Không hiện dữ liệu của phiên trước; cần hủy/bỏ qua response lỗi thời |
| T18 | Máy mới chạy lệnh khởi động | Build được, healthcheck đạt, volume giữ dữ liệu, không phụ thuộc node_modules Windows |

## Smoke test có sẵn

Sau khi chạy ứng dụng và cài dependency hai phía: `npm run test:smoke`. Script tạo ba tài khoản demo để kiểm tra auth, quan hệ, socket gửi/nhận, chặn user thứ ba, idempotency, lịch sử và logout. Script này chưa được chạy với database trong phiên rà soát. Không thay thế các ca UI, upload, nhóm, gọi điện và tải.

## Workload đo tải đề xuất

Tăng dần 100, 500, 1000 kết nối; 20 phần trăm client gửi một tin mỗi 5 giây; nội dung khoảng 1 KB. Ở 1000 kết nối, đầu vào xấp xỉ 40 tin/giây, chưa tính số lượt fan-out của chat nhóm. Chạy kịch bản direct và nhóm riêng; quy định kích thước nhóm trước khi so sánh. Mỗi mức giữ 10 phút sau warm-up; lặp ba lần khi tài nguyên cho phép.

So sánh một backend với hai backend dưới cùng workload. Ghi rõ CPU/RAM và giới hạn tài nguyên mỗi container, máy tạo tải, độ lớn database, mạng, phiên bản phần mềm và tổng tài nguyên. Máy tạo tải nên tách khỏi máy chạy ứng dụng nếu có điều kiện.

| Cấu hình | Kết nối duy trì | Tin gửi mỗi giây | ACK p95 ms | Nhận tại peer p95 ms | Tỷ lệ lỗi | CPU và RAM | Thiếu/trùng ID sau đồng bộ |
|---|---|---|---|---|---|---|---|
| Một backend | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo |
| Hai backend | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo | Chưa đo |

ACK đo từ lúc client gửi tới khi server xác nhận lưu. Độ trễ tới peer đo riêng; dùng cùng bộ tạo tải hoặc đồng bộ đồng hồ và ghi sai số. Báo p50, p95, p99, số kết nối thành công, throughput, timeout, reconnect, CPU/RAM và độ đầy đủ dữ liệu. Đặt ngưỡng nghiệm thu sau phép đo thử trên máy thực; không điền kết quả giả.

## Minh chứng để nộp

Lưu log có instance, socketId, conversationId và messageId; không log JWT hoặc nội dung riêng tư. Ảnh hai backend phải cho thấy client thực sự kết nối khác node và cùng tin được chuyển đi/nhận. Lưu script, cấu hình máy, dữ liệu tổng hợp và biểu đồ; phân tích nguyên nhân nếu thêm backend không làm nhanh hơn. Backend nhân bản chưa tạo ra HA cho Redis/MongoDB/Nginx.
