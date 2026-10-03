# API Specification

Base URL local: `http://localhost:3000/api`. Base URL production: `https://titan-gym-api.vercel.app/api`. Swagger: `/api/docs`.

Trừ các endpoint Public, request phải có `Authorization: Bearer <JWT>`. DTO được kiểm tra bởi `ValidationPipe` với `whitelist`, `transform` và `forbidNonWhitelisted`.

## Auth

| Method | Path | Quyền và hành vi |
|---|---|---|
| GET | `/` | Public; health check của Backend. |
| POST | `/auth/register` | Public; chỉ tạo/resume tài khoản Member. |
| POST | `/auth/verify-email` | Public; xác thực OTP. |
| POST | `/auth/resend-otp` | Public; áp dụng thời gian chờ gửi lại. |
| POST | `/auth/login` | Public; trả JWT và thông tin role/profile. |
| GET | `/auth/me` | Authenticated; kiểm tra lại phiên đăng nhập. |

## User và nhân sự

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/users/me/profile` | Chính tài khoản đang đăng nhập. |
| PATCH | `/users/me/profile` | Chính tài khoản đang đăng nhập. |
| POST | `/users/me/change-password` | Chính tài khoản; cần mật khẩu hiện tại. |
| GET | `/users/members` | Owner, Receptionist. |
| DELETE | `/users/members/:id` | Owner; chỉ xóa Member chưa có lịch sử được bảo vệ. |
| GET | `/users/staff` | Owner. |
| POST | `/users/staff` | Owner; tạo Receptionist hoặc Trainer. |
| PATCH | `/users/:id/status` | Owner; khóa/mở tài khoản, không tự khóa chính mình. |

## Catalog

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/catalog/memberships` | Authenticated; mặc định chỉ gói active. `?all=true` lấy cả gói đóng bán. |
| GET | `/catalog/pt-packages` | Authenticated; mặc định chỉ gói active. `?all=true` lấy cả gói đóng bán. |
| POST | `/catalog/memberships` | Owner. Frontend hiện tạo gói `DURATION`. |
| POST | `/catalog/pt-packages` | Owner. |
| PATCH | `/catalog/memberships/:id/availability` | Owner; bật/tắt bán. |
| PATCH | `/catalog/pt-packages/:id/availability` | Owner; bật/tắt bán. |

## Order, payment và receipt

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/orders` | Owner/Receptionist xem tất cả; Member xem đơn của mình. |
| POST | `/orders` | Member; mỗi đơn hiện chứa một sản phẩm. |
| POST | `/orders/:id/pay` | Member sở hữu đơn gửi `TRANSFER_DEMO`; Owner/Receptionist thu `CASH` tại quầy. |
| PATCH | `/orders/:orderId/payments/:paymentId/confirm` | Owner, Receptionist; duyệt chuyển khoản đang chờ. |
| PATCH | `/orders/:orderId/payments/:paymentId/reject` | Owner, Receptionist; lý do tối thiểu 3 ký tự. |
| PATCH | `/orders/:id/cancel` | Owner/Receptionist hoặc Member sở hữu Order PENDING. |
| GET | `/orders/:id/receipt` | Owner/Receptionist hoặc Member sở hữu Order PAID; trả trực tiếp `application/pdf`. |

## Slot, booking và review PT

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/operations/slots` | Authenticated; hỗ trợ `from`, `to`, `sort=SOONEST\|RATING\|REVIEW_COUNT`. |
| POST | `/operations/slots` | Trainer có `trainerProfileId`; tạo slot của chính mình. |
| PATCH | `/operations/slots/:id/close` | Trainer sở hữu hoặc Owner; slot không có booking PENDING/CONFIRMED. |
| GET | `/operations/bookings` | Owner xem tất cả; Trainer xem lịch của mình; Member xem lịch của mình. |
| POST | `/operations/bookings` | Member; chọn slot và `memberPtPackageId`. |
| PATCH | `/operations/bookings/:id/status` | Trainer sở hữu/Owner xử lý; Member chỉ hủy lịch của mình theo cutoff. |
| POST | `/operations/bookings/:id/review` | Member sở hữu booking COMPLETED; một review/booking. |

## Check-in

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/operations/checkins/eligibility/:memberCode` | Owner, Receptionist theo kiểm tra trong service. |
| POST | `/operations/checkins` | Owner, Receptionist; cần `memberCode`, `idempotencyKey`, có thể chọn `memberMembershipId`. |
| GET | `/operations/checkins` | Member xem của mình; Owner/Receptionist xem tối đa 100 lượt gần nhất. |

Lưu ý phản ánh đúng implementation hiện tại: `GET /operations/checkins` mới chỉ có JWT guard ở controller. Frontend không cấp trang Check-in cho Trainer, nhưng service hiện dùng nhánh danh sách chung cho tài khoản không có `memberProfileId`; vì vậy Trainer gọi API trực tiếp vẫn có thể nhận danh sách chung. Đây là sai lệch RBAC cần sửa ở mã nguồn nếu yêu cầu bảo mật là Trainer không được xem check-in.

## Report và notification

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/reports/dashboard` | Owner. |
| GET | `/reports/operations` | Owner. |
| GET | `/notifications` | Authenticated; tối đa 50 thông báo của chính tài khoản và tạo nhắc lịch 24 giờ chống trùng khi cần. |
| PATCH | `/notifications/read-all` | Chính tài khoản. |
| PATCH | `/notifications/:id/read` | Chính tài khoản sở hữu notification. |

## Dạng response

Response JSON thành công thông thường:

```json
{
  "success": true,
  "data": {},
  "message": "Thông báo tiếng Việt nếu endpoint có khai báo."
}
```

Response lỗi do `ApiExceptionFilter` chuẩn hóa:

```json
{
  "success": false,
  "errorCode": "BOOKING_SLOT_TAKEN",
  "message": "Khung giờ này đã được đặt. Vui lòng chọn giờ khác."
}
```

Ngoại lệ là endpoint phiếu thu trả PDF stream thay vì JSON. Quyền hiển thị route ở Frontend không thay thế JWT, role và ownership check tại Backend.
