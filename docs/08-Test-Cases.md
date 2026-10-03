# Test Cases

| TC | Tình huống | Kết quả |
|---|---|---|
| TC-01 | Đăng ký email trùng | Nếu User ACTIVE/INACTIVE: 409 `EMAIL_ALREADY_EXISTS`; nếu còn UNVERIFIED: cập nhật đăng ký và cấp/gợi ý gửi lại OTP, không tạo User thứ hai. |
| TC-02 | OTP sai/hết hạn/lần 6 | `OTP_INVALID`, User vẫn UNVERIFIED. |
| TC-03 | Member gọi dashboard Owner | 403, không trả dữ liệu. |
| TC-04 | Tạo gói giá 0/âm | Validation 400, không ghi DB. |
| TC-05 | Hai Member giữ cùng slot | Một thành công; một `BOOKING_SLOT_TAKEN`/unique conflict. |
| TC-06 | Gói PT không còn buổi khả dụng vì các lịch đang giữ | Không tạo booking; `sessionsReserved` không vượt tổng. |
| TC-07 | Membership hết hạn | Không tạo check-in. |
| TC-08 | Gửi cùng idempotency key | Chỉ một Checkin; lần sau 409. |
| TC-09 | Member báo chuyển khoản | Payment `AWAITING_CONFIRMATION`, Order vẫn PENDING, chưa có receipt/quyền lợi. |
| TC-10 | Receipt của Order PENDING | `RECEIPT_NOT_AVAILABLE`. |
| TC-11 | In lại receipt PAID | Cùng receipt; không phát sinh thu. |
| TC-12 | Dashboard sau PAID | Tổng thu tăng đúng payment PAID. |
| TC-13 | Đổi giá catalog | OrderItem cũ giữ nguyên unitPrice. |
| TC-14 | Trainer khác xử lý booking | 403 `FORBIDDEN`. |
| TC-15 | Member đặt lịch kèm ghi chú và chọn gói PT | Booking `PENDING` lưu đúng `note` và `memberPtPackageId`. |
| TC-16 | Trainer đóng slot trống của mình | Slot chuyển `isOpen=false` và biến mất khỏi danh sách khả dụng. |
| TC-17 | Trainer đóng slot đã có booking hoạt động | 409 `SLOT_HAS_ACTIVE_BOOKING`, slot và booking không đổi. |
| TC-18 | Lễ tân xác nhận chuyển khoản | Payment/Order PAID, quyền lợi và một Receipt được tạo; lưu đúng tài khoản xác nhận. |
| TC-19 | Lễ tân từ chối chuyển khoản | Payment REJECTED có lý do; Hội viên được gửi lại yêu cầu. |
| TC-20 | Yêu cầu chuyển khoản quá 48 giờ | EXPIRED, không thể duyệt và không cấp quyền lợi. |
| TC-21 | Hai lịch khác nhau trùng giờ của cùng Hội viên | 409 `MEMBER_BOOKING_OVERLAP`. |
| TC-22 | Đặt/hủy/hoàn thành PT | Reserved tăng khi đặt, giảm khi hủy; COMPLETED tăng used và giảm reserved. |
| TC-23 | Hội viên hủy lịch CONFIRMED dưới 4 giờ | 409 `BOOKING_CANCELLATION_CUTOFF`. |
| TC-24 | PT đánh dấu NO_SHOW sau giờ kết thúc | Trừ một buổi, trạng thái NO_SHOW. |
| TC-25 | Đánh giá trước hoàn thành hoặc đánh giá lần hai | Bị từ chối; chỉ một review 1–5/booking COMPLETED. |
| TC-26 | Check-in quanh 00:00 Việt Nam trên server UTC | Phân ngày theo `Asia/Ho_Chi_Minh`. |
| TC-27 | Hội viên quay lại sau khi đã check-in trong ngày | 409 `CHECKIN_ALREADY_TODAY`; không tạo bản ghi/trừ lượt lần hai, Lễ tân vẫn có thể cho khách qua. |
| TC-28 | Chủ phòng cho Lễ tân/PT nghỉ việc | User chuyển `INACTIVE`, lịch sử được giữ; đăng nhập mới và JWT cũ đều bị từ chối. |
| TC-29 | Hai tab đăng nhập hai tài khoản khác nhau rồi tải lại | Mỗi tab vẫn giữ đúng tài khoản của mình, không lấy phiên từ tab còn lại. |
| TC-30 | Thanh toán hoặc đổi trạng thái lịch khi một request tải dữ liệu cũ đang chạy | Giao diện cập nhật ngay; response cũ không ghi đè kết quả thao tác, tab khác đồng bộ trong chu kỳ kế tiếp. |
| TC-31 | Hội viên hoàn thành buổi PT chưa đánh giá | Hiện nhắc đánh giá và biểu mẫu 1–5 sao; gửi thành công không cần tải lại trang. |

Automated hiện kiểm tra health/controller cơ bản, ranh giới ngày `Asia/Ho_Chi_Minh` và việc JWT cũ bị chặn sau khi tài khoản nghỉ việc; toàn bộ TC nghiệp vụ trên cần được chạy lại với database test hoặc theo `docs/10-UI-Test-Guide.md` sau mỗi migration/deploy.
