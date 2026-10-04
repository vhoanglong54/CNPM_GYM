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
| TC-08 | Gửi lại cùng idempotency key cho cùng Hội viên | Chỉ một Checkin; lần sau trả kết quả cũ với `replayed=true`, không trừ thêm. |
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
| TC-22 | Đặt/hủy/hoàn thành PT với check-in hợp lệ | Reserved tăng khi đặt, giảm khi hủy; COMPLETED tăng used và giảm reserved. |
| TC-23 | Hội viên hủy lịch CONFIRMED dưới 4 giờ | Chuyển `CANCEL_REQUESTED`, tiếp tục giữ slot/buổi và thông báo PT/Owner. Chấp nhận mới chuyển CANCELLED và hoàn buổi; từ chối quay về CONFIRMED. |
| TC-24 | PT đánh dấu NO_SHOW sau giờ kết thúc | Trừ một buổi, trạng thái NO_SHOW. |
| TC-25 | Member đánh giá PT/Lễ tân chưa từng tương tác | Thành công nếu nhân viên ACTIVE; lưu 1–5 sao và comment, cập nhật điểm tổng hợp. |
| TC-26 | Check-in quanh 00:00 Việt Nam trên server UTC | Phân ngày theo `Asia/Ho_Chi_Minh`. |
| TC-27 | Hội viên quay lại sau khi đã check-in trong ngày | HTTP 200, `alreadyCheckedIn=true`, trả thời gian/bản ghi đầu ngày; không tạo bản ghi hoặc trừ lượt lần hai. |
| TC-28 | Chủ phòng cho Lễ tân/PT nghỉ việc | User chuyển `INACTIVE`, lịch sử được giữ; đăng nhập mới và JWT cũ đều bị từ chối. |
| TC-29 | Hai tab đăng nhập hai tài khoản khác nhau rồi tải lại | Mỗi tab vẫn giữ đúng tài khoản của mình, không lấy phiên từ tab còn lại. |
| TC-30 | Thanh toán hoặc đổi trạng thái lịch khi một request tải dữ liệu cũ đang chạy | Giao diện cập nhật ngay; response cũ không ghi đè kết quả thao tác, tab khác đồng bộ trong chu kỳ kế tiếp. |
| TC-31 | Member đánh giá lại cùng nhân viên | Cập nhật bài cũ theo unique Member–Staff, không tạo bài thứ hai. |
| TC-32 | Member đánh giá nhân viên INACTIVE hoặc tài khoản không phải PT/Lễ tân | Bị từ chối `STAFF_NOT_REVIEWABLE`. |
| TC-33 | Owner lọc nhân sự | Lọc đúng Còn làm/Đã nghỉ; sắp xếp theo sao/số bài chỉ áp dụng danh sách đang làm và mở được chi tiết phản hồi. |
| TC-34 | Member bấm tên/sao PT trên lịch trống | Mở đúng hồ sơ PT, tổng điểm và danh sách bài đánh giá; quay lại vẫn có thể chọn lịch. |
| TC-35 | Check-in lần đầu hoặc quét lại khi có lịch PT trong ngày | Cả hai kết quả đều hiển thị đúng giờ, PT và trạng thái; booking không bị thay đổi. |
| TC-36 | Quét lại sau khi lần đầu đã dùng hết lượt cuối của gói Gym | Kiểm tra quyền lợi vẫn nhận ra lượt check-in hôm nay và không báo gói không hợp lệ. |
| TC-37 | Dùng lại idempotency key của Hội viên khác | 409 `CHECKIN_IDEMPOTENCY_CONFLICT`; không tạo Checkin. |
| TC-38 | Lễ tân quét Hội viên có lịch PT hôm nay | Nhắc lịch hiện ngay sau bước tra cứu, trước khi xác nhận check-in; không có lịch thì không hiện khối nhắc. |
| TC-39 | PT hoàn thành lịch khi không có check-in trước giờ bắt đầu | Nút Hoàn thành bị khóa; gọi API trực tiếp bị từ chối `PT_COMPLETION_CHECKIN_REQUIRED`, gói PT không bị trừ. |
| TC-40 | Hội viên check-in sau giờ bắt đầu buổi PT | Check-in không được dùng để hoàn thành booking đó; PT xử lý `NO_SHOW` sau giờ kết thúc. |

Automated hiện kiểm tra health/controller cơ bản, ranh giới ngày `Asia/Ho_Chi_Minh`, check-in mới/quét lại/idempotency/lịch PT, JWT cũ bị chặn sau khi tài khoản nghỉ việc, yêu cầu hủy muộn và đánh giá nhân viên; các TC còn lại cần được chạy lại với database test hoặc theo `docs/10-UI-Test-Guide.md` sau mỗi migration/deploy.
