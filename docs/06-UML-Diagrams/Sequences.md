# Sequence Diagram

Các sơ đồ mô tả những quy trình nghiệp vụ chính của Titan Gym. Chi tiết API, cơ sở dữ liệu và cách triển khai được lược bỏ để sơ đồ dễ đọc.

## 1. Đăng ký và xác thực tài khoản

```mermaid
sequenceDiagram
  actor M as Hội viên
  participant UI as Giao diện Titan Gym
  participant SYS as Hệ thống
  participant EMAIL as Email

  M->>UI: Nhập thông tin đăng ký
  UI->>SYS: Gửi yêu cầu đăng ký
  SYS->>SYS: Kiểm tra email và tạo tài khoản chờ xác thực
  SYS->>EMAIL: Gửi mã OTP
  EMAIL-->>M: Nhận mã OTP
  M->>UI: Nhập mã OTP
  UI->>SYS: Yêu cầu xác thực
  alt OTP hợp lệ
    SYS-->>UI: Kích hoạt tài khoản
    M->>UI: Đăng nhập
    UI->>SYS: Kiểm tra tài khoản
    SYS-->>UI: Đăng nhập thành công
  else OTP sai hoặc hết hạn
    SYS-->>UI: Thông báo lỗi hoặc yêu cầu gửi lại mã
  end
```

## 2. Mua gói và xác nhận thanh toán

```mermaid
sequenceDiagram
  actor M as Hội viên
  actor S as Lễ tân/Chủ phòng
  participant UI as Giao diện Titan Gym
  participant SYS as Hệ thống

  M->>UI: Chọn gói Gym hoặc gói PT
  UI->>SYS: Tạo đơn hàng
  SYS-->>UI: Đơn ở trạng thái Chờ thanh toán

  alt Hội viên báo đã chuyển khoản
    M->>UI: Chọn Tôi đã chuyển khoản
    UI->>SYS: Gửi yêu cầu xác nhận
    SYS-->>S: Thông báo giao dịch chờ duyệt
    S->>UI: Kiểm tra giao dịch
    alt Xác nhận hợp lệ
      UI->>SYS: Xác nhận thanh toán
      SYS->>SYS: Kích hoạt quyền lợi và tạo phiếu thu
      SYS-->>M: Thông báo thanh toán thành công
    else Từ chối
      UI->>SYS: Từ chối kèm lý do
      SYS-->>M: Thông báo lý do để gửi lại yêu cầu
    end
  else Thu tiền mặt tại quầy
    S->>UI: Chọn Thu tiền mặt
    UI->>SYS: Xác nhận đã thu tiền
    SYS->>SYS: Kích hoạt quyền lợi và tạo phiếu thu
    SYS-->>M: Thông báo thanh toán thành công
  end
```

Yêu cầu chuyển khoản chờ duyệt tối đa 48 giờ. Phiếu thu ghi rõ phương thức, thời gian và tài khoản Lễ tân/Chủ phòng đã xác nhận.

## 3. Đặt và xử lý lịch PT

```mermaid
sequenceDiagram
  actor M as Hội viên
  actor T as PT
  participant UI as Giao diện Titan Gym
  participant SYS as Hệ thống

  T->>UI: Mở khung giờ tập
  UI->>SYS: Lưu lịch trống
  M->>UI: Lọc ngày, lịch trống và đánh giá PT
  UI->>SYS: Yêu cầu đặt lịch
  SYS->>SYS: Giữ một buổi trong gói PT
  SYS-->>T: Thông báo yêu cầu mới

  alt PT xác nhận
    T->>UI: Xác nhận lịch
    UI->>SYS: Chuyển sang Đã xác nhận
    SYS-->>M: Thông báo lịch đã xác nhận
    alt Buổi tập hoàn thành
      T->>UI: Đánh dấu Hoàn thành
      UI->>SYS: Yêu cầu xác nhận hoàn thành
      alt Đã check-in Gym trước giờ PT
        SYS->>SYS: Ghi nhận đã dùng một buổi
        SYS-->>M: Thông báo buổi tập đã hoàn thành
      else Chưa check-in hoặc check-in muộn
        SYS-->>UI: Không cho hoàn thành
      end
    else Hội viên vắng mặt
      T->>UI: Đánh dấu Vắng mặt
      UI->>SYS: Ghi nhận đã dùng một buổi
    end
  else PT từ chối
    T->>UI: Từ chối và nhập lý do
    UI->>SYS: Chuyển lịch sang Từ chối
    SYS->>SYS: Hoàn lại buổi đang giữ
    SYS-->>M: Thông báo kết quả
  end

  alt Hủy sớm hoặc PT hủy
    M->>UI: Hủy trước ít nhất 4 giờ
    UI->>SYS: Hủy và hoàn buổi
    SYS-->>T: Thông báo lịch đã hủy
  else Hội viên hủy dưới 4 giờ
    M->>UI: Gửi lý do hủy muộn
    UI->>SYS: Chuyển sang Chờ duyệt hủy
    SYS-->>T: Thông báo yêu cầu hủy
    alt PT/Chủ phòng chấp nhận
      T->>UI: Chấp nhận hủy
      UI->>SYS: Hủy lịch và hoàn buổi
      SYS-->>M: Thông báo đã hủy
    else Từ chối
      T->>UI: Từ chối kèm lý do
      UI->>SYS: Đưa lịch về Đã xác nhận
      SYS-->>M: Thông báo lý do
    end
  end
```

Lịch `PENDING`, `CONFIRMED` hoặc `CANCEL_REQUESTED` giữ một buổi. `COMPLETED` và `NO_SHOW` dùng một buổi; `REJECTED` và `CANCELLED` hoàn lại buổi.
Chủ phòng có thể hỗ trợ xử lý lịch, nhưng chỉ PT mở khung giờ của chính mình.

## 4. Check-in bằng QR

```mermaid
sequenceDiagram
  actor M as Hội viên
  actor S as Lễ tân/Chủ phòng
  participant UI as Giao diện Titan Gym
  participant SYS as Hệ thống

  M->>UI: Mở QR cá nhân
  M-->>S: Xuất trình QR
  S->>UI: Quét QR hoặc nhập mã Hội viên
  UI->>SYS: Kiểm tra quyền lợi và lịch PT hôm nay
  SYS-->>UI: Trả thông tin Hội viên, gói và lịch PT
  opt Có lịch PT hôm nay
    UI-->>S: Hiển nhắc giờ tập và PT ngay khi quét
  end
  S->>UI: Chọn gói và xác nhận
  UI->>SYS: Ghi nhận check-in

  alt Chưa check-in hôm nay
    SYS->>SYS: Lưu lượt check-in
    SYS->>SYS: Tìm lịch PT hôm nay
    SYS-->>UI: Check-in thành công + lịch PT
  else Đã check-in hôm nay
    SYS->>SYS: Không ghi/trừ thêm, tìm lịch PT hôm nay
    SYS-->>UI: Kết quả đã check-in + lịch PT
    Note over S,UI: Lễ tân vẫn có thể cho Hội viên vào
  end
```

Hội viên chỉ hiển thị QR; quyền ghi nhận check-in thuộc Lễ tân hoặc Chủ phòng. Check-in không tự đổi booking, nhưng check-in không muộn hơn giờ bắt đầu là điều kiện để PT xác nhận hoàn thành.

## 5. Đánh giá nhân viên

```mermaid
sequenceDiagram
  actor M as Hội viên
  actor S as PT/Lễ tân
  actor O as Chủ phòng
  participant UI as Giao diện Titan Gym
  participant SYS as Hệ thống

  M->>UI: Mở Đánh giá nhân viên
  UI->>SYS: Lấy danh sách và điểm đánh giá
  SYS-->>UI: Trả PT/Lễ tân đang làm việc
  M->>UI: Mở hồ sơ, chọn sao và nhập nhận xét
  UI->>SYS: Tạo hoặc cập nhật đánh giá
  SYS-->>S: Thông báo có đánh giá
  SYS-->>UI: Cập nhật điểm và bài đánh giá
  O->>UI: Mở Nhân sự và xem phản hồi
  UI->>SYS: Lấy chi tiết đánh giá
  SYS-->>O: Trả điểm và danh sách nhận xét
```

Mỗi Hội viên có một bài trên mỗi nhân viên và có thể cập nhật; không yêu cầu từng đặt lịch PT với người được đánh giá.
