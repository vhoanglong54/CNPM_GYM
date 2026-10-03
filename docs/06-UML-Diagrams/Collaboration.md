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
  M -->|3. Báo đã chuyển khoản| UI
  UI -->|4. Gửi yêu cầu duyệt| NOTICE
  NOTICE -->|5. Báo giao dịch mới| S
  S -->|6. Xác nhận hoặc từ chối| UI
  UI -->|7. Cập nhật kết quả| ORDER
  ORDER -->|8a. Nếu thành công: kích hoạt| BENEFIT
  ORDER -->|8b. Nếu thành công: tạo| RECEIPT
  ORDER -->|9. Thông báo kết quả| M
```

Với tiền mặt, quy trình bắt đầu từ bước 6: nhân viên xác nhận đã thu tiền, sau đó hệ thống kích hoạt quyền lợi và tạo phiếu thu.

## 2. Đặt lịch PT

```mermaid
flowchart LR
  M([Hội viên])
  T([PT])
  UI[Giao diện Titan Gym]
  SLOT[Lịch trống của PT]
  PACKAGE[Gói PT của Hội viên]
  BOOKING[Lịch hẹn PT]
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
  UI -->|10. Cập nhật lịch và số buổi| BOOKING
  BOOKING -->|11. Thông báo kết quả| M
```

Khi hoàn thành hoặc vắng mặt, buổi đang giữ chuyển thành đã dùng. Khi từ chối hoặc hủy hợp lệ, buổi đang giữ được hoàn lại.
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

  M -->|1. Xuất trình| QR
  S -->|2. Quét hoặc nhập mã| UI
  UI -->|3. Kiểm tra| BENEFIT
  BENEFIT -->|4. Trả gói hợp lệ| UI
  S -->|5. Chọn gói và xác nhận| UI
  UI -->|6. Ghi nhận lượt vào| CHECKIN
  CHECKIN -->|7. Trả kết quả| S
```

Nếu Hội viên đã check-in trong ngày, lịch sử không tạo thêm bản ghi và không trừ thêm lượt; Lễ tân vẫn có thể cho Hội viên vào.

## 4. Vai trò trong hệ thống

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
