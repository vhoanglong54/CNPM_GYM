# Business Rules

| ID | Quy tắc triển khai | Error code chính |
|---|---|---|
| BR-01 | Email chuẩn hóa lowercase và duy nhất. Nếu tài khoản còn `UNVERIFIED`, đăng ký lại sẽ cập nhật thông tin và cấp OTP mới thay vì báo trùng. | `EMAIL_ALREADY_EXISTS` |
| BR-02 | UNVERIFIED/INACTIVE không đăng nhập. | `EMAIL_NOT_VERIFIED`, `ACCOUNT_INACTIVE` |
| BR-03 | OTP phải đúng, chưa dùng, còn hạn, dưới 5 lần thử. | `OTP_INVALID` |
| BR-04–05 | Guard role + kiểm tra ownership ở service. | `FORBIDDEN` |
| BR-06–07 | Giá > 0, thời hạn/lượt > 0; chỉ mua sản phẩm active. | `PRODUCT_UNAVAILABLE` |
| BR-08 | Quyền lợi chỉ sinh trong transaction PAID. | `ORDER_NOT_PAYABLE` |
| BR-09–10 | Gói Gym phải trong hạn, không paused; check-in ghi rõ gói áp dụng và không lặp trong ngày. | `MEMBERSHIP_INELIGIBLE`, `CHECKIN_ALREADY_TODAY` |
| BR-11 | `checkins.idempotency_key` UNIQUE. | `CHECKIN_DUPLICATE` |
| BR-12–14 | Slot tương lai, mở, không bị giữ; gói PT còn lượt. Trainer/Owner chỉ đóng slot khi chưa có booking hoạt động. | `BOOKING_SLOT_*`, `PT_SESSIONS_EXHAUSTED`, `SLOT_HAS_ACTIVE_BOOKING` |
| BR-15–16 | Chỉ PT sở hữu slot xử lý; trạng thái đi đúng chuỗi. | `BOOKING_STATE_INVALID` |
| BR-17–20 | Chỉ đơn PENDING hợp lệ được trả; PAID không xử lý lại; receipt cần payment PAID. | `ORDER_ALREADY_PAID`, `RECEIPT_NOT_AVAILABLE` |
| BR-21 | OrderItem giữ giá/tên tại thời điểm mua. | Bảo đảm bởi schema/service |
| BR-22 | Báo cáo tổng thu chỉ lấy Payment `PAID`. | Bảo đảm bởi query |
| BR-23 | Owner chỉ được xóa cứng hội viên chưa có giao dịch/lịch sử sử dụng; tài khoản đã có lịch sử phải chuyển sang `INACTIVE`. | `MEMBER_HAS_HISTORY` |
| BR-24 | Payment, booking, completion, check-in dùng DB transaction. | Rollback toàn bộ |

