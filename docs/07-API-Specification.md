# API Specification

Base URL local: `http://localhost:3000/api`. Base URL production: `https://titan-gym-api.vercel.app/api`. Swagger: `/api/docs`.

Trừ các endpoint Public, request phải có `Authorization: Bearer <JWT>`. Mỗi request có JWT đều kiểm tra lại trạng thái và quyền hiện tại trong database; tài khoản đã chuyển sang `INACTIVE` không thể tiếp tục dùng JWT cũ. DTO được kiểm tra bởi `ValidationPipe` với `whitelist`, `transform` và `forbidNonWhitelisted`.

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
| PATCH | `/users/:id/status` | Owner; cho nghỉ việc/khôi phục Receptionist hoặc Trainer bằng `INACTIVE`/`ACTIVE`, không xóa lịch sử. |

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
| POST | `/orders` | Member; mỗi đơn chứa một sản phẩm. Nhận `idempotencyKey` UUID để request gửi lặp chỉ trả lại cùng một đơn. |
| POST | `/orders/:id/pay` | Chỉ Member sở hữu đơn; gửi `TRANSFER_DEMO` hoặc `CASH` để tạo Payment `AWAITING_CONFIRMATION`. Nhân viên gọi endpoint này cho đơn của Hội viên bị từ chối. |
| PATCH | `/orders/:orderId/payments/:paymentId/confirm` | Owner, Receptionist; chỉ duyệt Payment `AWAITING_CONFIRMATION` do Hội viên đã gửi. |
| PATCH | `/orders/:orderId/payments/:paymentId/reject` | Owner, Receptionist; lý do tối thiểu 3 ký tự. |
| PATCH | `/orders/:id/cancel` | Owner/Receptionist hoặc Member sở hữu Order PENDING; gọi lại với Order CANCELLED vẫn trả thành công. |
| GET | `/orders/:id/receipt` | Owner/Receptionist hoặc Member sở hữu Order PAID; trả trực tiếp `application/pdf`. |

## Slot và booking PT

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/operations/slots` | Authenticated; hỗ trợ `from`, `to`, `sort=SOONEST\|RATING\|REVIEW_COUNT`. |
| POST | `/operations/slots` | Trainer có `trainerProfileId`; tạo slot của chính mình. |
| PATCH | `/operations/slots/:id/close` | Trainer sở hữu hoặc Owner; slot không có booking PENDING/CONFIRMED/CANCEL_REQUESTED. |
| GET | `/operations/bookings` | Owner xem tất cả; Trainer xem lịch của mình; Member xem lịch của mình. Booking `CONFIRMED` trả `completionCheckinAt` nếu có check-in Gym cùng ngày và không muộn hơn giờ bắt đầu. |
| POST | `/operations/bookings` | Member; chọn slot và `memberPtPackageId`. |
| PATCH | `/operations/bookings/:id/status` | Trainer sở hữu/Owner xử lý; Member hủy sớm trực tiếp, hủy CONFIRMED dưới 4 giờ tạo `CANCEL_REQUESTED`. `COMPLETED` bị từ chối với `PT_COMPLETION_CHECKIN_REQUIRED` nếu Hội viên không check-in Gym trước hoặc đúng giờ bắt đầu. |

## Đánh giá nhân viên

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/reviews/staff` | Owner xem PT/Lễ tân mọi trạng thái; Member chỉ xem nhân viên ACTIVE. Trả điểm trung bình và số bài. |
| GET | `/reviews/staff/:staffId` | Owner hoặc Member; trả hồ sơ, tổng điểm, bài đánh giá và bài của Member hiện tại nếu có. |
| POST | `/reviews/staff/:staffId` | Member; tạo hoặc cập nhật một bài 1–5 sao, nhận xét 3–1000 ký tự cho PT/Lễ tân ACTIVE; không yêu cầu booking. |

## Check-in

| Method | Path | Quyền và phạm vi |
|---|---|---|
| GET | `/operations/checkins/eligibility/:memberCode` | Owner, Receptionist; trả `alreadyCheckedIn`, `eligibleForGymCheckin`, gói Gym có thể áp dụng và `todayPtAppointments` ngay khi quét. Nếu không có gói Gym, endpoint vẫn trả lịch PT để Lễ tân nhận biết nhưng không cho xác nhận check-in Gym. |
| POST | `/operations/checkins` | Owner, Receptionist; cần `memberCode`, `idempotencyKey`, có thể chọn `memberMembershipId`. Trả `alreadyCheckedIn`, `replayed` và `todayPtAppointments`. Lần quét lại cùng ngày vẫn thành công nhưng không ghi/trừ thêm. |
| GET | `/operations/checkins` | Member xem của mình; Owner/Receptionist xem tối đa 100 lượt gần nhất. |

`todayPtAppointments` chỉ liệt kê booking trong ngày có trạng thái `PENDING`, `CONFIRMED` hoặc `CANCEL_REQUESTED`, kèm giờ bắt đầu/kết thúc và tên PT. Endpoint check-in không cập nhật booking PT.

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
