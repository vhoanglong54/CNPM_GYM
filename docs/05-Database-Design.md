# Thiết kế cơ sở dữ liệu

Schema chính thức tại `backend/prisma/schema.prisma`, migration tại `backend/prisma/migrations/`.

## 20 bảng lõi

1. `users`, `roles`, `user_roles`
2. `email_verification_tokens`
3. `member_profiles`, `trainer_profiles`
4. `membership_plans`, `member_memberships`
5. `pt_packages`, `member_pt_packages`
6. `pt_slots`, `pt_bookings`, `trainer_reviews`
7. `checkins`
8. `orders`, `order_items`
9. `payments`, `receipts`
10. `notifications`, `audit_logs`

## Ràng buộc đáng chú ý

- UUID làm khóa chính; email, mã Member/PT, order/payment/receipt và idempotency key là unique.
- `Decimal(12,2)` cho tiền; snapshot sản phẩm nằm ở `order_items`.
- `MemberPtPackage.sessionsReserved` giữ số buổi của booking PENDING/CONFIRMED; `sessionsUsed` chỉ tăng khi COMPLETED/NO_SHOW.
- `PtBooking.holdKey` unique khi PENDING/CONFIRMED, trả về null lúc REJECTED/CANCELLED/COMPLETED/NO_SHOW.
- `TrainerReview.bookingId` unique và rating có check 1–5; mỗi booking hoàn thành chỉ có một đánh giá.
- Payment lưu `requestedAt`, `expiresAt`, `confirmedAt`, `confirmedById`, thời điểm/lý do từ chối; Receipt chỉ gắn Payment PAID.
- Notification có `dedupeKey` nullable/unique; nhắc lịch PT dùng khóa này để không tạo lặp khi tải lại.
- `Checkin.recordedById` hiện là UUID scalar phục vụ truy vết, chưa khai báo relation Prisma đến `User`; `memberId` và `memberMembershipId` có foreign key.
- Quan hệ tài chính không cascade delete; OrderItem cascade theo Order, role/token cascade theo User.
- Index cho email token, membership, booking, check-in, order, payment và audit lookup.

Các enum trạng thái chính là `UserStatus`, `OrderStatus`, `PaymentStatus`, `PaymentMethod` và `BookingStatus`. Ứng dụng ghi/đọc `Date` theo UTC và dùng helper để quy đổi ranh giới ngày, hiển thị theo `Asia/Ho_Chi_Minh`.

## Quan hệ khái niệm

```mermaid
erDiagram
  User ||--o{ UserRole : has
  Role ||--o{ UserRole : grants
  User ||--o{ EmailVerificationToken : verifies
  User ||--o| MemberProfile : owns
  User ||--o| TrainerProfile : owns
  User ||--o{ Order : places
  User ||--o{ Payment : confirms
  User ||--o{ PtBooking : resolves
  User ||--o{ Notification : receives
  User ||--o{ AuditLog : acts

  MemberProfile ||--o{ MemberMembership : receives
  MembershipPlan ||--o{ MemberMembership : activates
  OrderItem ||--o| MemberMembership : creates
  MemberMembership ||--o{ Checkin : applies
  MemberProfile ||--o{ Checkin : records

  MemberProfile ||--o{ MemberPtPackage : receives
  PtPackage ||--o{ MemberPtPackage : activates
  OrderItem ||--o| MemberPtPackage : creates

  TrainerProfile ||--o{ PtSlot : opens
  PtSlot ||--o{ PtBooking : contains
  MemberProfile ||--o{ PtBooking : books
  MemberPtPackage ||--o{ PtBooking : funds
  TrainerProfile ||--o{ TrainerReview : receives
  MemberProfile ||--o{ TrainerReview : writes
  PtBooking ||--o| TrainerReview : verifies

  Order ||--o{ OrderItem : snapshots
  Order ||--o{ Payment : paid_by
  Payment ||--o| Receipt : issues
```

Quan hệ chỉ mang tính khái niệm trong sơ đồ trên nhưng khớp schema hiện tại. Riêng `Checkin.recordedById` không vẽ thành quan hệ vì database hiện chưa có foreign key tương ứng.

