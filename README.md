# Titan Gym Management System

Responsive Web App quản lý một phòng Gym, triển khai theo `GYM_Management_Master_Plan_V1.4.docx`. Hệ thống có 4 vai trò (Chủ phòng, Lễ tân, Huấn luyện viên, Hội viên), OTP email, phân quyền, gói Gym/PT, lịch PT, check-in, quản lý thanh toán, phiếu thu PDF và dashboard doanh thu.

> Toàn bộ thanh toán trong hệ thống là **MÔ PHỎNG**, không kết nối ngân hàng và không có giá trị thanh toán hoặc thuế.

## Công nghệ

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router.
- Backend: NestJS 12, TypeScript, Swagger, JWT/Passport, Nodemailer, PDFKit.
- Database: PostgreSQL 17, Prisma ORM, migration có version.
- Hạ tầng local: Docker Compose.

## Chạy dự án trên máy hiện tại để demo

Các dependency, file `.env`, migration và dữ liệu mẫu đã được chuẩn bị trên máy này. Mỗi lần cần demo, mở Docker Desktop, mở PowerShell tại thư mục `D:\QuanLyPhongGym` và chạy đúng hai lệnh:

```powershell
docker compose up -d   # Bật PostgreSQL; chạy lặp lại lệnh này vẫn an toàn
docker compose ps      # Kiểm tra gym-management-db phải ở trạng thái healthy
npm run dev            # Chạy đồng thời Backend API và Frontend Web
```

Chỉ chạy `npm run dev` sau khi kết quả `docker compose ps` hiển thị `gym-management-db` là `Up ... (healthy)`. Nếu Docker Desktop đang tắt hoặc container chưa `healthy`, backend sẽ không kết nối được database.

Khi terminal báo Vite và NestJS đã khởi động, truy cập:

- Web: http://localhost:5173
- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs

Sau khi demo:

1. Nhấn `Ctrl+C` trong terminal để dừng Backend và Frontend.
2. Nếu không dùng PostgreSQL nữa, chạy `docker compose down`. Dữ liệu trong database vẫn được giữ lại.

Nếu PostgreSQL đã chạy sẵn thì chỉ cần `npm run dev`.

## Cài đặt lần đầu trên một máy khác

Phần này **không cần chạy lại trên máy hiện tại**. Yêu cầu: Node.js 22+, npm và Docker Desktop.

```powershell
Copy-Item backend/.env.example backend/.env
npm install
npm install --prefix backend
npm install --prefix frontend
docker compose up -d
docker compose ps
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Trước khi chạy, cần mở `backend/.env` và thay `JWT_SECRET`, `SEED_PASSWORD`; cấu hình SMTP nếu muốn gửi OTP Gmail thật.

## Tài khoản mẫu

Mật khẩu lấy từ `SEED_PASSWORD` trong `backend/.env` (workspace local hiện dùng `Gym@123456`). Hãy đổi giá trị này khi triển khai.

| Vai trò | Email |
|---|---|
| Owner / Chủ phòng | `vhoanglong54@gmail.com` |
| Lễ tân | `letan@gym.local` |
| PT | `minhanh.pt@gym.local` |
| PT | `quanghuy.pt@gym.local` |
| PT | `thaovy.pt@gym.local` |
| Hội viên – có gói Gym đã thanh toán | `khanhbang@gym.local` |
| Hội viên – có đơn chờ thanh toán | `thuha@gym.local` |
| Hội viên – có đơn đã hủy | `gialinh@gym.local` |
| Hội viên – có gói PT để đặt lịch | `hoangnam@gym.local` |

## OTP email

Development mặc định dùng OTP dự phòng `123456`. Để gửi Gmail thật, điền `SMTP_USER`, `SMTP_PASS` (Gmail App Password) và `SMTP_FROM` trong `backend/.env`. Production bắt buộc tắt `DEV_OTP_ENABLED` và cấu hình SMTP thật.

## Quy tắc gói tập

- Gói Gym thống nhất theo thời hạn: **1 tháng (30 ngày), 2 tháng (60 ngày), 3 tháng (90 ngày)**.
- Thời hạn tính liên tục từ lúc kích hoạt. Nếu gia hạn khi gói cũ còn hiệu lực, gói mới bắt đầu sau thời điểm kết thúc cuối cùng nên không bị chồng ngày.
- Check-in ghi nhận ngày đến tập và gắn rõ với gói Gym được Lễ tân/Chủ phòng chọn; mỗi hội viên chỉ được ghi nhận một lần trong ngày.
- Gói PT tính theo số buổi. Chỉ khi PT đánh dấu lịch là **Hoàn thành** thì hệ thống mới trừ một buổi.

## Ý nghĩa các lệnh

| Lệnh | Khi nào cần chạy |
|---|---|
| `docker compose up -d` | Bật PostgreSQL trước khi chạy ứng dụng. Có thể chạy lại an toàn. |
| `docker compose ps` | Kiểm tra trạng thái PostgreSQL; không khởi động, dừng hoặc thay đổi dữ liệu. Chờ đến khi `gym-management-db` hiển thị `healthy`. |
| `npm run dev` | Lệnh dùng hằng ngày và khi demo; chạy đồng thời API và Web ở chế độ development. |
| `npm run build` | Biên dịch `backend` vào `backend/dist` và `frontend` vào `frontend/dist`; chỉ cần khi kiểm tra hoặc triển khai production, không cần trước mỗi lần demo. |
| `npm run test` | Chạy test backend và lint frontend; không bắt buộc khi demo. |
| `npm run db:migrate` | Chỉ dùng lần đầu hoặc sau khi schema database thay đổi. |
| `npm run db:seed` | Tạo/cập nhật an toàn tài khoản, gói, ca PT và giao dịch mẫu. Không cần chạy mỗi lần mở ứng dụng. |
| `docker compose down` | Dừng PostgreSQL sau khi sử dụng; không xóa dữ liệu trong volume. |

Tóm tắt quy trình demo:

```powershell
docker compose up -d
docker compose ps
npm run dev
```

Không commit `.env`. Schema và migration nằm tại `backend/prisma/`. Bộ tài liệu kỹ thuật nằm trong `docs/`.

## Chạy song song trên nhiều máy trong mạng LAN

Chỉ máy chủ cần chạy Docker, PostgreSQL, Backend và Frontend. Các máy còn lại phải cùng Wi-Fi/LAN và mở địa chỉ IP của máy chủ.

Trên máy chủ, chạy ba lệnh như quy trình phía trên, sau đó tìm IPv4 nội bộ:

```powershell
Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*' } |
  Select-Object IPAddress
```

Ví dụ máy chủ có IP `192.168.1.20`, các máy khác truy cập `http://192.168.1.20:5173`. Khi Windows hỏi quyền mạng cho Node.js, chọn cho phép trên **Private networks**. Máy chủ phải luôn bật Docker và terminal `npm run dev` trong suốt buổi test.

Mỗi trình duyệt lưu phiên đăng nhập riêng nên nhiều máy có thể đăng nhập các vai trò khác nhau cùng lúc. Frontend trên máy khách tự gọi API tại IP máy chủ, còn mọi API cùng đọc/ghi một PostgreSQL duy nhất. Vì vậy dữ liệu đơn hàng, lịch PT, hội viên và check-in là giống nhau giữa các máy. Trang giao dịch tự tải lại dữ liệu mỗi 5 giây.

PostgreSQL chạy trong container `gym-management-db`; cổng `5432` chỉ được nối vào `127.0.0.1` của máy chủ để các máy khác không truy cập database trực tiếp. Backend dùng Prisma kết nối đến database này, còn trình duyệt chỉ gọi Backend qua cổng `3000`. Volume Docker `gym_postgres_data` lưu dữ liệu trên máy chủ, nên `docker compose down` chỉ dừng dịch vụ và vẫn giữ dữ liệu. **Không chạy `docker compose down -v`** nếu không muốn xóa toàn bộ database.

Hướng dẫn thao tác và kịch bản kiểm thử đầy đủ: [docs/10-UI-Test-Guide.md](docs/10-UI-Test-Guide.md).

