# Use Cases

## UC-01 — Đăng ký và xác thực Member

1. Khách nhập họ tên, email, mật khẩu và điện thoại tùy chọn.
2. API kiểm tra email, tạo User `UNVERIFIED`, MemberProfile và OTP hash.
3. SMTP gửi OTP; development được phép dùng mã dự phòng.
4. Khách nhập OTP đúng, còn hạn → User `ACTIVE` → chuyển về đăng nhập.

Ngoại lệ: email trùng (BR-01), OTP sai/hết hạn/đã dùng (BR-03), gửi lại quá sớm.

## UC-02 — Mua gói và mock payment

1. Member chọn sản phẩm đang bán và tạo Order `PENDING`.
2. OrderItem snapshot tên, mô tả và đơn giá.
3. Member chọn **Tôi đã chuyển khoản** → Payment `AWAITING_CONFIRMATION`, Order vẫn `PENDING`, chưa cấp quyền lợi/receipt.
4. Lễ tân/Chủ phòng xác nhận hoặc từ chối kèm lý do. Yêu cầu tự hết hạn sau 48 giờ.
5. Với tiền mặt, Lễ tân/Chủ phòng chọn **Thu tiền mặt** và xác nhận trực tiếp.
6. Chỉ khi được xác nhận, transaction chuyển Payment/Order sang `PAID`, kích hoạt quyền lợi, tạo Receipt và lưu tài khoản xác nhận.
7. Member/nhân viên xem PDF; Owner thấy tổng thu và đối soát cập nhật.

Ngoại lệ: gói ngừng bán, đơn rỗng/hủy, xác nhận lặp, sai vai trò/phương thức.

## UC-03 — Booking PT

1. Trainer mở khung giờ rảnh; có thể đóng lại nếu chưa có booking hoạt động.
2. Member lọc ngày, sắp xếp PT theo lịch sớm/đánh giá, chọn gói còn **buổi khả dụng** và gửi yêu cầu.
3. Transaction tạo booking `PENDING`, giữ một buổi PT và chặn trùng lịch của slot lẫn Hội viên.
4. Trainer chuyển sang `CONFIRMED` hoặc `REJECTED` kèm lý do; từ chối hoàn buổi đang giữ.
5. Sau buổi tập, Trainer chọn `COMPLETED` hoặc `NO_SHOW`; cả hai tiêu thụ một buổi đã giữ theo chính sách.
6. Lịch PENDING hoặc lịch CONFIRMED còn ít nhất 4 giờ được Hội viên hủy ngay; PT hủy trước giờ bắt đầu cũng có hiệu lực ngay. Hệ thống chuyển `CANCELLED`, giải phóng slot, hoàn buổi và báo bên còn lại.
7. Hội viên yêu cầu hủy lịch CONFIRMED dưới 4 giờ làm lịch chuyển `CANCEL_REQUESTED`; slot và buổi vẫn được giữ cho đến khi PT/Owner chấp nhận hoặc từ chối.

Giao diện hiển thị thống kê, bộ lọc và nhãn trạng thái tiếng Việt theo đúng phạm vi của từng vai trò.

## UC-04 — Check-in

Hội viên xuất trình QR → Lễ tân/Chủ phòng quét hoặc nhập mã → API trả các gói Gym đang hiệu lực và gói đề xuất → nhân viên xác nhận gói áp dụng → API kiểm tra lại quyền lợi → tạo Checkin. Cùng Hội viên không được ghi nhận hai lần trong một ngày; khi khách quay lại, thông báo đã check-in là đủ để Lễ tân cho qua và không phát sinh lượt/trừ quyền lợi mới.

## UC-05 — Quản trị nhân sự

Owner tạo Receptionist/Trainer, xem danh sách, cho nghỉ việc hoặc khôi phục tài khoản. Cho nghỉ việc chuyển tài khoản sang `INACTIVE`, chặn cả đăng nhập mới lẫn JWT cũ nhưng giữ nguyên lịch sử giao dịch/lịch PT. Owner không thể tự khóa chính tài khoản đang đăng nhập.

Owner lọc danh sách theo **Còn làm việc/Đã nghỉ việc**, sắp xếp nhân viên đang làm theo điểm hoặc số lượt đánh giá và mở chi tiết phản hồi của Hội viên.

## UC-06 — Dashboard Owner

Owner xem tổng payment PAID, phân loại phương thức, hội viên ACTIVE, quyền lợi Gym hợp lệ, check-in, booking đang mở, đơn PENDING và giao dịch gần nhất. Màn hình **Báo cáo** bổ sung tiền mặt trong ngày, doanh thu theo tài khoản xác nhận, trạng thái PT, điểm PT và audit log.

## UC-07 — Thông báo công việc

Hệ thống tạo thông báo cho đúng người nhận khi có chuyển khoản chờ duyệt/kết quả duyệt, yêu cầu hoặc thay đổi lịch PT, yêu cầu hủy muộn, hoàn thành/vắng mặt và đánh giá nhân viên. Khi mở trung tâm thông báo, hệ thống tạo một nhắc lịch chống trùng cho mỗi booking CONFIRMED bắt đầu trong 24 giờ tới. Người dùng xem tối đa 50 thông báo gần nhất và đánh dấu từng thông báo hoặc tất cả là đã đọc.

## UC-08 — Đánh giá nhân viên

1. Hội viên mở **Đánh giá nhân viên**, tìm/lọc PT hoặc Lễ tân đang làm việc và mở hồ sơ.
2. Giao diện hiển thị điểm trung bình, số lượt và các nhận xét; hồ sơ PT được liên kết trực tiếp từ màn hình chọn lịch.
3. Hội viên gửi 1–5 sao kèm nhận xét. Không yêu cầu từng đặt lịch hoặc tập với nhân viên đó.
4. Nếu đã đánh giá nhân viên này, thao tác lưu sẽ cập nhật bài hiện có thay vì tạo bài trùng.
5. Nhân viên nhận thông báo; Owner xem phản hồi tại màn hình **Nhân sự**.
