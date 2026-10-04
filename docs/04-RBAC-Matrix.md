# Ma trận RBAC

| Chức năng | Owner | Receptionist | Trainer | Member |
|---|:---:|:---:|:---:|:---:|
| Dashboard tài chính | ✓ | — | — | — |
| Danh sách hội viên | ✓ | ✓ | — | Chỉ mình |
| Xóa hội viên chưa có lịch sử | ✓ | — | — | — |
| Tạo/cho nghỉ việc/khôi phục nhân sự | ✓ | — | — | — |
| Tạo/đóng bán gói | ✓ | Xem | — | Xem |
| Tạo đơn | — | — | — | ✓ |
| Xác nhận tiền mặt demo | ✓ | ✓ | — | — |
| Duyệt/từ chối chuyển khoản | ✓ | ✓ | — | — |
| Chuyển khoản demo | — | — | — | Đơn của mình |
| Xem receipt | Tất cả đơn PAID | Tất cả đơn PAID | — | Đơn PAID của mình |
| Mở slot PT | — | — | ✓ | — |
| Xử lý booking | Xem/xử lý, duyệt hủy muộn | — | Slot của mình, duyệt hủy muộn | Đặt/hủy/yêu cầu hủy của mình |
| Xem đánh giá nhân viên | Tất cả PT/Lễ tân | — | Điểm của mình | Nhân viên đang làm việc |
| Tạo/cập nhật đánh giá | — | — | — | Một bài cho mỗi PT/Lễ tân ACTIVE |
| Báo cáo/đối soát/audit | ✓ | — | — | — |
| Thông báo | Của mình | Của mình | Của mình | Của mình |
| Check-in | Quét/nhập mã và xác nhận | Quét/nhập mã và xác nhận | — | Hiển thị QR cá nhân và xem lịch sử |
| Xem hồ sơ | Mình | Mình | Mình | Mình |

Frontend chỉ dùng ma trận để ẩn menu. Backend là nguồn quyết định cuối cùng bằng JWT guard, role guard và ownership check.

> Sai lệch implementation đang tồn tại: `GET /operations/checkins` chưa gắn role guard và nhánh lọc trong service có thể trả danh sách chung cho Trainer gọi API trực tiếp, dù Frontend không hiển thị trang Check-in cho Trainer. Ma trận trên thể hiện quyền nghiệp vụ mong muốn; chi tiết hành vi hiện tại được ghi tại `07-API-Specification.md`.
