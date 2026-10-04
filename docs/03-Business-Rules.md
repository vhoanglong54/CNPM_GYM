# Business Rules

| ID | Quy tắc triển khai | Error code chính |
|---|---|---|
| BR-01 | Email chuẩn hóa lowercase và duy nhất. Nếu tài khoản còn `UNVERIFIED`, đăng ký lại sẽ cập nhật thông tin và cấp OTP mới thay vì báo trùng. | `EMAIL_ALREADY_EXISTS` |
| BR-02 | UNVERIFIED/INACTIVE không đăng nhập. | `EMAIL_NOT_VERIFIED`, `ACCOUNT_INACTIVE` |
| BR-03 | OTP phải đúng, chưa dùng, còn hạn, dưới 5 lần thử. | `OTP_INVALID` |
| BR-04–05 | Guard role + kiểm tra ownership ở service. | `FORBIDDEN` |
| BR-06–07 | Giá > 0, thời hạn/lượt > 0; chỉ mua sản phẩm active. | `PRODUCT_UNAVAILABLE` |
| BR-08 | Member chuyển khoản chỉ tạo yêu cầu chờ xác nhận 48 giờ; quyền lợi/receipt chỉ sinh trong transaction PAID sau khi nhân viên duyệt. | `PAYMENT_ALREADY_AWAITING`, `PAYMENT_REQUEST_EXPIRED` |
| BR-09–10 | Gói Gym phải trong hạn, không paused; check-in ghi rõ gói áp dụng và không lặp trong ngày. | `MEMBERSHIP_INELIGIBLE`, `CHECKIN_ALREADY_TODAY` |
| BR-11 | `checkins.idempotency_key` UNIQUE. | `CHECKIN_DUPLICATE` |
| BR-12–14 | Slot tương lai, mở, không bị giữ; Hội viên không trùng lịch; gói PT còn `total-used-reserved`. Trainer/Owner chỉ đóng slot chưa có booking hoạt động. | `BOOKING_SLOT_*`, `MEMBER_BOOKING_OVERLAP`, `PT_SESSIONS_EXHAUSTED` |
| BR-15–16 | Chỉ PT sở hữu/Owner xử lý; từ chối/hủy hoàn lượt giữ, hoàn thành/vắng mặt tiêu thụ lượt giữ. | `BOOKING_STATE_INVALID`, `PT_RESERVATION_INCONSISTENT` |
| BR-17–20 | Chỉ đơn PENDING hợp lệ được xử lý; PAID không xử lý lại; receipt cần Payment PAID và tài khoản xác nhận. | `ORDER_ALREADY_PAID`, `RECEIPT_CONFIRMATION_MISSING` |
| BR-21 | OrderItem giữ giá/tên tại thời điểm mua. | Bảo đảm bởi schema/service |
| BR-22 | Báo cáo tổng thu chỉ lấy Payment `PAID`. | Bảo đảm bởi query |
| BR-23 | Owner chỉ được xóa cứng hội viên chưa có giao dịch/lịch sử sử dụng; tài khoản đã có lịch sử phải chuyển sang `INACTIVE`. | `MEMBER_HAS_HISTORY` |
| BR-24 | Payment, booking, completion, check-in dùng DB transaction. | Rollback toàn bộ |
| BR-25 | Hội viên hủy CONFIRMED trước ít nhất 4 giờ được hủy ngay; dưới 4 giờ chuyển `CANCEL_REQUESTED`, tiếp tục giữ lượt/slot và chờ PT hoặc Owner duyệt. PT hủy trước giờ bắt đầu có hiệu lực ngay. | `BOOKING_CANCELLATION_APPROVAL_REQUIRED`, `BOOKING_REASON_REQUIRED` |
| BR-26 | Mỗi Member được đánh giá một lần cho mỗi Receptionist/Trainer ACTIVE bằng 1–5 sao và nhận xét 3–1000 ký tự; lưu lần sau cập nhật bài cũ, không yêu cầu booking. | `STAFF_NOT_REVIEWABLE`, `MEMBER_PROFILE_REQUIRED` |
| BR-27 | Chọn gói chỉ mở bước xác nhận; mỗi lần xác nhận mua dùng một khóa idempotency để bấm kép hoặc request gửi lại không tạo đơn trùng. Hủy lặp một đơn đã hủy được xem là thành công. | `ORDER_IDEMPOTENCY_CONFLICT` |
| BR-28 | Check-in theo ngày và mọi thời gian hiển thị dùng `Asia/Ho_Chi_Minh`. | Bảo đảm bởi date-time helper |
