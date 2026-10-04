# Hướng dẫn thao tác và kiểm thử giao diện

Tài liệu này dùng để kiểm tra từng chức năng và luồng phối hợp giữa Chủ phòng, Lễ tân, PT và Hội viên. Mật khẩu của toàn bộ tài khoản mẫu là giá trị `SEED_PASSWORD` do người quản trị môi trường cung cấp; không ghi mật khẩu production vào tài liệu hoặc Git.

## 1. Chuẩn bị hệ thống

### 1.1 Kiểm thử bản production trên Vercel

Đây là cách mặc định khi demo hoặc kiểm thử trên máy tính và điện thoại. Không cần mở Docker Desktop, chạy lệnh hay kết nối cùng Wi-Fi.

| Địa chỉ | Mục đích | Có dùng để thao tác giao diện không? |
|---|---|---|
| [Frontend Titan Gym](https://titan-gym-web.vercel.app) | Mở ứng dụng để đăng nhập và thực hiện toàn bộ kịch bản bên dưới. | **Có — người dùng mở link này.** |
| [Backend API](https://titan-gym-api.vercel.app/api) | Kiểm tra dịch vụ backend còn hoạt động; kết quả là JSON trạng thái `ok`. Frontend tự gọi địa chỉ này. | Không. |
| [Swagger API](https://titan-gym-api.vercel.app/api/docs) | Xem tài liệu và thử các API dành cho lập trình viên/kiểm thử kỹ thuật. Một số lệnh có thể thay đổi dữ liệu production. | Không phải giao diện nghiệp vụ. |

Các bước chuẩn bị:

1. Mở [https://titan-gym-web.vercel.app](https://titan-gym-web.vercel.app) bằng Chrome hoặc Edge độc lập.
2. Dùng cửa sổ ẩn danh, hồ sơ trình duyệt khác hoặc thiết bị khác cho mỗi vai trò cần quan sát đồng thời.
3. Trên thiết bị quét QR, cho phép quyền camera khi trình duyệt hỏi. Link production dùng HTTPS nên đáp ứng yêu cầu secure context của camera.
4. Nếu ứng dụng không tải dữ liệu, kiểm tra [Backend API](https://titan-gym-api.vercel.app/api). Chỉ dùng Swagger khi cần kiểm tra request/response API.

### 1.2 Kiểm thử môi trường local khi phát triển

Chỉ dùng phần này khi cần chạy và sửa mã trên máy. Mở Docker Desktop, sau đó chạy tại `D:\QuanLyPhongGym`:

```powershell
docker compose up -d
docker compose ps
npm run dev
```

Chỉ tiếp tục khi `docker compose ps` hiển thị `gym-management-db` ở trạng thái `healthy`, terminal báo Backend chạy cổng `3000` và Vite chạy cổng `5173`.

- Test trên máy chủ: mở `http://localhost:5173` bằng Chrome hoặc Edge độc lập. Không dùng tab xem trước/trình duyệt tích hợp của VS Code khi cần quét camera.
- Test nhiều máy: các máy cùng Wi-Fi/LAN mở `http://<IP-máy-chủ>:5173`.
- Mỗi máy hoặc mỗi hồ sơ trình duyệt chỉ nên đăng nhập một vai trò để quan sát đồng thời.
- Nếu cần dựng lại các bản ghi mẫu, chạy `npm run db:seed`. Lệnh có thể chạy lại và không tạo trùng các bản ghi seed cố định.

### 1.3 Kiểm tra đồng bộ mà không tải lại trang

- Thanh trên cùng hiển thị **Đang đồng bộ...** khi còn request, **Đã đồng bộ** khi hoàn tất và **Mất kết nối** khi trình duyệt offline.
- Sau thao tác thành công, giao diện hiện tại phải đổi trạng thái ngay; không bấm reload trình duyệt.
- Các tab Titan Gym khác cùng trình duyệt nhận tín hiệu thay đổi và tự lấy dữ liệu phù hợp với tài khoản đang đăng nhập trên chính tab đó.
- Tab ẩn không gửi polling nền liên tục. Khi quay lại tab, dữ liệu tự làm mới; polling 30 giây chỉ là dự phòng cho thay đổi không phát sinh từ giao diện.
- Phản hồi tải cũ không được phép ghi đè kết quả vừa thanh toán, hủy đơn, đổi lịch, check-in, sửa nhân sự, gửi đánh giá hoặc đọc thông báo.

## 2. Tài khoản và dữ liệu có sẵn

| Vai trò | Tài khoản | Dùng để kiểm thử |
|---|---|---|
| Chủ phòng | `vhoanglong54@gmail.com` | Dashboard, toàn bộ đơn hàng, gói, nhân sự, hội viên |
| Lễ tân | `letan@gym.local` | Xem/xác nhận giao dịch, check-in |
| PT | `minhanh.pt@gym.local` | Tạo ca trống, xử lý lịch hẹn |
| PT | `quanghuy.pt@gym.local` | Test nhiều PT và lọc ca |
| PT | `thaovy.pt@gym.local` | Test nhiều PT và lọc ca |
| Hội viên | `khanhbang@gym.local` | Có gói Gym đã thanh toán |
| Hội viên | `thuha@gym.local` | Có sẵn đơn chờ thanh toán |
| Hội viên | `gialinh@gym.local` | Có sẵn đơn đã hủy |
| Hội viên | `hoangnam@gym.local` | Có gói PT 12 buổi để đặt lịch |

Dữ liệu mẫu gồm 3 gói Gym (1, 2, 3 tháng), 3 gói PT (8, 12, 24 buổi), 6 ca PT trống và các giao dịch ở ba trạng thái. Không dùng tài khoản Chủ phòng để thử xóa dữ liệu nền tảng.

## 3. Luồng đăng ký và xác thực email

1. Ở màn hình đăng nhập, chọn **Tạo tài khoản hội viên**.
2. Nhập email chưa tồn tại, họ tên, mật khẩu hợp lệ và nhập lại chính xác mật khẩu. Có thể dùng biểu tượng con mắt riêng ở từng ô để kiểm tra nội dung trước khi gửi.
3. Mở email nhận mã OTP, nhập mã và xác nhận.
4. Quay về đăng nhập bằng tài khoản vừa tạo.

Kết quả mong đợi:

- Email của tài khoản ACTIVE/INACTIVE báo đã tồn tại. Email của đăng ký còn UNVERIFIED tiếp tục đăng ký cũ và cấp/gợi ý gửi lại OTP; cả hai trường hợp đều không tạo User trùng.
- Hai ô mật khẩu không khớp phải hiển thị cảnh báo và không cho gửi đăng ký; trường `confirmPassword` chỉ được kiểm tra tại giao diện và không gửi lên API.
- OTP đúng kích hoạt tài khoản; OTP sai hoặc hết hạn bị từ chối.
- Sau khi đăng nhập, người dùng chỉ thấy menu dành cho Hội viên.

Production đã tắt OTP development và sử dụng SMTP đã cấu hình. Với môi trường local chưa cấu hình SMTP thật và `DEV_OTP_ENABLED=true`, backend có thể dùng OTP dự phòng phục vụ phát triển. Khi test gửi mail local phải kiểm tra `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` trong `backend/.env`.

## 4. Luồng mua gói và theo dõi giao dịch giữa các vai trò

Đây là luồng nên test bằng hai máy hoặc hai hồ sơ trình duyệt:

- Máy A đăng nhập Hội viên `thuha@gym.local`.
- Máy B đăng nhập Lễ tân `letan@gym.local` hoặc Chủ phòng `vhoanglong54@gmail.com`.

### 4.1 Tạo đơn

1. Máy A vào **Gói tập**.
2. Chọn một gói Gym hoặc gói PT; kiểm tra hộp tóm tắt tên gói, quyền lợi và số tiền xuất hiện nhưng chưa tạo đơn.
3. Chọn **Xác nhận mua gói** một lần; thử bấm nhanh nhiều lần và bảo đảm chỉ tạo đúng một đơn.
4. Máy A được chuyển sang **Giao dịch**, đơn mới được làm nổi bật.
5. Máy B cũng mở **Giao dịch**; đơn phải tự xuất hiện, không reload trình duyệt.

Kết quả mong đợi:

- Đơn mới có trạng thái **Chờ thanh toán** trên cả hai máy.
- Hội viên chỉ thấy đơn của chính mình.
- Lễ tân và Chủ phòng thấy đơn của tất cả hội viên.
- Mã đơn, hội viên, tên gói và số tiền giống nhau giữa hai máy.

### 4.2 Xác nhận thanh toán tại quầy

1. Trên máy B, tìm đơn mới tạo và kiểm tra chỉ có nhãn **Chờ Hội viên xác nhận**, không có nút xác nhận thu.
2. Trên máy A, Hội viên chọn **Xác nhận thanh toán** → **Tôi đã trả tiền mặt** sau khi giao tiền tại quầy.
3. Kiểm tra Order vẫn chờ, chưa có Phiếu thu/quyền lợi; máy B tự hiện nút **Xác nhận đã thu**.
4. Trên máy B, chọn **Xác nhận đã thu** và xác nhận hộp thoại.
5. Quan sát tiến trình chuyển sang **Hoàn tất**; máy A tự đổi thành **Đã thanh toán** mà không reload trình duyệt.
6. Máy A mở **Hồ sơ** để kiểm tra gói vừa mua đã xuất hiện trong quyền lợi.
7. Ở cả hai máy, chọn **Phiếu thu** để kiểm tra PDF.

Kết quả mong đợi:

- Nhân viên không thể xác nhận thu trước thao tác của Hội viên; kể cả gọi API trực tiếp cũng phải nhận lỗi 403.
- Hệ thống chỉ tạo một khoản thanh toán và một phiếu thu.
- Đơn chuyển sang **Đã thanh toán** và không còn nút thanh toán/hủy.
- Gói Gym hoặc số buổi PT được kích hoạt tự động.
- Phiếu thu ghi đúng họ tên, email, vai trò và thời gian của tài khoản Lễ tân/Chủ phòng xác nhận.
- Dashboard Chủ phòng cập nhật tổng giao dịch và doanh thu.

### 4.3 Hội viên gửi yêu cầu xác nhận chuyển khoản

1. Tạo một đơn khác bằng tài khoản Hội viên.
2. Tại **Giao dịch**, Hội viên chọn **Xác nhận thanh toán** → **Tôi đã chuyển khoản**.
3. Kiểm tra Order vẫn chờ, giao diện hiện **Chờ nhân viên duyệt**, chưa có Phiếu thu và chưa kích hoạt gói.
4. Lễ tân/Chủ phòng mở **Giao dịch** và chọn **Xác nhận đã nhận CK** hoặc **Từ chối**.
5. Nếu từ chối, nhập lý do tối thiểu 3 ký tự; Hội viên kiểm tra lý do rồi gửi lại yêu cầu.
6. Nếu xác nhận, Hội viên kiểm tra trạng thái PAID, quyền lợi và Phiếu thu.

Kết quả mong đợi: Hội viên phải tạo yêu cầu trước; sau đó chỉ Lễ tân/Chủ phòng có thể chuyển giao dịch sang PAID. Yêu cầu quá 48 giờ thành hết hạn; hệ thống hiện chỉ ghi nhận nội bộ, chưa kết nối cổng ngân hàng thật.

### 4.4 Hủy đơn

1. Tạo một đơn mới nhưng chưa thanh toán.
2. Chọn biểu tượng **Hủy đơn** và xác nhận.
3. Kiểm tra trên Hội viên, Lễ tân và Chủ phòng.

Kết quả mong đợi:

- Đơn chuyển sang **Đã hủy** trên các máy.
- Không thể thanh toán hoặc xuất phiếu thu cho đơn đã hủy.
- Không sinh quyền lợi Gym/PT.

## 5. Luồng lịch PT

### 5.1 PT mở ca trống

1. Đăng nhập `minhanh.pt@gym.local`.
2. Vào **Lịch PT**, nhập ngày giờ bắt đầu/kết thúc và chọn **Mở ca**.
3. Kiểm tra ca mới xuất hiện trong danh sách.

Kết quả mong đợi: chỉ PT có thể tạo ca của chính mình; thời gian kết thúc phải sau thời gian bắt đầu.

### 5.2 Hội viên đặt lịch

1. Ở máy khác đăng nhập `hoangnam@gym.local`.
2. Vào **Lịch PT**, chọn ngày muốn tập và thử sắp xếp theo **Lịch trống sớm nhất**, **Đánh giá cao nhất** hoặc **Nhiều lượt đánh giá nhất**.
3. Chọn một ca trống, chọn gói `PT 12 Buổi`, nhập ghi chú nếu cần và gửi yêu cầu.
4. Quay lại máy PT; yêu cầu phải tự xuất hiện mà không reload trình duyệt.

Kết quả mong đợi:

- Lịch ở trạng thái **Chờ xác nhận**.
- Gói PT tăng **đang giữ** một buổi và giảm **khả dụng** một buổi, nhưng chưa tăng số buổi đã dùng.
- Ca đã chọn không còn nhận thêm lịch đặt trùng.
- Hội viên không thể đặt một ca khác bị trùng giờ hoặc vượt số buổi khả dụng.
- PT nhìn thấy tên hội viên, ca và ghi chú.

### 5.3 PT xác nhận và hoàn thành

1. PT chọn **Xác nhận** cho yêu cầu đang chờ.
2. Hội viên kiểm tra trạng thái đổi thành **Đã xác nhận**.
3. Trong khoảng 60 phút trước giờ bắt đầu đến 5 phút sau giờ kết thúc, Lễ tân quét QR và xác nhận tại quầy.
4. Nếu Hội viên đã check-in Gym từ trước trong ngày, quét lại và chọn **Xác nhận điểm danh lịch PT**; hệ thống không tạo thêm lượt Gym.
5. Ngay sau giờ kết thúc, mở lại **Lịch PT**: nếu đã điểm danh, booking phải chuyển **Chờ PT xác nhận hoàn thành**.
6. PT chọn **Hoàn thành**, sau đó Hội viên mở **Hồ sơ** và kiểm tra số buổi còn lại giảm một.
7. Tạo lịch khác, không quét trong cửa sổ điểm danh và chờ hết thời gian đệm: hệ thống tự chuyển **Vắng mặt**, trừ một buổi và gửi thông báo.

Kết quả mong đợi: luồng có mặt đi `Chờ xác nhận → Đã xác nhận → Chờ PT xác nhận hoàn thành → Hoàn thành`; luồng không điểm danh tự đi đến `Vắng mặt`. Không có xác nhận ngoại lệ và một lịch chỉ bị trừ đúng một buổi.

### 5.4 Hủy lịch

1. Hủy booking PENDING từ Hội viên: lịch chuyển **Đã hủy**, PT nhận thông báo và buổi đang giữ được hoàn.
2. Với booking CONFIRMED còn trên 4 giờ, Hội viên hủy trực tiếp: kết quả giống bước 1.
3. Với booking CONFIRMED còn dưới 4 giờ, Hội viên chọn **Hủy / yêu cầu hủy**, nhập lý do: lịch chuyển **Chờ duyệt hủy**, chưa hoàn buổi và chưa mở lại slot.
4. Ở tài khoản PT hoặc Owner, mở lịch có yêu cầu rồi thử **Từ chối hủy** kèm lý do: lịch trở lại **Đã xác nhận** và Hội viên nhận thông báo.
5. Gửi lại yêu cầu và chọn **Chấp nhận hủy**: lịch chuyển **Đã hủy**, hoàn buổi, mở lại slot và thông báo Hội viên.
6. Tạo lịch khác rồi hủy từ phía PT: hủy có hiệu lực ngay, hoàn buổi và thông báo Hội viên.
7. Xác nhận không thể hủy lịch sau giờ bắt đầu; việc có mặt/vắng mặt được hệ thống đối soát sau giờ kết thúc + 5 phút.

### 5.5 Đánh giá nhân viên và hồ sơ PT

1. Đăng nhập Hội viên, mở **Đánh giá nhân viên**.
2. Lọc riêng PT/Lễ tân, tìm theo tên và thử các kiểu sắp xếp.
3. Mở một nhân viên chưa từng tương tác, chọn 1–5 sao, nhập nhận xét từ 3 ký tự và gửi.
4. Mở lại cùng nhân viên, thay đổi sao/nhận xét và lưu lần nữa.
5. Vào **Lịch PT**, bấm tên hoặc số sao của PT trên ca trống để mở đúng hồ sơ và danh sách nhận xét.
6. Đăng nhập Owner, vào **Nhân sự**, lọc **Còn làm việc/Đã nghỉ việc**, chọn sắp xếp theo sao/số bài và mở **Xem đánh giá**.

Kết quả mong đợi: không yêu cầu booking trước đó; lần lưu thứ hai cập nhật bài cũ; điểm trung bình/số bài cập nhật ở danh sách, hồ sơ PT, lịch trống và giao diện Owner. Hội viên không nhìn thấy hoặc đánh giá nhân viên đã nghỉ việc.

## 6. Luồng check-in

1. Trên điện thoại hoặc trình duyệt thứ nhất, đăng nhập Hội viên `khanhbang@gym.local`.
2. Vào **Check-in** và mở QR thẻ hội viên.
3. Trên thiết bị tại quầy, đăng nhập Lễ tân `letan@gym.local` hoặc Chủ phòng.
4. Vào **Check-in**, chọn **Mở camera**, cấp quyền camera và đưa QR hội viên vào khung quét.
5. Sau khi đọc được `MB-000101`, kiểm tra tên Hội viên, quyền lợi Gym và khối **Hôm nay Hội viên có lịch PT** xuất hiện ngay nếu có lịch.
6. Chọn gói cần áp dụng nếu hội viên có nhiều quyền lợi, sau đó chọn **Xác nhận check-in**.
7. Kiểm tra thẻ kết quả **Check-in thành công** và khối **Lịch PT hôm nay**; nếu có lịch phải hiện đúng giờ, tên PT và trạng thái.
8. Kiểm tra bản ghi mới trong lịch sử của cả Lễ tân và Hội viên.
9. Xác nhận lại cùng hội viên trong ngày: giao diện phải hiện **Đã check-in hôm nay**, không hiện toast lỗi đỏ và vẫn hiện lịch PT. Nếu đang trong cửa sổ PT, nút đổi thành **Xác nhận điểm danh lịch PT**.
10. Thử thêm mã không tồn tại hoặc hội viên chưa từng check-in và không có gói Gym hiệu lực.

Trên thiết bị tại quầy, mở [https://titan-gym-web.vercel.app/checkin](https://titan-gym-web.vercel.app/checkin) bằng Chrome/Edge độc lập, cho phép quyền camera rồi quét QR đang hiển thị trên điện thoại Hội viên. Nếu camera vẫn không mở hoặc thiết bị không có camera, nhập `MB-000101` vào ô mã hội viên rồi xác nhận. Khi kiểm thử local bằng IP LAN qua HTTP, trình duyệt có thể chặn camera; dùng `http://localhost:5173/checkin` ngay trên máy chủ hoặc nhập mã thủ công. Không cần camera để kiểm tra phần còn lại của quy trình.

Kết quả mong đợi:

- Hội viên có gói hiệu lực check-in thành công.
- Lượt check-in gắn đúng với gói đã hiển thị ở bước xác nhận; gói thời hạn giữ nguyên ngày hết hạn.
- Mã sai hoặc không có quyền lợi hợp lệ bị từ chối rõ ràng.
- Mỗi hội viên chỉ được ghi nhận một lần trong cùng ngày, tránh tăng sai số ngày tập hoặc trừ nhiều lượt.
- Nếu Hội viên quay lại trong ngày, giao diện báo đã check-in; hệ thống không tạo/trừ lượt Gym lần hai nhưng vẫn ghi điểm danh booking PT khi xác nhận đúng cửa sổ.
- Chỉ khi có lịch PT hoạt động trong ngày, khối nhắc mới xuất hiện ngay sau khi quét/tra cứu; không có lịch thì không hiện khối rỗng.
- Điểm danh PT hợp lệ từ 60 phút trước giờ bắt đầu đến 5 phút sau giờ kết thúc. Nếu đã điểm danh, ngay khi hết giờ PT nhận trạng thái chờ xác nhận; 5 phút đệm chỉ dành cho trường hợp chưa kịp điểm danh.
- Hội viên chỉ hiển thị QR và lịch sử của mình; chỉ Lễ tân/Chủ phòng có quyền ghi nhận check-in.

## 7. Quản lý gói, hội viên và nhân sự

### Chủ phòng

1. Đăng nhập Chủ phòng.
2. Tại **Gói tập**, tạo một gói mới và kiểm tra nó xuất hiện cho Hội viên.
3. Tại **Nhân sự**, tạo tài khoản Lễ tân/PT và kiểm tra quyền đăng nhập.
4. Tại **Hội viên**, tìm theo tên/email/mã và thử xóa một tài khoản test không còn dữ liệu liên quan.
5. Tại **Nhân sự**, chọn **Cho nghỉ việc** trên một tài khoản Lễ tân/PT test; thử gọi lại API hoặc tải trang ở tab của nhân viên đó, sau đó dùng **Khôi phục tài khoản**.
6. Dùng bộ lọc **Còn làm việc/Đã nghỉ việc/Tất cả**; chọn sắp xếp theo điểm và số bài đánh giá rồi mở chi tiết phản hồi.

Kết quả mong đợi:

- Chỉ Chủ phòng thấy thao tác tạo gói, tạo nhân sự và xóa hội viên.
- Tài khoản có giao dịch/lịch sử liên quan được bảo vệ theo ràng buộc dữ liệu; thông báo lỗi phải rõ ràng.
- Cho nghỉ việc chuyển tài khoản nhân viên sang `INACTIVE`, chặn cả JWT cũ và đăng nhập mới nhưng không xóa lịch sử giao dịch/lịch PT.
- Sắp xếp theo đánh giá tự chuyển về danh sách nhân viên còn làm; phản hồi cũ vẫn được Owner xem sau khi nhân viên nghỉ việc.
- Không xóa các tài khoản mẫu nếu còn cần dùng cho phần test khác.

### Lễ tân, PT và Hội viên

Kiểm tra trực tiếp URL của trang không thuộc quyền. Kết quả mong đợi là menu không hiển thị và backend vẫn từ chối API nếu cố gọi thủ công; việc ẩn nút không phải lớp bảo mật duy nhất.

## 8. Hồ sơ và đổi mật khẩu

1. Đăng nhập bất kỳ tài khoản nào, mở **Hồ sơ**.
2. Kiểm tra email, số điện thoại, mã hội viên/PT và quyền lợi.
3. Thử đổi mật khẩu với mật khẩu hiện tại sai, xác nhận không khớp và dữ liệu hợp lệ.

Kết quả mong đợi: lỗi nhập liệu được báo rõ; đổi thành công yêu cầu đăng nhập bằng mật khẩu mới theo quy tắc hiện tại.

Lưu ý: chạy lại `npm run db:seed` sẽ đặt lại mật khẩu của các tài khoản mẫu về `SEED_PASSWORD`.

### 8.1 Thông báo công việc

1. Tạo yêu cầu thanh toán hoặc đặt lịch PT ở một tài khoản.
2. Mở **Thông báo** ở tài khoản nhân viên/PT liên quan và chờ tối đa 15 giây.
3. Xử lý yêu cầu rồi kiểm tra thông báo kết quả ở tài khoản Hội viên.
4. Với lịch CONFIRMED bắt đầu trong 24 giờ, mở lại trang và kiểm tra chỉ có một thông báo nhắc lịch dù tải lại nhiều lần.
5. Thử đánh dấu một thông báo và toàn bộ thông báo là đã đọc.

Kết quả mong đợi: chỉ đúng người nhận thấy thông báo; số chưa đọc giảm đúng và thời gian hiển thị theo giờ Việt Nam.

### 8.2 Báo cáo và đối soát

1. Đăng nhập Chủ phòng và mở **Báo cáo**.
2. Đối chiếu số thanh toán chờ duyệt với trang **Giao dịch**.
3. Để Hội viên gửi xác nhận tiền mặt, nhân viên xác nhận thu rồi kiểm tra bảng **Tiền mặt hôm nay**, người thu và tổng tiền.
4. Đối chiếu doanh thu theo người xác nhận, trạng thái/điểm PT và nhật ký thao tác gần đây.

Kết quả mong đợi: chỉ Chủ phòng truy cập được; doanh thu chỉ lấy Payment PAID và đối soát ngày theo `Asia/Ho_Chi_Minh`.

## 9. Kiểm thử đồng thời trên nhiều máy

Kịch bản nhanh:

1. Mỗi máy mở [https://titan-gym-web.vercel.app](https://titan-gym-web.vercel.app); không cần một máy đóng vai trò máy chủ.
2. Máy A đăng nhập Hội viên, máy B đăng nhập Lễ tân, máy C đăng nhập Chủ phòng, máy D đăng nhập PT. Có thể dùng nhiều tab trên cùng máy vì mỗi tab lưu phiên riêng.
3. Máy A tạo đơn rồi xác nhận phương thức thanh toán; trước đó B/C không có nút xác nhận thu. Sau khi A gửi, B/C nhìn thấy yêu cầu chờ và một trong hai máy xác nhận.
4. A nhìn thấy đơn hoàn tất và quyền lợi mới.
5. D mở ca PT; A (với tài khoản có gói PT) đặt lịch; D xác nhận.
6. B check-in một hội viên; C quan sát dashboard/lịch sử.

Tất cả máy dùng các token đăng nhập riêng trong trình duyệt nhưng cùng gọi Backend production tại `https://titan-gym-api.vercel.app/api`. Backend dùng Prisma đọc/ghi cùng PostgreSQL Neon, vì vậy không có database riêng trên từng máy khách. Giao dịch database được commit một lần và lần tải dữ liệu tiếp theo ở máy khác sẽ nhận cùng kết quả.

Sau mỗi thao tác, trạng thái trên chính tab phải đổi ngay; tab vai trò khác tự đồng bộ trong khoảng 5–10 giây hoặc ngay khi quay lại tab. Tải lại một tab không được làm tab đó nhảy sang tài khoản đang đăng nhập ở tab khác.

Nếu kiểm thử production không truy cập được:

1. Xác nhận đang mở đúng `https://titan-gym-web.vercel.app`, không phải URL `localhost` hoặc URL deployment preview ngẫu nhiên.
2. Mở [Backend API](https://titan-gym-api.vercel.app/api) và kiểm tra có JSON với trạng thái `ok`.
3. Thử cửa sổ ẩn danh hoặc tải lại trang, sau đó kiểm tra kết nối Internet của thiết bị.
4. Nếu Frontend mở được nhưng thao tác lỗi, dùng DevTools hoặc [Swagger](https://titan-gym-api.vercel.app/api/docs) để kiểm tra kỹ thuật.

Nếu kiểm thử local/LAN, kiểm tra các máy cùng mạng, IPv4 của máy chủ, `docker compose ps`, terminal `npm run dev`, Windows Firewall và các cổng `5173`/`3000`.

## 10. Kết thúc buổi test

Với bản production, chỉ cần đăng xuất và đóng trình duyệt; không phải dừng Vercel hoặc Neon.

Với môi trường local, nhấn `Ctrl+C` tại terminal chạy ứng dụng. Nếu muốn dừng PostgreSQL:

```powershell
docker compose down
```

Lệnh trên giữ nguyên volume và dữ liệu. Không dùng `docker compose down -v` trừ khi chủ động muốn xóa toàn bộ database.
