# Notification Delivery Foundation – v0.6

## Hiện có
- Notification Center trong UI.
- Cảnh báo theo trạng thái nghiệp vụ và deadline.
- Cấu hình nhắc trước hạn do Admin nhập, mặc định không tự đặt ngưỡng.
- API server-side `/api/notifications/run` để phục vụ cron hoặc hệ thống gọi ngoài.

## Bảo mật
Endpoint chỉ chạy khi header:
`Authorization: Bearer <CRON_SECRET>`

## Dữ liệu gửi ra webhook
Nếu cấu hình `NOTIFICATION_WEBHOOK_URL`, endpoint chỉ gửi **số tổng hợp**:
- Phát hiện mở.
- Phát hiện mức cao/nghiêm trọng.
- Hành động quá hạn.
- Chờ xác minh.
- Chờ đơn vị phản hồi.
- Chờ chốt sau phản hồi.

Không gửi nội dung chi tiết bằng chứng/phát hiện qua webhook mặc định.

## Chưa tự đặt lịch
Không cấu hình cron schedule vì cadence chưa được business owner xác nhận. Khi chốt lịch, có thể thêm Vercel Cron vào `vercel.json`.
