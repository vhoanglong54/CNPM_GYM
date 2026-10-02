# Test Cases

| TC | Tình huống | Kết quả |
|---|---|---|
| TC-01 | Đăng ký email trùng | 409 `EMAIL_ALREADY_EXISTS`, không tạo user. |
| TC-02 | OTP sai/hết hạn/lần 6 | `OTP_INVALID`, User vẫn UNVERIFIED. |
| TC-03 | Member gọi dashboard Owner | 403, không trả dữ liệu. |
| TC-04 | Tạo gói giá 0/âm | Validation 400, không ghi DB. |
| TC-05 | Hai Member giữ cùng slot | Một thành công; một `BOOKING_SLOT_TAKEN`/unique conflict. |
| TC-06 | Gói PT hết lượt | Không tạo booking. |
| TC-07 | Membership hết hạn | Không tạo check-in. |
| TC-08 | Gửi cùng idempotency key | Chỉ một Checkin; lần sau 409. |
| TC-09 | Thanh toán một Order nhiều lần | Chỉ một Payment/Receipt/entitlement; lần sau 409. |
| TC-10 | Receipt của Order PENDING | `RECEIPT_NOT_AVAILABLE`. |
| TC-11 | In lại receipt PAID | Cùng receipt; không phát sinh thu. |
| TC-12 | Dashboard sau PAID | Tổng thu tăng đúng payment PAID. |
| TC-13 | Đổi giá catalog | OrderItem cũ giữ nguyên unitPrice. |
| TC-14 | Trainer khác xử lý booking | 403 `FORBIDDEN`. |
| TC-15 | Member đặt lịch kèm ghi chú và chọn gói PT | Booking `PENDING` lưu đúng `note` và `memberPtPackageId`. |
| TC-16 | Trainer đóng slot trống của mình | Slot chuyển `isOpen=false` và biến mất khỏi danh sách khả dụng. |
| TC-17 | Trainer đóng slot đã có booking hoạt động | 409 `SLOT_HAS_ACTIVE_BOOKING`, slot và booking không đổi. |

Đã chạy smoke/integration local cho: health, Owner login, Member login, tạo Order, trả `PAID`, chặn payment lặp, check-in và đối chiếu tổng thu Owner.

