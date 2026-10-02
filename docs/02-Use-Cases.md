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
3. Member chọn `TRANSFER_DEMO`, hoặc nhân viên chọn `CASH` tại quầy.
4. Transaction tạo Payment/Receipt, chuyển Order sang `PAID`, kích hoạt đúng quyền lợi.
5. Member/nhân viên xem PDF; Owner thấy tổng thu cập nhật.

Ngoại lệ: gói ngừng bán, đơn rỗng/hủy, xác nhận lặp, sai vai trò/phương thức.

## UC-03 — Booking PT

1. Trainer mở khung giờ rảnh; có thể đóng lại nếu chưa có booking hoạt động.
2. Member chọn khung giờ, chọn một gói PT còn lượt và gửi lời nhắn tùy chọn cho Trainer.
3. Booking ở trạng thái `PENDING`; Trainer xem lời nhắn và chuyển sang `CONFIRMED` hoặc hủy.
4. Sau buổi tập, Trainer chuyển booking sang `COMPLETED`; hệ thống trừ đúng một buổi trong transaction.
5. Member hoặc Trainer có thể hủy trước giờ bắt đầu; booking chuyển `CANCELLED`, giải phóng slot và không trừ lượt.

Giao diện hiển thị thống kê, bộ lọc và nhãn trạng thái tiếng Việt theo đúng phạm vi của từng vai trò.

## UC-04 — Check-in

Hội viên xuất trình QR → Lễ tân/Chủ phòng quét hoặc nhập mã → API trả các gói Gym đang hiệu lực và gói đề xuất → nhân viên xác nhận gói áp dụng → API kiểm tra lại quyền lợi → tạo Checkin. Cùng hội viên không được ghi nhận hai lần trong một ngày.

## UC-05 — Quản trị nhân sự

Owner tạo Receptionist/Trainer, xem danh sách và khóa/mở tài khoản. Owner không thể tự khóa chính tài khoản đang đăng nhập.

## UC-06 — Dashboard Owner

Owner xem tổng payment PAID, phân loại phương thức, hội viên ACTIVE, quyền lợi Gym hợp lệ, check-in, booking đang mở, đơn PENDING và giao dịch gần nhất.

