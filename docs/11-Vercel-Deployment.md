# Deploy Titan Gym lên Vercel

Dự án dùng một Git repository nhưng tạo hai Vercel Project độc lập. PostgreSQL local trong Docker chỉ dùng khi phát triển; production dùng PostgreSQL được quản lý như Neon, Supabase hoặc Prisma Postgres.

## Các địa chỉ production và cách sử dụng

| Địa chỉ | Dành cho ai | Tác dụng |
|---|---|---|
| [Frontend Titan Gym](https://titan-gym-web.vercel.app) | Chủ phòng, Lễ tân, PT và Hội viên | **Link chính để mở và thao tác ứng dụng:** đăng nhập, mua gói, giao dịch, lịch PT, check-in, hồ sơ và dashboard. |
| [Backend API](https://titan-gym-api.vercel.app/api) | Frontend và người vận hành hệ thống | Cung cấp dữ liệu/nghiệp vụ cho Frontend. Mở trực tiếp chỉ để kiểm tra health; kết quả bình thường là JSON có trạng thái `ok`, không phải trang giao diện. |
| [Swagger](https://titan-gym-api.vercel.app/api/docs) | Lập trình viên và người kiểm thử API | Hiển thị danh sách endpoint, DTO và cho phép gửi request thử. Không dùng thay Frontend; các request POST/PATCH/DELETE có thể thay đổi dữ liệu production. |

Khi demo hoặc sử dụng nghiệp vụ, luôn bắt đầu tại **Frontend**. Trình duyệt sẽ tự gọi Backend API; người dùng thông thường không cần mở API hoặc Swagger.

## 1. Chuẩn bị database cloud

1. Tạo PostgreSQL database trong Vercel Marketplace. Neon phù hợp cho bản demo.
2. Sao chép connection string có TLS và connection pooling vào `DATABASE_URL`.
3. Chạy migration từ máy local bằng PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require'
npm run db:deploy --prefix backend
```

4. Nếu cần dữ liệu mẫu, cấu hình tạm `OWNER_EMAIL` và `SEED_PASSWORD`, rồi chạy:

```powershell
$env:OWNER_EMAIL = 'owner@example.com'
$env:SEED_PASSWORD = 'replace-with-a-strong-password'
npm run db:seed --prefix backend
```

Không đặt migration hoặc seed vào build command của Vercel. Preview deployment có thể build đồng thời và gây tranh chấp migration; seed chỉ nên chạy có chủ đích.

## 2. Tạo Backend Project

Import Git repository vào Vercel và cấu hình:

- Project name: `titan-gym-api` (có thể đổi tên).
- Root Directory: `backend`.
- Framework Preset: Vercel tự nhận NestJS.
- Build Command: dùng mặc định `npm run build`.

Environment Variables cho Production:

```text
NODE_ENV=production
DATABASE_URL=<connection string PostgreSQL cloud>
FRONTEND_URL=https://titan-gym-web.vercel.app
JWT_SECRET=<chuỗi ngẫu nhiên dài và bí mật>
JWT_EXPIRES_IN=8h
OTP_EXPIRES_MINUTES=5
OTP_RESEND_SECONDS=60
DEV_OTP_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<tài khoản SMTP>
SMTP_PASS=<mật khẩu ứng dụng SMTP>
SMTP_FROM=Titan Gym <no-reply@example.com>
OWNER_EMAIL=<email chủ phòng>
SEED_PASSWORD=<chỉ cần khi chạy seed thủ công>
```

Sau khi deploy, kiểm tra [Backend API](https://titan-gym-api.vercel.app/api) trả JSON trạng thái `ok`. Dùng [Swagger](https://titan-gym-api.vercel.app/api/docs) khi cần kiểm tra chi tiết endpoint.

Nếu tên miền frontend thực tế khác ví dụ trên, sửa `FRONTEND_URL` rồi redeploy backend. Có thể khai báo nhiều URL, phân cách bằng dấu phẩy.

## 3. Tạo Frontend Project

Import cùng Git repository lần thứ hai và cấu hình:

- Project name: `titan-gym-web` (có thể đổi tên).
- Root Directory: `frontend`.
- Framework Preset: Vite.
- Build Command: dùng mặc định `npm run build`.
- Output Directory: `dist`.

Environment Variable cho Production:

```text
VITE_API_URL=https://titan-gym-api.vercel.app/api
```

Deploy frontend. File `frontend/vercel.json` đã cấu hình fallback cho React Router, vì vậy tải trực tiếp `/checkin`, `/orders` hoặc các route khác sẽ trả về ứng dụng thay vì lỗi 404.

## 4. Quy trình cập nhật

- Push vào `main`: Vercel tự build và cập nhật production.
- Push branch khác hoặc mở pull request: Vercel tạo Preview Deployment.
- Thay environment variable: redeploy project tương ứng để build mới nhận giá trị.
- Thay `schema.prisma`: tạo migration ở local, commit migration, chạy `prisma migrate deploy` có chủ đích cho database production.

Frontend preview dùng tên miền ngẫu nhiên và mặc định không nằm trong CORS production. Khi cần test preview với API, thêm chính xác URL preview vào `FRONTEND_URL`; không nên cho phép toàn bộ `*.vercel.app` trong production.

## 5. Checklist sau deploy

- API `/api` trả về trạng thái `ok`.
- Frontend đăng nhập và tải danh mục thành công.
- Refresh trực tiếp các route không bị 404.
- Camera mở được sau khi người dùng cấp quyền.
- OTP email hoạt động và `DEV_OTP_ENABLED=false`.
- Không có request HTTP hoặc lỗi mixed content trong DevTools.
- Không đưa `.env`, mật khẩu SMTP, JWT secret hoặc connection string vào Git.
