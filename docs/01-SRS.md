# Software Requirements Specification — Titan Gym

## 1. Phạm vi

Hệ thống phục vụ một cơ sở Gym độc lập dưới dạng Web responsive. Phạm vi gồm xác thực/RBAC, hội viên, gói Gym/PT, Trainer, booking và yêu cầu hủy muộn, mock billing/payment có phê duyệt, receipt PDF, check-in QR, đánh giá PT/Lễ tân, thông báo và báo cáo vận hành.

Ngoài phạm vi: thanh toán thật, hóa đơn điện tử, kế toán thuế, đa chi nhánh, app native, IoT cổng vào, lớp tập nhóm và hoa hồng PT.

## 2. Tác nhân

- **Owner:** toàn quyền vận hành, nhân sự, giá/gói, giao dịch và báo cáo.
- **Receptionist:** hội viên, xác nhận giao dịch mô phỏng do Hội viên gửi, check-in, phiếu thu.
- **Trainer:** mở slot cá nhân; xác nhận, hoàn tất hoặc hủy lịch thuộc mình.
- **Member:** đăng ký/OTP, mua gói, mock payment, đặt PT, hiển thị QR cá nhân cho nhân viên check-in và xem lịch sử cá nhân.

## 3. Yêu cầu chức năng

| ID | Yêu cầu |
|---|---|
| FR-01 | Member đăng ký email duy nhất, nhận OTP 6 số, xác thực rồi mới đăng nhập. |
| FR-02 | Owner tạo Receptionist/Trainer; người dùng công khai không thể tự cấp role. |
| FR-03 | Backend kiểm tra JWT, role và quyền sở hữu ở mọi endpoint nhạy cảm. |
| FR-04 | Owner tạo/đóng bán gói Gym/PT; giá tại đơn hàng được snapshot. |
| FR-05 | Member phải chọn và xác nhận phương thức chuyển khoản hoặc tiền mặt cho đơn của mình; chỉ sau đó Lễ tân/Chủ phòng mới được xác nhận đã nhận tiền. Yêu cầu chờ tối đa 48 giờ. |
| FR-06 | Chỉ sau khi nhân viên xác nhận mới chạy transaction PAID: payment → quyền lợi → receipt → audit log; từ chối phải có lý do. |
| FR-07 | Receipt PDF dùng font Unicode và ghi phương thức, tài khoản/vai trò/thời gian xác nhận; đây là chứng từ mô phỏng, không có giá trị thuế. |
| FR-08 | Trainer mở slot tương lai không trùng; Member lọc theo ngày, sắp xếp theo đánh giá/lịch sớm và chỉ đặt slot còn trống. |
| FR-09 | Đặt lịch giữ ngay một buổi PT. Quét/xác nhận tại quầy từ 60 phút trước giờ bắt đầu đến 5 phút sau giờ kết thúc ghi điểm danh PT. Hết thời gian đệm: có điểm danh chuyển `AWAITING_COMPLETION` để PT xác nhận; không có điểm danh tự chuyển `NO_SHOW` và trừ buổi. |
| FR-10 | Hội viên xuất trình QR cá nhân; Lễ tân/Chủ phòng quét hoặc nhập mã. Ngay khi tra cứu, giao diện quầy chỉ hiển khối nhắc lịch PT nếu Hội viên có booking hoạt động trong ngày, kể cả khi không có gói Gym hợp lệ. API chống gửi lặp và chỉ ghi một lượt/Hội viên/ngày; quét lại không ghi/trừ thêm. Check-in không tự đổi booking PT. |
| FR-11 | Owner xem tổng thu chỉ từ payment PAID, hội viên, check-in, booking và gói sắp hết hạn. |
| FR-12 | UI hiển thị thông báo tiếng Việt tại thao tác và vô hiệu hóa nút khi đang gửi. |
| FR-13 | Người dùng xem/cập nhật hồ sơ và đổi mật khẩu sau khi xác nhận mật khẩu hiện tại. |
| FR-14 | Member được đánh giá mỗi PT/Lễ tân đang làm việc một lần bằng 1–5 sao kèm nhận xét, không phụ thuộc lịch PT; có thể cập nhật đánh giá. Owner xem toàn bộ phản hồi. |
| FR-15 | Người dùng nhận thông báo trong ứng dụng về thanh toán, lịch PT, đánh giá và nhắc lịch PT trong 24 giờ trước ca. |
| FR-16 | Owner xem đối soát tiền mặt theo ngày, doanh thu theo người xác nhận, hiệu suất PT và audit log. |
| FR-17 | Owner lọc nhân sự còn làm/đã nghỉ, sắp xếp nhân sự đang làm theo điểm hoặc số lượt đánh giá và mở chi tiết phản hồi. |

## 4. Yêu cầu phi chức năng

- Mật khẩu hash bcrypt; OTP hash, hết hạn sau 5 phút, tối đa 5 lần thử và resend sau 60 giây.
- Transaction có isolation `Serializable` cho payment, booking, check-in và hoàn tất buổi PT.
- PostgreSQL dùng PK/FK/UNIQUE/NOT NULL, enum và decimal cho tiền.
- REST API có Swagger; lỗi có `errorCode` ổn định và `message` tiếng Việt.
- Layout dùng được trên desktop, tablet và điện thoại; menu theo role.
- Secret nằm trong environment; production không bật OTP development.
- Toàn bộ ngày giờ nghiệp vụ và hiển thị sử dụng `Asia/Ho_Chi_Minh`.

## 5. Chính sách MVP đã khóa

- QR chứa mã hội viên để Hội viên xuất trình; chỉ Lễ tân/Chủ phòng được quét hoặc nhập mã và xác nhận check-in.
- Chống check-in Gym lặp theo `idempotencyKey` và theo hội viên/ngày; quét lại không tạo lượt Gym mới nhưng vẫn có thể ghi điểm danh cho lịch PT đang nằm trong cửa sổ hợp lệ.
- Gói Gym theo tháng hiển thị ngày bắt đầu/kết thúc; gói PT hiển thị tổng, đã dùng, đang giữ và còn khả dụng.
- Lịch PT giữ một buổi từ `PENDING`; `CANCEL_REQUESTED` và `AWAITING_COMPLETION` tiếp tục giữ buổi, `REJECTED`/`CANCELLED` hoàn buổi, `COMPLETED`/`NO_SHOW` trừ một buổi.
- Hội viên hủy lịch đã xác nhận trước ít nhất 4 giờ được hủy ngay; dưới 4 giờ tạo `CANCEL_REQUESTED` để PT/Chủ phòng chấp nhận hoặc từ chối. PT hủy trước giờ bắt đầu có hiệu lực ngay và hoàn buổi.
- Yêu cầu xác nhận thanh toán hết hạn sau 48 giờ; hết hạn phải do Hội viên gửi lại. Nhân viên không được tự chuyển đơn mới tạo sang PAID khi chưa có yêu cầu của Hội viên.
- Gói PT có hạn dùng mặc định 365 ngày sau kích hoạt.
- Gói Gym đầu tiên kích hoạt khi đơn chuyển PAID; gói gia hạn nối tiếp ngày kết thúc cuối cùng, không chồng thời hạn.
