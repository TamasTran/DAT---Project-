# Triển khai Flask + TensorFlow với Waitress

Các bước dưới đây giúp chạy server ở chế độ production-friendly, dùng Waitress (WSGI server đa nền tảng).

## 1. Chuẩn bị môi trường

```powershell
python -m venv venv
.\venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 2. Chạy server WSGI

### Cách nhanh nhất
```powershell
waitress-serve --listen=0.0.0.0:8000 app:app
```
- `app:app` = `<module>:<Flask instance>` (đã có sẵn trong `app.py`).
- Mặc định model sẽ được load một lần khi server khởi động.

### Qua file `wsgi.py`
```powershell
python wsgi.py
```
File này tiện cho việc cấu hình bổ sung hoặc đóng gói thành dịch vụ Windows/Linux.

## 3. HTTPS để bật camera trên mobile
- Trình duyệt di động chỉ cho phép `navigator.mediaDevices.getUserMedia` (camera trực tiếp) khi truy cập bằng **HTTPS** hoặc `localhost`.
- Nếu người dùng truy cập bằng địa chỉ nội bộ (ví dụ `http://192.168.1.5:8000`) thì camera trong web sẽ bị chặn, nhưng vẫn có thể dùng nút “Chọn ảnh”.
- Để bật camera trực tuyến trên điện thoại, hãy gắn TLS (Let’s Encrypt, mkcert, Cloudflare Tunnel…) hoặc dùng reverse proxy hỗ trợ SSL.

## 4. Reverse proxy (tuỳ chọn)
Nên đặt Nginx/Apache làm reverse proxy để:
- Gắn TLS/HTTPS (Let’s Encrypt, Cloudflare, v.v.).
- Ánh xạ tên miền -> server nội bộ.

Ví dụ Nginx (Linux):
```nginx
server {
    listen 80;
    server_name cassava.example.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## 5. Giám sát và khởi động cùng hệ thống
- Windows: dùng NSSM hoặc dịch vụ Windows để chạy `python wsgi.py`.
- Linux: tạo service systemd trỏ tới `waitress-serve` hoặc `python wsgi.py`.

## 6. Kiểm thử sau triển khai
1. Mở `http://<server-ip>:8000` và thử tải ảnh/camera bằng điện thoại.
2. Theo dõi log Waitress để đảm bảo request xử lý ổn định.
3. Giám sát RAM/CPU vì TensorFlow load model nặng (~190 MB).
