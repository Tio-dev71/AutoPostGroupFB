# Build Và Phát Hành App Bằng GitHub Actions

Tài liệu này hướng dẫn cách dùng GitHub Actions để tự build file cài đặt cho khách:

- macOS: `.dmg`
- Windows: `.exe` / `.msi`
- Có artifact tải về sau mỗi lần build
- Có GitHub Release khi tạo version tag

---

## 1. Workflow đã cấu hình

Workflow nằm tại:

```text
.github/workflows/build-windows.yml
```

Tên workflow trên GitHub:

```text
Build Desktop Installers
```

Workflow chạy khi:

1. Push lên branch `main`
2. Push tag dạng `v*`, ví dụ `v1.0.1`
3. Bấm chạy thủ công trong tab **Actions**

---

## 2. Cấu hình API production

App cần biết backend VPS ở đâu. Hiện workflow mặc định dùng:

```text
http://161.248.146.74
```

Khuyến nghị tạo GitHub Secret để dễ đổi sau này.

### Tạo secret trên GitHub

Vào repo GitHub:

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

Tạo secret:

```text
Name: VITE_API_BASE_URL
Value: http://161.248.146.74
```

Nếu sau này có domain HTTPS, đổi value thành:

```text
https://api.tenmiencuaban.com
```

> [!IMPORTANT]
> File app build ra sẽ cố định API URL tại thời điểm build. Nếu đổi VPS/domain, cần build lại app.

---

## 3. Chạy build thủ công

Vào GitHub repo:

```text
Actions -> Build Desktop Installers -> Run workflow
```

Chọn branch `main`, bấm **Run workflow**.

Sau khi chạy xong, vào workflow run -> **Artifacts** để tải:

```text
AutoPost-FB-AI-Pro-macOS
AutoPost-FB-AI-Pro-Windows
```

---

## 4. Tạo release cho khách tải

Khi muốn phát hành bản mới, chạy trên máy local:

```bash
git add .
git commit -m "Release desktop installers"
git push origin main
```

Tạo version tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions sẽ tự build và tạo release:

```text
Releases -> AutoPost FB AI Pro v1.0.1
```

---

## 5. Gửi file nào cho khách?

### Khách dùng macOS

Gửi file:

```text
.dmg
```

Ví dụ:

```text
AutoPost FB AI Pro_1.0.0_aarch64.dmg
```

### Khách dùng Windows

Gửi file:

```text
.exe
```

hoặc nếu workflow tạo `.msi` thì có thể gửi `.msi`.

---

## 6. Lưu ý về macOS chưa ký app

Nếu chưa có Apple Developer Account, khách Mac có thể thấy cảnh báo:

```text
Apple cannot verify developer
```

Khách mở bằng cách:

```text
Right click app -> Open -> Open
```

Hoặc:

```text
System Settings -> Privacy & Security -> Open Anyway
```

Muốn hết cảnh báo cần cấu hình thêm:

- Apple Developer Account
- Code signing certificate
- Notarization

---

## 7. Checklist trước khi release

Trước khi gửi khách, kiểm tra VPS:

```bash
curl http://161.248.146.74/health
curl http://161.248.146.74/payments/plans
```

Kết quả `/payments/plans` phải có:

```text
725000
1225000
1725000
```

Sau đó build release bằng tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

---

## 8. Nếu build lỗi trên GitHub

Vào tab **Actions**, mở run lỗi, xem step màu đỏ.

Lỗi thường gặp:

| Lỗi | Cách xử lý |
|---|---|
| `npm ci` lỗi | Commit `package-lock.json` hoặc workflow sẽ fallback `npm install` |
| Rust build lỗi | Xem log `Build Tauri app` |
| Không thấy `.exe` | Kiểm tra Tauri bundle target Windows |
| Không thấy `.dmg` | Kiểm tra step macOS |
| App gọi sai API | Kiểm tra secret `VITE_API_BASE_URL` rồi build lại |
