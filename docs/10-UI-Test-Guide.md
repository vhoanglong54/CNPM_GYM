# Hướng dẫn thao tác và kiểm thử giao diện

Tài liệu này dùng để kiểm tra từng chức năng và luồng phối hợp giữa Chủ phòng, Lễ tân, PT và Hội viên. Mật khẩu của toàn bộ tài khoản mẫu là giá trị `SEED_PASSWORD` trong `backend/.env` (workspace hiện tại mặc định là `Gym@123456`).

## 1. Chuẩn bị hệ thống

Mở Docker Desktop, sau đó chạy tại `D:\QuanLyPhongGym`:

```powershell
docker compose up -d
docker compose ps
npm run dev
```

Chỉ tiếp tục khi `docker compose ps` hiển thị `gym-management-db` ở trạng thái `healthy`, terminal báo Backend chạy cổng `3000` và Vite chạy cổng `5173`.

- Test trên máy chủ: mở `http://localhost:5173` bằng Chrome hoặc Edge độc lập. Không dùng tab xem trước/trình duyệt tích hợp của VS Code khi cần quét camera.
- Test nhiều máy: các máy cùng Wi-Fi/LAN mở `http://<IP-máy-chủ>:5173`.
- Mỗi máy hoặc mỗi hồ sơ trình duyệt chỉ nên đăng nhập một vai trò để quan sát đồng thời.
- Nếu cần dựng lại các bản ghi mẫu, chạy `npm run db:seed`. Lệnh có thể chạy lại và không tạo trùng các bản ghi seed cố định.

## 2. Tài khoản và dữ liệu có sẵn

| Vai trò | Tài khoản | Dùng để kiểm thử |
|---|---|---|
| Chủ phòng | `vhoanglong54@gmail.com` | Dashboard, toàn bộ đơn hàng, gói, nhân sự, hội viên |
| Lễ tân | `letan@gym.local` | Xem/xác nhận giao dịch, check-in |
| PT | `minhanh.pt@gym.local` | Tạo ca trống, xử lý lịch hẹn |
| PT | `quanghuy.pt@gym.local` | Test nhiều PT và lọc ca |
| PT | `thaovy.pt@gym.local` | Test nhiều PT và lọc ca |
| Hội viên | `khanhbang@gym.local` | Có gói Gym đã thanh toán |
| Hội viên | `thuha@gym.local` | Có sẵn đơn chờ thanh toán |
| Hội viên | `gialinh@gym.local` | Có sẵn đơn đã hủy |
| Hội viên | `hoangnam@gym.local` | Có gói PT 12 buổi để đặt lịch |

Dữ liệu mẫu gồm 3 gói Gym (1, 2, 3 tháng), 3 gói PT (8, 12, 24 buổi), 6 ca PT trống và các giao dịch ở ba trạng thái. Không dùng tài khoản Chủ phòng để thử xóa dữ liệu nền tảng.

## 3. Luồng đăng ký và xác thực email

1. Ở màn hình đăng nhập, chọn **Tạo tài khoản hội viên**.
2. Nhập email chưa tồn tại, họ tên và mật khẩu hợp lệ.
3. Mở email nhận mã OTP, nhập mã và xác nhận.
4. Quay về đăng nhập bằng tài khoản vừa tạo.

Kết quả mong đợi:

- Email đã tồn tại báo rõ lỗi và không tạo bản ghi trùng.
- OTP đúng kích hoạt tài khoản; OTP sai hoặc hết hạn bị từ chối.
- Sau khi đăng nhập, người dùng chỉ thấy menu dành cho Hội viên.

Nếu môi trường chưa cấu hình SMTP thật và `DEV_OTP_ENABLED=true`, backend có thể dùng OTP dự phòng phục vụ phát triển. Khi test gửi mail thật phải kiểm tra `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` trong `backend/.env`.

## 4. Luồng mua gói và theo dõi giao dịch giữa các vai trò

Đây là luồng nên test bằng hai máy hoặc hai hồ sơ trình duyệt:

- Máy A đăng nhập Hội viên `thuha@gym.local`.
- Máy B đăng nhập Lễ tân `letan@gym.local` hoặc Chủ phòng `vhoanglong54@gmail.com`.

### 4.1 Tạo đơn

1. Máy A vào **Gói tập**.
2. Chọn một gói Gym hoặc gói PT và xác nhận.
3. Máy A vào **Giao dịch**.
4. Máy B cũng mở **Giao dịch** và chờ tối đa 5 giây hoặc bấm **Làm mới**.

Kết quả mong đợi:

- Đơn mới có trạng thái **Chờ thanh toán** trên cả hai máy.
- Hội viên chỉ thấy đơn của chính mình.
- Lễ tân và Chủ phòng thấy đơn của tất cả hội viên.
- Mã đơn, hội viên, tên gói và số tiền giống nhau giữa hai máy.

### 4.2 Xác nhận thanh toán tại quầy

1. Trên máy B, tìm đơn vừa tạo và chọn **Xác nhận thu**.
2. Xác nhận hộp thoại.
3. Quan sát tiến trình chuyển từ **Đang chờ** sang **Hoàn tất**.
4. Trên máy A chờ tối đa 5 giây; trạng thái phải đổi thành **Đã thanh toán**.
5. Máy A mở **Hồ sơ** để kiểm tra gói vừa mua đã xuất hiện trong quyền lợi.
6. Ở cả hai máy, chọn **Phiếu thu** để kiểm tra PDF.

Kết quả mong đợi:

- Hệ thống chỉ tạo một khoản thanh toán và một phiếu thu.
- Đơn chuyển sang **Đã thanh toán** và không còn nút thanh toán/hủy.
- Gói Gym hoặc số buổi PT được kích hoạt tự động.
- Dashboard Chủ phòng cập nhật tổng giao dịch và doanh thu.

### 4.3 Hội viên tự xác nhận chuyển khoản

1. Tạo một đơn khác bằng tài khoản Hội viên.
2. Tại **Giao dịch**, Hội viên chọn **Thanh toán**.
3. Lễ tân/Chủ phòng quan sát trạng thái cập nhật.

Kết quả mong đợi: luồng trạng thái và quyền lợi giống mục 4.2. Hệ thống hiện chỉ ghi nhận giao dịch nội bộ, chưa kết nối cổng ngân hàng thật.

### 4.4 Hủy đơn

1. Tạo một đơn mới nhưng chưa thanh toán.
2. Chọn biểu tượng **Hủy đơn** và xác nhận.
3. Kiểm tra trên Hội viên, Lễ tân và Chủ phòng.

Kết quả mong đợi:

- Đơn chuyển sang **Đã hủy** trên các máy.
- Không thể thanh toán hoặc xuất phiếu thu cho đơn đã hủy.
- Không sinh quyền lợi Gym/PT.

## 5. Luồng lịch PT

### 5.1 PT mở ca trống

1. Đăng nhập `minhanh.pt@gym.local`.
2. Vào **Lịch PT**, nhập ngày giờ bắt đầu/kết thúc và chọn **Mở ca**.
3. Kiểm tra ca mới xuất hiện trong danh sách.

Kết quả mong đợi: chỉ PT có thể tạo ca của chính mình; thời gian kết thúc phải sau thời gian bắt đầu.

### 5.2 Hội viên đặt lịch

1. Ở máy khác đăng nhập `hoangnam@gym.local`.
2. Vào **Lịch PT**, chọn một ca trống.
3. Chọn gói `PT 12 Buổi`, nhập ghi chú nếu cần và gửi yêu cầu.
4. Quay lại máy PT và bấm làm mới trang nếu cần.

Kết quả mong đợi:

- Lịch ở trạng thái **Chờ xác nhận**.
- Ca đã chọn không còn nhận thêm lịch đặt trùng.
- PT nhìn thấy tên hội viên, ca và ghi chú.

### 5.3 PT xác nhận và hoàn thành

1. PT chọn **Xác nhận** cho yêu cầu đang chờ.
2. Hội viên kiểm tra trạng thái đổi thành **Đã xác nhận**.
3. PT chọn **Hoàn thành** sau buổi tập.
4. Hội viên mở **Hồ sơ** và kiểm tra số buổi còn lại giảm một.

Kết quả mong đợi: trạng thái đi đúng thứ tự `Chờ xác nhận → Đã xác nhận → Hoàn thành`; một lịch không thể hoàn thành hai lần.

### 5.4 Hủy lịch

Tạo một lịch khác rồi hủy từ tài khoản được phép. Kết quả mong đợi là trạng thái **Đã hủy**, ca được xử lý theo quy tắc của hệ thống và số buổi chưa bị trừ nếu lịch chưa hoàn thành.

## 6. Luồng check-in

1. Trên điện thoại hoặc trình duyệt thứ nhất, đăng nhập Hội viên `khanhbang@gym.local`.
2. Vào **Check-in** và mở QR thẻ hội viên.
3. Trên thiết bị tại quầy, đăng nhập Lễ tân `letan@gym.local` hoặc Chủ phòng.
4. Vào **Check-in**, chọn **Mở camera**, cấp quyền camera và đưa QR hội viên vào khung quét.
5. Sau khi đọc được `MB-000101`, kiểm tra tên hội viên, số ngày còn lại và gói Gym được đề xuất.
6. Chọn gói cần áp dụng nếu hội viên có nhiều quyền lợi, sau đó chọn **Xác nhận check-in**.
7. Kiểm tra bản ghi mới trong lịch sử của cả Lễ tân và Hội viên.
8. Thử xác nhận lại cùng hội viên trong ngày, mã không tồn tại hoặc hội viên không có gói Gym hiệu lực.

Nếu camera không mở được, nhập `MB-000101` vào ô mã hội viên rồi xác nhận. Camera trên trình duyệt yêu cầu `localhost` hoặc HTTPS; khi truy cập bằng IP LAN qua HTTP, hãy dùng nhập mã thủ công. Trên laptop tại quầy, mở `http://localhost:5173/checkin` bằng Chrome/Edge độc lập, cho phép quyền camera rồi quét QR đang hiển thị trên điện thoại Hội viên. Không cần camera để kiểm tra phần còn lại của quy trình.

Kết quả mong đợi:

- Hội viên có gói hiệu lực check-in thành công.
- Lượt check-in gắn đúng với gói đã hiển thị ở bước xác nhận; gói thời hạn giữ nguyên ngày hết hạn.
- Mã sai hoặc không có quyền lợi hợp lệ bị từ chối rõ ràng.
- Mỗi hội viên chỉ được ghi nhận một lần trong cùng ngày, tránh tăng sai số ngày tập hoặc trừ nhiều lượt.
- Hội viên chỉ hiển thị QR và lịch sử của mình; chỉ Lễ tân/Chủ phòng có quyền ghi nhận check-in.

## 7. Quản lý gói, hội viên và nhân sự

### Chủ phòng

1. Đăng nhập Chủ phòng.
2. Tại **Gói tập**, tạo một gói mới và kiểm tra nó xuất hiện cho Hội viên.
3. Tại **Nhân sự**, tạo tài khoản Lễ tân/PT và kiểm tra quyền đăng nhập.
4. Tại **Hội viên**, tìm theo tên/email/mã và thử xóa một tài khoản test không còn dữ liệu liên quan.

Kết quả mong đợi:

- Chỉ Chủ phòng thấy thao tác tạo gói, tạo nhân sự và xóa hội viên.
- Tài khoản có giao dịch/lịch sử liên quan được bảo vệ theo ràng buộc dữ liệu; thông báo lỗi phải rõ ràng.
- Không xóa các tài khoản mẫu nếu còn cần dùng cho phần test khác.

### Lễ tân, PT và Hội viên

Kiểm tra trực tiếp URL của trang không thuộc quyền. Kết quả mong đợi là menu không hiển thị và backend vẫn từ chối API nếu cố gọi thủ công; việc ẩn nút không phải lớp bảo mật duy nhất.

## 8. Hồ sơ và đổi mật khẩu

1. Đăng nhập bất kỳ tài khoản nào, mở **Hồ sơ**.
2. Kiểm tra email, số điện thoại, mã hội viên/PT và quyền lợi.
3. Thử đổi mật khẩu với mật khẩu hiện tại sai, xác nhận không khớp và dữ liệu hợp lệ.

Kết quả mong đợi: lỗi nhập liệu được báo rõ; đổi thành công yêu cầu đăng nhập bằng mật khẩu mới theo quy tắc hiện tại.

Lưu ý: chạy lại `npm run db:seed` sẽ đặt lại mật khẩu của các tài khoản mẫu về `SEED_PASSWORD`.

## 9. Kiểm thử đồng thời trên nhiều máy

Kịch bản nhanh:

1. Máy chủ chạy Docker và `npm run dev`.
2. Máy A đăng nhập Hội viên, máy B đăng nhập Lễ tân, máy C đăng nhập Chủ phòng, máy D đăng nhập PT.
3. Máy A tạo đơn; B/C nhìn thấy đơn chờ và một trong hai máy xác nhận thu.
4. A nhìn thấy đơn hoàn tất và quyền lợi mới.
5. D mở ca PT; A (với tài khoản có gói PT) đặt lịch; D xác nhận.
6. B check-in một hội viên; C quan sát dashboard/lịch sử.

Tất cả máy dùng các token đăng nhập riêng trong trình duyệt nhưng gọi cùng Backend trên máy chủ. Backend dùng Prisma đọc/ghi cùng PostgreSQL trong container, vì vậy không có database riêng trên từng máy khách. Giao dịch database được commit một lần và lần tải dữ liệu tiếp theo ở máy khác sẽ nhận cùng kết quả.

Nếu máy khác không truy cập được:

1. Kiểm tra các máy cùng mạng và không dùng Wi-Fi khách bị cô lập thiết bị.
2. Kiểm tra URL dùng IPv4 của máy chủ, không dùng `localhost` trên máy khách.
3. Kiểm tra `docker compose ps` và terminal `npm run dev` trên máy chủ.
4. Cho phép Node.js qua Windows Firewall ở mạng Private.
5. Kiểm tra cổng `5173` và `3000` không bị ứng dụng khác chiếm.

## 10. Kết thúc buổi test

Nhấn `Ctrl+C` tại terminal chạy ứng dụng. Nếu muốn dừng PostgreSQL:

```powershell
docker compose down
```

Lệnh trên giữ nguyên volume và dữ liệu. Không dùng `docker compose down -v` trừ khi chủ động muốn xóa toàn bộ database.
