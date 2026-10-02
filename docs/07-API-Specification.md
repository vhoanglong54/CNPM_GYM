# API Specification

Base URL: `/api`. Endpoint bảo vệ dùng `Authorization: Bearer <JWT>`. Swagger đầy đủ tại `/api/docs`.

| Method | Path | Quyền |
|---|---|---|
| POST | `/auth/register` | Public/Member |
| POST | `/auth/verify-email`, `/auth/resend-otp`, `/auth/login` | Public |
| GET | `/auth/me`, `/users/me/profile` | Authenticated |
| PATCH/POST | `/users/me/profile`, `/users/me/change-password` | Chính tài khoản |
| GET | `/users/members` | Owner, Receptionist |
| DELETE | `/users/members/:id` | Owner; chỉ tài khoản chưa có giao dịch/lịch sử sử dụng |
| GET/POST | `/users/staff` | Owner |
| PATCH | `/users/:id/status` | Owner |
| GET | `/catalog/memberships`, `/catalog/pt-packages` | Authenticated |
| GET | `/operations/checkins/eligibility/:memberCode` | Owner, Receptionist |
| POST/PATCH | `/catalog/*` | Owner |
| GET/POST | `/orders` | Authenticated; create là Member |
| POST | `/orders/:id/pay` | Owner/Receptionist hoặc chủ đơn theo policy |
| PATCH | `/orders/:id/cancel` | Staff hoặc chủ đơn |
| GET | `/orders/:id/receipt` | Staff hoặc chủ đơn PAID |
| GET/POST | `/operations/slots` | GET mọi role; POST Trainer |
| PATCH | `/operations/slots/:id/close` | Trainer sở hữu hoặc Owner; chỉ slot chưa có lịch hoạt động |
| GET/POST | `/operations/bookings` | Theo scope role |
| PATCH | `/operations/bookings/:id/status` | Trainer sở hữu hoặc Member hủy của mình |
| GET/POST | `/operations/checkins` | Theo scope role |
| GET | `/reports/dashboard` | Owner |

Response thành công: `{ "success": true, "data": ..., "message": "..." }`.

Response lỗi: `{ "success": false, "errorCode": "BOOKING_SLOT_TAKEN", "message": "Khung giờ này đã được đặt. Vui lòng chọn giờ khác." }`.

