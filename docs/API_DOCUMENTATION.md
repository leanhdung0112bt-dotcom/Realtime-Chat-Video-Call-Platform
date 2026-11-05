# Hợp đồng API và Socket.IO hiện tại

Tất cả đường dẫn REST có tiền tố `/api`. API bảo vệ dùng `Authorization: Bearer <accessToken>`. Thành công trả `{success:true,data:...}`, lỗi trả `{success:false,message:...}`. Không nhận danh tính người gửi từ body.

## Authentication

| Method | Đường dẫn | Đầu vào | Data trả về |
|---|---|---|---|
| POST | /auth/register | username, email, password, avatar? | user, accessToken, refreshToken |
| POST | /auth/login | identifier, password | user, accessToken, refreshToken |
| POST | /auth/refresh-token | refreshToken | accessToken, refreshToken |
| GET | /auth/me | JWT | user |
| PUT | /auth/profile | username?, bio?, avatar? | user |
| POST | /auth/logout | JWT | Thu hồi các phiên của tài khoản |

Mật khẩu đăng ký tối đa 72 byte UTF-8. JSON sai cú pháp trả 400, request vượt giới hạn body trả 413.

Access token có hạn 15 phút; refresh token 7 ngày. User JSON không trả password hoặc tokenVersion. Bản hiện tại dùng tokenVersion để thu hồi toàn bộ phiên, chưa quản lý phiên riêng từng thiết bị.

## Bạn bè

| Method | Đường dẫn | Ý nghĩa |
|---|---|---|
| GET | /friends/search?query=... | Tìm tối đa 20 user; ký tự regex được escape |
| POST | /friends/request | Body recipientId; lời mời chéo được chấp nhận |
| GET | /friends/requests | data.received và data.sent |
| PUT | /friends/request/:requestId/accept | Chỉ người nhận lời mời đang pending |
| DELETE | /friends/request/:requestId/decline | Người gửi hủy hoặc người nhận từ chối |
| GET | /friends/all | Array `{friendshipId,user,since}` |
| DELETE | /friends/:friendId | Hủy quan hệ bạn bè; giữ lịch sử hội thoại |

Chỉ tạo hội thoại cá nhân mới giữa bạn bè. Hội thoại đã tồn tại vẫn có thể đọc/gửi theo quyền thành viên sau khi hủy kết bạn; chức năng chặn người dùng chưa triển khai.

## Hội thoại và tin nhắn

| Method | Đường dẫn | Ý nghĩa |
|---|---|---|
| GET | /messages/conversations | Hội thoại cá nhân; `{_id,type,friend,lastMessage,unreadCount,updatedAt}` |
| GET | /messages/conversation/:friendId | Lấy hoặc tạo hội thoại với bạn bè |
| GET | /messages/:conversationId?limit=50&before=... | data là array tăng dần; pagination có nextCursor, hasMore |
| POST | /messages/send | Dùng chung logic lưu tin với Socket.IO |
| PUT | /messages/:conversationId/seen | Body `{lastReadMessageId}`; chỉ đánh dấu tới mốc này |

Payload gửi tin: `{conversationId,recipientId?,clientMessageId,text?,attachments?}`. Client phải giữ cùng clientMessageId khi thử lại cùng một lần gửi. Backend hỗ trợ tạo ID nếu client cũ không gửi, nhưng khi đó không có khóa để gộp các lần retry độc lập. Tối đa 4000 ký tự, 5 file. Recipient được suy ra từ participants; recipientId sai bị từ chối.

Attachment: `{url,fileType,fileName,fileSize?}`. URL hiện tại có dạng `/uploads/<filename>` và phải được chuẩn hóa từ kết quả upload. Các URL công khai chưa thay thế kiểm soát quyền sở hữu file.

## Upload

POST `/upload`, JWT, `multipart/form-data` với field `file`, giới hạn 20 MB. Data: `{url,filename,originalName,mimetype,size}`. Frontend chuyển `mimetype/originalName/size` sang `fileType/fileName/fileSize` khi gửi tin. URL tương đối giúp dùng cùng origin qua Nginx và Vite.

## Socket

Handshake dùng `auth.token`. Khi reconnect, client đọc token hiện hành. Token hết hạn thì server phát `auth:expired` và đóng kết nối; client làm mới phiên rồi kết nối lại.

| Client gửi | Payload | Phản hồi |
|---|---|---|
| conversation:join | ID hội thoại | ACK sau khi kiểm tra thành viên |
| conversation:leave | ID hội thoại | ACK |
| message:send | Payload gửi tin | `{success:true,message}` sau khi lưu; lỗi `{success:false,error}` |
| message:seen | conversationId, lastReadMessageId | ACK và sự kiện seen_ack cho các thành viên |
| typing:start / typing:stop | conversationId | typing:status tới người nhận được suy ra từ hội thoại |

| Server phát | Payload |
|---|---|
| message:received | Message đã lưu, sender/recipient được populate |
| message:seen_ack | conversationId, seenBy, seenAt, messageIds |
| typing:status | conversationId, userId, username, isTyping |
| user:presence | userId, isOnline, lastSeen |
| friend:request_received | Lời mời có requester/recipient |
| friend:request_accepted | conversationId |
| friend:changed | Yêu cầu làm mới danh bạ/lời mời |
| operation:error | message |

Các event `call:*` chỉ là signaling sơ bộ cho bạn bè. Chưa có callId, máy trạng thái cuộc gọi, xử lý nhiều thiết bị hoặc media client; chưa nghiệm thu Level 3.
