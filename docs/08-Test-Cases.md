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
| TC-09 | Member xác nhận chuyển khoản hoặc đã trả tiền mặt | Payment `AWAITING_CONFIRMATION`, Order vẫn PENDING, chưa có receipt/quyền lợi. |
| TC-10 | Receipt của Order PENDING | `RECEIPT_NOT_AVAILABLE`. |
| TC-11 | In lại receipt PAID | Cùng receipt; không phát sinh thu. |
| TC-12 | Dashboard sau PAID | Tổng thu tăng đúng payment PAID. |
| TC-13 | Đổi giá catalog | OrderItem cũ giữ nguyên unitPrice. |
| TC-14 | Trainer khác xử lý booking | 403 `FORBIDDEN`. |
| TC-15 | Member đặt lịch kèm ghi chú và chọn gói PT | Booking `PENDING` lưu đúng `note` và `memberPtPackageId`. |
| TC-16 | Trainer đóng slot trống của mình | Slot chuyển `isOpen=false` và biến mất khỏi danh sách khả dụng. |
| TC-17 | Trainer đóng slot đã có booking hoạt động | 409 `SLOT_HAS_ACTIVE_BOOKING`, slot và booking không đổi. |
| TC-18 | Lễ tân xác nhận yêu cầu thanh toán | Payment/Order PAID, quyền lợi và một Receipt được tạo; lưu đúng phương thức và tài khoản xác nhận. |
| TC-19 | Lễ tân từ chối yêu cầu thanh toán | Payment REJECTED có lý do; Hội viên được gửi lại yêu cầu. |
| TC-20 | Yêu cầu thanh toán quá 48 giờ | EXPIRED, không thể duyệt và không cấp quyền lợi. |
| TC-20A | Nhân viên gọi thanh toán tiền mặt cho đơn chưa được Hội viên xác nhận | 403 `PAYMENT_MEMBER_CONFIRMATION_REQUIRED`; Order vẫn PENDING, không tạo Payment/Receipt/quyền lợi. |
| TC-21 | Hai lịch khác nhau trùng giờ của cùng Hội viên | 409 `MEMBER_BOOKING_OVERLAP`. |
| TC-22 | Đặt/hủy/hoàn thành PT với điểm danh hợp lệ | Reserved tăng khi đặt, giảm khi hủy; ngay khi hết giờ chuyển AWAITING_COMPLETION; PT xác nhận thì COMPLETED tăng used và giảm reserved. |
| TC-23 | Hội viên hủy lịch CONFIRMED dưới 4 giờ | Chuyển `CANCEL_REQUESTED`, tiếp tục giữ slot/buổi và thông báo PT/Owner. Chấp nhận mới chuyển CANCELLED và hoàn buổi; từ chối quay về CONFIRMED. |
| TC-24 | Hết giờ + 5 phút mà không có điểm danh PT | Hệ thống tự chuyển NO_SHOW, giảm reserved, tăng used và thông báo Hội viên/PT. |
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
| TC-39 | Có điểm danh trước hoặc đúng giờ kết thúc | Ngay khi hết giờ chuyển AWAITING_COMPLETION; PT thấy nút Hoàn thành và xác nhận đúng một lần. |
| TC-39A | Điểm danh trong 5 phút đệm sau giờ kết thúc | Chuyển ngay AWAITING_COMPLETION; PT có thể xác nhận hoàn thành mà không phải chờ hết thời gian đệm. |
| TC-40 | Không có điểm danh khi hết 5 phút đệm | Tự động NO_SHOW và trừ đúng một buổi; không có nút hay API ngoại lệ để đổi thành COMPLETED. |
| TC-41 | Hội viên đã check-in Gym từ trước rồi quét lại trong cửa sổ PT | Không tạo/trừ thêm lượt Gym nhưng booking được lưu `attendanceCheckedInAt`. |

Automated hiện kiểm tra health/controller cơ bản, ranh giới ngày `Asia/Ho_Chi_Minh`, check-in mới/quét lại/idempotency/điểm danh PT, tự đối soát hoàn thành-vắng mặt, JWT cũ bị chặn sau khi tài khoản nghỉ việc, yêu cầu hủy muộn và đánh giá nhân viên; các TC còn lại cần được chạy lại với database test hoặc theo `docs/10-UI-Test-Guide.md` sau mỗi migration/deploy.
