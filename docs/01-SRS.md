# Software Requirements Specification — Titan Gym

## 1. Phạm vi

Hệ thống phục vụ một cơ sở Gym độc lập dưới dạng Web responsive. MVP gồm M01–M08: xác thực/RBAC, hội viên, gói Gym/PT, Trainer, booking, mock billing/payment, receipt PDF, check-in và dashboard báo cáo.

Ngoài phạm vi: thanh toán thật, hóa đơn điện tử, kế toán thuế, đa chi nhánh, app native, IoT cổng vào, lớp tập nhóm và hoa hồng PT.

## 2. Tác nhân

- **Owner:** toàn quyền vận hành, nhân sự, giá/gói, giao dịch và báo cáo.
- **Receptionist:** hội viên, hỗ trợ giao dịch tiền mặt mô phỏng, check-in, phiếu thu.
- **Trainer:** mở slot cá nhân; xác nhận, hoàn tất hoặc hủy lịch thuộc mình.
- **Member:** đăng ký/OTP, mua gói, mock payment, đặt PT, tự check-in và xem lịch sử cá nhân.

## 3. Yêu cầu chức năng

| ID | Yêu cầu |
|---|---|
| FR-01 | Member đăng ký email duy nhất, nhận OTP 6 số, xác thực rồi mới đăng nhập. |
| FR-02 | Owner tạo Receptionist/Trainer; người dùng công khai không thể tự cấp role. |
| FR-03 | Backend kiểm tra JWT, role và quyền sở hữu ở mọi endpoint nhạy cảm. |
| FR-04 | Owner tạo/đóng bán gói Gym/PT; giá tại đơn hàng được snapshot. |
| FR-05 | Member tạo đơn; Member chỉ dùng chuyển khoản demo, nhân viên xác nhận tiền mặt tại quầy. |
| FR-06 | Xác nhận PAID chạy transaction: payment → quyền lợi → receipt → audit log. |
| FR-07 | Receipt PDF ghi rõ chứng từ mô phỏng, không có giá trị thuế/thanh toán. |
| FR-08 | Trainer mở slot tương lai không trùng; Member có lượt PT đặt slot còn trống. |
| FR-09 | PT xác nhận rồi hoàn thành; chỉ lúc COMPLETED mới trừ một buổi. |
| FR-10 | Check-in chỉ thành công với quyền lợi Gym hợp lệ, chống gửi lặp bằng idempotency key. |
| FR-11 | Owner xem tổng thu chỉ từ payment PAID, hội viên, check-in, booking và gói sắp hết hạn. |
| FR-12 | UI hiển thị thông báo tiếng Việt tại thao tác và vô hiệu hóa nút khi đang gửi. |
| FR-13 | Người dùng xem/cập nhật hồ sơ và đổi mật khẩu sau khi xác nhận mật khẩu hiện tại. |

## 4. Yêu cầu phi chức năng

- Mật khẩu hash bcrypt; OTP hash, hết hạn sau 5 phút, tối đa 5 lần thử và resend sau 60 giây.
- Transaction có isolation `Serializable` cho payment, booking, check-in và hoàn tất buổi PT.
- PostgreSQL dùng PK/FK/UNIQUE/NOT NULL, enum và decimal cho tiền.
- REST API có Swagger; lỗi có `errorCode` ổn định và `message` tiếng Việt.
- Layout dùng được trên desktop, tablet và điện thoại; menu theo role.
- Secret nằm trong environment; production không bật OTP development.

## 5. Chính sách MVP đã khóa

- Check-in bằng mã hội viên; QR chỉ là hình thức hiển thị/demo.
- Chống check-in lặp theo `idempotencyKey` và theo hội viên/ngày; mỗi lượt ghi rõ gói Gym được áp dụng.
- Buổi PT trừ lượt khi `COMPLETED`; lịch hủy không trừ lượt.
- Chỉ được hủy lịch trước khi slot bắt đầu.
- Gói PT có hạn dùng mặc định 365 ngày sau kích hoạt.
- Gói Gym đầu tiên kích hoạt khi đơn chuyển PAID; gói gia hạn nối tiếp ngày kết thúc cuối cùng, không chồng thời hạn.

