# Kiến trúc hệ thống

Tài liệu này mô tả kiến trúc đang được triển khai trong mã nguồn. Backend là một **modular monolith**, không phải hệ microservice; Frontend và Backend được deploy thành hai Vercel Project độc lập nhưng dùng chung một PostgreSQL production.

## 1. System context

```mermaid
flowchart LR
  Owner[Chủ phòng]
  Receptionist[Lễ tân]
  Trainer[PT]
  Member[Hội viên]

  SPA[React SPA<br/>Vite + React Router]
  API[NestJS REST API<br/>JWT + RBAC]
  DB[(PostgreSQL<br/>Prisma ORM)]
  SMTP[Gmail SMTP<br/>gửi OTP]
  PDF[PDFKit + DejaVu Sans<br/>tạo phiếu thu]

  Owner --> SPA
  Receptionist --> SPA
  Trainer --> SPA
  Member --> SPA
  SPA -->|HTTPS / REST / JSON<br/>Bearer JWT| API
  API -->|Prisma queries + transactions| DB
  API -->|Nodemailer| SMTP
  API -->|PDF stream| PDF
  PDF -->|application/pdf| SPA
```

Trình duyệt không kết nối trực tiếp PostgreSQL hoặc SMTP. QR chứa mã Hội viên; việc đọc QR diễn ra tại trình duyệt của Lễ tân/Chủ phòng, sau đó Frontend gọi API để kiểm tra và ghi nhận check-in.

## 2. Cấu trúc container khi deploy

```mermaid
flowchart TB
  Browser[Trình duyệt desktop/mobile]

  subgraph Vercel[Vercel]
    Web[titan-gym-web<br/>React/Vite static deployment]
    Api[titan-gym-api<br/>NestJS deployment]
  end

  Neon[(PostgreSQL cloud / Neon)]
  Gmail[Gmail SMTP]

  Browser -->|HTTPS| Web
  Browser -->|HTTPS /api| Api
  Api -->|DATABASE_URL + TLS| Neon
  Api -->|SMTP TLS| Gmail
```

- Frontend production: `https://titan-gym-web.vercel.app`.
- Backend production: `https://titan-gym-api.vercel.app/api`.
- Swagger: `https://titan-gym-api.vercel.app/api/docs`.
- Local dùng React `:5173`, NestJS `:3000` và PostgreSQL 17 trong Docker ở `127.0.0.1:5432`.
- `FRONTEND_URL` là allow-list CORS của Backend; `VITE_API_URL` trỏ Frontend đến Backend.

## 3. Cấu trúc Backend

```mermaid
flowchart TB
  Request[HTTP request]
  Pipe[ValidationPipe<br/>whitelist + transform]
  AuthGuard[Public: bỏ qua<br/>Protected: JwtAuthGuard]
  RoleGuard[RolesGuard nếu route<br/>khai báo @Roles]
  Filter[ApiExceptionFilter]

  subgraph Modules[NestJS AppModule]
    Auth[AuthModule<br/>đăng ký, OTP, đăng nhập]
    Users[UsersModule<br/>hồ sơ, hội viên, nhân sự]
    Catalog[CatalogModule<br/>gói Gym và PT]
    Orders[OrdersModule<br/>đơn, payment, receipt]
    Operations[OperationsModule<br/>slot, booking, review, check-in]
    Reports[ReportsModule<br/>dashboard, đối soát]
    Notifications[NotificationsModule<br/>thông báo trong ứng dụng]
  end

  Prisma[PrismaModule / PrismaService]
  Database[(PostgreSQL)]

  Request --> AuthGuard --> RoleGuard --> Pipe
  Pipe --> Auth
  Pipe --> Users
  Pipe --> Catalog
  Pipe --> Orders
  Pipe --> Operations
  Pipe --> Reports
  Pipe --> Notifications
  Orders --> Notifications
  Operations --> Notifications
  Auth --> Prisma
  Users --> Prisma
  Catalog --> Prisma
  Orders --> Prisma
  Operations --> Prisma
  Reports --> Prisma
  Notifications --> Prisma
  Prisma --> Database
  AuthGuard -. lỗi .-> Filter
  RoleGuard -. lỗi .-> Filter
  Orders -. lỗi nghiệp vụ .-> Filter
  Operations -. lỗi nghiệp vụ .-> Filter
```

Mỗi module theo cấu trúc `Controller → Service → PrismaService`:

1. Controller nhận route/DTO và trả response envelope.
2. Route public bỏ qua JWT; route bảo vệ dùng `JwtAuthGuard`, và `RolesGuard` chỉ áp dụng khi controller/handler khai báo `@Roles`.
3. Sau guard, `ValidationPipe` loại field thừa, chuyển kiểu và kiểm tra DTO trước khi controller nhận body/query.
4. Orders và Operations còn kiểm tra role, ownership và chuyển trạng thái trong service vì quyền phụ thuộc bản ghi cụ thể.
5. Service thực hiện nghiệp vụ; các luồng payment, đặt/hủy/hoàn thành PT và check-in quan trọng chạy trong database transaction.
6. `ApiExceptionFilter` chuẩn hóa lỗi thành `success`, `errorCode` và `message`.

## 4. Cấu trúc Frontend

```mermaid
flowchart TB
  Router[React Router / App.tsx]
  Protected[ProtectedRoute]
  RoleRoute[RoleRoute + menu theo role]
  Pages[Pages<br/>Auth, Dashboard, Packages, Orders,<br/>People, Schedule, Check-in, Reports]
  AuthContext[AuthContext<br/>user + JWT riêng từng tab]
  Axios[Axios client / lib/api.ts]
  API[NestJS API]

  Router --> Protected --> RoleRoute --> Pages
  AuthContext --> Protected
  AuthContext --> RoleRoute
  Pages --> Axios
  Axios -->|Authorization: Bearer JWT| API
  Axios -. HTTP 401 .-> AuthContext
```

Ẩn menu và `RoleRoute` chỉ là lớp trải nghiệm người dùng. Backend mới là nguồn quyết định quyền cuối cùng. Phiên đăng nhập dùng `sessionStorage` để các tab có thể đăng nhập các vai trò độc lập. Các màn hình nghiệp vụ tự đồng bộ định kỳ và khi tab được mở lại; dự án hiện không dùng WebSocket.

## 5. Nguồn sự thật kỹ thuật

Khi tài liệu và mã nguồn khác nhau, đối chiếu theo thứ tự:

1. Database: `backend/prisma/schema.prisma` và `backend/prisma/migrations/`.
2. API/quyền/nghiệp vụ: controller, DTO và service trong `backend/src/modules/`.
3. Route và hành vi giao diện: `frontend/src/App.tsx` và `frontend/src/pages/`.
4. Sơ đồ luồng: `Sequences.md` và `Collaboration.md` trong cùng thư mục này.
