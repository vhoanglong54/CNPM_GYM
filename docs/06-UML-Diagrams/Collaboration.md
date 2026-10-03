# Collaboration Diagram

Mermaid chưa có cú pháp UML Communication Diagram riêng. Các sơ đồ dưới đây dùng `flowchart` với đối tượng và thông điệp đánh số theo đúng cách đọc Collaboration/Communication Diagram: đọc `1`, `1.1`, `1.2`… để theo dõi thứ tự cộng tác.

## 1. Cộng tác tổng thể giữa các lớp

```mermaid
flowchart LR
  Actor([Người dùng])
  Page[React Page]
  Axios[Axios API client]
  Guard[ValidationPipe<br/>JWT/Role Guard]
  Controller[NestJS Controller]
  Service[Domain Service]
  Prisma[PrismaService]
  DB[(PostgreSQL)]
  Filter[ApiExceptionFilter]

  Actor -->|1: thao tác| Page
  Page -->|1.1: gọi hàm API| Axios
  Axios -->|1.2: HTTP + Bearer JWT| Guard
  Guard -->|1.3: request hợp lệ| Controller
  Controller -->|1.4: DTO + AuthUser| Service
  Service -->|1.5: query/transaction| Prisma
  Prisma -->|1.6: SQL| DB
  DB -->|1.7: dữ liệu/commit| Prisma
  Prisma -->|1.8: domain result| Service
  Service -->|1.9: result| Controller
  Controller -->|1.10: response envelope| Axios
  Axios -->|1.11: cập nhật state/toast| Page
  Guard -.->|E1: auth/validation error| Filter
  Service -.->|E2: ApiError| Filter
  Filter -.->|E3: errorCode + message| Axios
```

Frontend kiểm soát route/menu để hỗ trợ trải nghiệm. Guard và service của Backend mới thực thi bảo mật, ownership và quy tắc chuyển trạng thái.

## 2. Xác nhận chuyển khoản

```mermaid
flowchart TB
  Member([Hội viên])
  MemberUI[OrdersPage - Member]
  Staff([Lễ tân/Chủ phòng])
  StaffUI[OrdersPage - Staff]
  OC[OrdersController]
  OS[OrdersService]
  NS[NotificationsService]
  Prisma[PrismaService]
  DB[(Order / Payment / Receipt<br/>Entitlement / AuditLog / Notification)]

  Member -->|1: Báo đã chuyển khoản| MemberUI
  MemberUI -->|1.1: POST /orders/:id/pay| OC
  OC -->|1.2: pay TRANSFER_DEMO| OS
  OS -->|1.3: SERIALIZABLE - tạo Payment AWAITING| Prisma
  OS -->|1.4: notifyRoles OWNER, RECEPTIONIST| NS
  NS -->|1.5: tạo Notification trong cùng transaction| Prisma
  Prisma -->|1.6: COMMIT| DB

  Staff -->|2: Mở yêu cầu chờ| StaffUI
  StaffUI -->|2.1: GET /orders mỗi 5 giây| OC
  OC -->|2.2: list và expire yêu cầu quá hạn| OS
  OS -->|2.3: đọc/cập nhật| Prisma
  Prisma -->|2.4: danh sách Order + Payment| StaffUI

  Staff -->|3: Xác nhận| StaffUI
  StaffUI -->|3.1: PATCH .../confirm| OC
  OC -->|3.2: confirmPayment| OS
  OS -->|3.3: SERIALIZABLE - PAID + quyền lợi + Receipt + AuditLog| Prisma
  OS -->|3.4: notifyUsers Hội viên| NS
  NS -->|3.5: tạo Notification| Prisma
  Prisma -->|3.6: COMMIT nguyên tử| DB
  OS -->|3.7: kết quả PAID| StaffUI
```

`OrdersService` là nơi phối hợp nghiệp vụ; `NotificationsService` nhận cùng `Prisma.TransactionClient`, vì vậy thông báo xác nhận được ghi cùng transaction với Payment và quyền lợi.

## 3. Đặt lịch PT và giữ buổi

```mermaid
flowchart TB
  Member([Hội viên])
  Trainer([PT/Chủ phòng])
  Schedule[SchedulePage]
  OC[OperationsController]
  OS[OperationsService]
  NS[NotificationsService]
  Prisma[PrismaService]
  DB[(PtSlot / PtBooking<br/>MemberPtPackage / AuditLog / Notification)]

  Member -->|1: Chọn slot + gói PT| Schedule
  Schedule -->|1.1: POST /operations/bookings| OC
  OC -->|1.2: createBooking| OS
  OS -->|1.3: SERIALIZABLE - kiểm tra slot/trùng giờ/lượt| Prisma
  OS -->|1.4: tạo PENDING + holdKey; reserved +1| Prisma
  OS -->|1.5: thông báo PT| NS
  NS -->|1.6: tạo Notification| Prisma
  Prisma -->|1.7: COMMIT| DB

  Trainer -->|2: Xác nhận| Schedule
  Schedule -->|2.1: PATCH status CONFIRMED| OC
  OC -->|2.2: updateBooking| OS
  OS -->|2.3: cập nhật Booking + người xử lý| Prisma
  OS -->|2.4: thông báo Hội viên| NS

  Trainer -->|3: Hoàn thành hoặc vắng mặt| Schedule
  Schedule -->|3.1: PATCH status COMPLETED/NO_SHOW| OC
  OC -->|3.2: updateBooking| OS
  OS -->|3.3: SERIALIZABLE - reserved -1, used +1, holdKey null| Prisma
  OS -->|3.4: AuditLog + Notification| Prisma
  Prisma -->|3.5: COMMIT| DB
```

Nếu lịch bị `REJECTED` hoặc `CANCELLED`, cộng tác ở bước 3 đổi thành `sessionsReserved -= 1`, không tăng `sessionsUsed`, giải phóng `holdKey` và lưu lý do/người xử lý.

## 4. Check-in QR có nhân viên xác nhận

```mermaid
flowchart TB
  Member([Hội viên])
  MemberUI[CheckinPage - Member]
  Staff([Lễ tân/Chủ phòng])
  StaffUI[CheckinPage - Staff]
  QR[qr-scanner trong trình duyệt]
  OC[OperationsController]
  OS[OperationsService]
  Time[date-time helper<br/>Asia/Ho_Chi_Minh]
  Prisma[PrismaService]
  DB[(MemberProfile / MemberMembership / Checkin)]

  Member -->|1: Mở QR cá nhân| MemberUI
  MemberUI -->|1.1: hiển thị memberCode| Staff
  Staff -->|2: Mở camera| StaffUI
  StaffUI -->|2.1: đọc QR cục bộ| QR
  QR -->|2.2: memberCode| StaffUI
  StaffUI -->|2.3: GET eligibility/:memberCode| OC
  OC -->|2.4: checkinEligibility| OS
  OS -->|2.5: tìm gói ACTIVE, chưa pause, còn hạn/lượt| Prisma
  Prisma -->|2.6: danh sách gói + gói đề xuất| StaffUI

  Staff -->|3: Chọn gói và xác nhận| StaffUI
  StaffUI -->|3.1: POST /operations/checkins + UUID| OC
  OC -->|3.2: checkin| OS
  OS -->|3.3: lấy ranh giới ngày Việt Nam| Time
  OS -->|3.4: chống UUID trùng và check-in trùng ngày| Prisma
  OS -->|3.5: SERIALIZABLE - tạo Checkin, tùy gói visitsUsed +1| Prisma
  Prisma -->|3.6: COMMIT| DB
  OS -->|3.7: kết quả| StaffUI
```

QR không tự cấp quyền vào phòng tập. Nhân viên luôn nhìn thấy kết quả eligibility, chọn gói áp dụng và gửi xác nhận. Nếu đã có check-in trong ngày, Backend trả `CHECKIN_ALREADY_TODAY`; hệ thống không tạo bản ghi hoặc trừ lượt lần hai, còn Lễ tân có thể cho Hội viên vào theo chính sách đã thống nhất.

## 5. Phiếu thu PDF

```mermaid
flowchart LR
  User([Hội viên hoặc nhân viên có quyền])
  UI[OrdersPage]
  OC[OrdersController]
  OS[OrdersService]
  Prisma[PrismaService]
  DB[(Order + Payment PAID<br/>Receipt + confirmedBy)]
  PDF[PDFKit + DejaVuSans.ttf]

  User -->|1: Mở phiếu thu| UI
  UI -->|1.1: GET /orders/:id/receipt, responseType blob| OC
  OC -->|1.2: streamReceipt| OS
  OS -->|1.3: kiểm tra ownership/role và Payment PAID| Prisma
  Prisma -->|1.4: dữ liệu chứng từ| DB
  OS -->|1.5: render Unicode PDF| PDF
  PDF -->|1.6: application/pdf inline| UI
```

Luồng này chỉ đọc dữ liệu đã tồn tại. Việc mở lại PDF không tạo Receipt mới và không làm thay đổi doanh thu.
