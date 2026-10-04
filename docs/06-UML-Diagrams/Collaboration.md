# Collaboration Diagram

Các sơ đồ cho biết những đối tượng nào phối hợp trong từng quy trình. Đọc thông điệp theo thứ tự `1`, `2`, `3`…; tên lớp kỹ thuật được thay bằng tên nghiệp vụ để dễ trình bày.

## 1. Mua gói và thanh toán

```mermaid
flowchart LR
  M([Hội viên])
  S([Lễ tân/Chủ phòng])
  UI[Giao diện Titan Gym]
  ORDER[Đơn hàng và thanh toán]
  BENEFIT[Quyền lợi Gym/PT]
  RECEIPT[Phiếu thu]
  NOTICE[Thông báo]

  M -->|1. Chọn gói| UI
  UI -->|2. Tạo đơn chờ thanh toán| ORDER
  M -->|3. Xác nhận chuyển khoản hoặc tiền mặt| UI
  UI -->|4. Tạo yêu cầu chờ duyệt| NOTICE
  NOTICE -->|5. Báo giao dịch mới| S
  S -->|6. Sau yêu cầu: xác nhận thu hoặc từ chối| UI
  UI -->|7. Cập nhật kết quả| ORDER
  ORDER -->|8a. Nếu thành công: kích hoạt| BENEFIT
  ORDER -->|8b. Nếu thành công: tạo| RECEIPT
  ORDER -->|9. Thông báo kết quả| M
```

Cả chuyển khoản và tiền mặt đều đi từ bước 3. Khi Hội viên chưa xác nhận, nhân viên chỉ thấy trạng thái chờ và không thể chuyển đơn sang đã thanh toán.

## 2. Đặt lịch PT

```mermaid
flowchart LR
  M([Hội viên])
  T([PT])
  UI[Giao diện Titan Gym]
  SLOT[Lịch trống của PT]
  PACKAGE[Gói PT của Hội viên]
  BOOKING[Lịch hẹn PT]
  CHECKIN[Check-in Gym]
  NOTICE[Thông báo]

  T -->|1. Mở khung giờ| UI
  UI -->|2. Lưu lịch trống| SLOT
  M -->|3. Chọn lịch và gói PT| UI
  UI -->|4. Kiểm tra lịch/lượt| SLOT
  UI -->|5. Giữ một buổi| PACKAGE
  UI -->|6. Tạo lịch Chờ xác nhận| BOOKING
  BOOKING -->|7. Báo yêu cầu mới| NOTICE
  NOTICE -->|8. Gửi đến PT| T
  T -->|9. Xác nhận hoặc từ chối| UI
  UI -->|10. Quét trong cửa sổ -60 đến +5 phút| CHECKIN
  CHECKIN -->|11. Ghi điểm danh PT| BOOKING
  BOOKING -->|12a. Có điểm danh: chờ PT hoàn thành| T
  BOOKING -->|12b. Không điểm danh: tự động vắng mặt| M
```

Ngay khi hết giờ, buổi có điểm danh chuyển sang chờ PT xác nhận hoàn thành. Buổi chưa điểm danh được chờ thêm 5 phút; nếu vẫn không có điểm danh thì tự chuyển vắng mặt. Cả hoàn thành và vắng mặt đều chuyển buổi đang giữ thành đã dùng.
Chủ phòng có thể hỗ trợ xử lý lịch; chỉ PT mở khung giờ của chính mình.

## 3. Check-in QR

```mermaid
flowchart LR
  M([Hội viên])
  S([Lễ tân/Chủ phòng])
  QR[QR hoặc mã Hội viên]
  UI[Giao diện Check-in]
  BENEFIT[Quyền lợi Gym]
  CHECKIN[Lịch sử check-in]
  PT[Lịch PT hôm nay]

  M -->|1. Xuất trình| QR
  S -->|2. Quét hoặc nhập mã| UI
  UI -->|3. Kiểm tra| BENEFIT
  UI -->|4. Tra lịch hôm nay| PT
  BENEFIT -->|5. Trả quyền lợi| UI
  PT -->|6. Nếu có: trả giờ hẹn và PT| UI
  UI -->|7. Nếu có lịch: hiển nhắc ngay| S
  S -->|8. Chọn gói và xác nhận| UI
  UI -->|9. Ghi nhận lượt vào Gym và điểm danh PT nếu đúng giờ| CHECKIN
  CHECKIN -->|10. Trả kết quả| S
```

Nhắc lịch chỉ hiện khi Hội viên có lịch PT hoạt động trong ngày. Quét lại không tạo thêm lượt Gym nhưng vẫn ghi điểm danh PT nếu nằm trong cửa sổ hợp lệ; điểm danh không tự hoàn thành booking.

## 4. Đánh giá nhân viên

```mermaid
flowchart LR
  M([Hội viên])
  UI[Giao diện đánh giá]
  STAFF[Hồ sơ PT/Lễ tân]
  REVIEW[Điểm và bài đánh giá]
  NOTICE[Thông báo]
  O([Chủ phòng])

  M -->|1. Chọn nhân viên| UI
  UI -->|2. Mở hồ sơ| STAFF
  M -->|3. Gửi sao và nhận xét| UI
  UI -->|4. Tạo hoặc cập nhật| REVIEW
  REVIEW -->|5. Cập nhật điểm| STAFF
  REVIEW -->|6. Báo đánh giá mới| NOTICE
  NOTICE -->|7. Gửi tới nhân viên| STAFF
  O -->|8. Xem phản hồi tại Nhân sự| REVIEW
```

Không cần có lịch PT trước đó. Mỗi Hội viên chỉ có một bài cho mỗi nhân viên và được cập nhật bài của chính mình.

## 5. Vai trò trong hệ thống

```mermaid
flowchart TB
  OWNER[Chủ phòng]
  RECEPTION[Lễ tân]
  TRAINER[PT]
  MEMBER[Hội viên]
  SYSTEM[Titan Gym]

  OWNER -->|Quản trị, xác nhận thanh toán, báo cáo, check-in| SYSTEM
  RECEPTION -->|Hội viên, giao dịch, phiếu thu, check-in| SYSTEM
  TRAINER -->|Lịch trống và xử lý buổi PT| SYSTEM
  MEMBER -->|Mua gói, đặt PT, QR, đánh giá| SYSTEM
```

Giao diện chỉ hiển thị chức năng theo vai trò; hệ thống vẫn kiểm tra quyền trước khi thực hiện nghiệp vụ.
