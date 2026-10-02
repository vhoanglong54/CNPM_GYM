# Deployment Guide

## Local/Demo

1. Cài Node.js 22+, npm và Docker Desktop.
2. `docker compose up -d`.
3. Sao chép `.env.example` thành `.env`; đổi `JWT_SECRET`, `SEED_PASSWORD`.
4. `npm install` ở root, backend, frontend.
5. `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`.
6. `npm run dev`; mở web `:5173`, Swagger `:3000/api/docs`.

## Gmail SMTP

1. Bật xác minh 2 bước cho tài khoản Gmail gửi thư.
2. Tạo App Password, điền `SMTP_USER`/`SMTP_PASS`.
3. Giữ `SMTP_HOST=smtp.gmail.com`, port 587, `SMTP_SECURE=false`.
4. Đặt `DEV_OTP_ENABLED=false` trong production.

## Production checklist

- Dùng PostgreSQL managed/volume backup, tài khoản DB quyền tối thiểu.
- `NODE_ENV=production`, secret ngẫu nhiên dài, HTTPS và origin frontend chính xác.
- Chạy `npm run db:deploy --prefix backend`, không dùng `migrate dev`.
- Build: `npm run build`; chạy API bằng `npm run start:prod --prefix backend`; phục vụ `frontend/dist` qua CDN/Nginx.
- Không đưa `.env`, Gmail App Password, JWT secret hoặc dữ liệu cá nhân vào Git.
- Tắt OTP development; kiểm tra SMTP, receipt và 4 tài khoản demo trước buổi bảo vệ.

