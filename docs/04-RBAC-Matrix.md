# Ma trận RBAC

| Chức năng | Owner | Receptionist | Trainer | Member |
|---|:---:|:---:|:---:|:---:|
| Dashboard tài chính | ✓ | — | — | — |
| Danh sách hội viên | ✓ | ✓ | — | Chỉ mình |
| Xóa hội viên chưa có lịch sử | ✓ | — | — | — |
| Tạo/khóa nhân sự | ✓ | — | — | — |
| Tạo/đóng bán gói | ✓ | Xem | — | Xem |
| Tạo đơn | — | — | — | ✓ |
| Xác nhận tiền mặt demo | ✓ | ✓ | — | — |
| Chuyển khoản demo | — | — | — | Đơn của mình |
| Xem receipt | Tất cả | Tất cả | — | Của mình |
| Mở slot PT | — | — | ✓ | — |
| Xử lý booking | Xem | — | Slot của mình | Đặt/hủy của mình |
| Check-in | ✓ | ✓ | — | Tự check-in |
| Xem hồ sơ | Mình | Mình | Mình | Mình |

Frontend chỉ dùng ma trận để ẩn menu. Backend là nguồn quyết định cuối cùng bằng JWT guard, role guard và ownership check.

