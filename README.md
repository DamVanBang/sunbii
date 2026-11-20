# sunbii.vn — Trang chính SUNBII Technology (v2)

Bản viết lại **chuẩn công nghiệp** của trang chính: giữ bảng màu thương hiệu (đỏ sâu `#D84315`,
vàng `#FBC02D`, đêm `#263238`, kem `#FEF5F2`) và chất hiệu ứng cao cấp, nhưng đầy đủ
SEO, accessibility, nội dung và trang chính sách.

## So với bản cũ

| Hạng mục | Bản cũ | Bản v2 |
|---|---|---|
| SEO | Meta cơ bản, thiếu OG đầy đủ | Canonical, OG/Twitter, JSON-LD (Organization + FAQPage), sitemap.xml, robots.txt |
| Nội dung | 4 section mỏng | Hero + stats, 6 thẻ hệ sinh thái, 4 dự án, pride, timeline hành trình, FAQ, liên hệ |
| Chính sách | Không có | 4 trang: Điều khoản, Bảo mật, Bảo hành & đổi trả, Cookie |
| Hiệu ứng | Popup + hover card | Canvas tàn lửa GPU nhẹ, masked line reveal, marquee, spotlight card, magnetic button, scrollspy, progress bar |
| Trải nghiệm | Popup chào mừng gây phiền | Cookie consent chuẩn, nút về đầu trang, menu mobile, skip-link, reduced-motion |
| Font | Montserrat | Be Vietnam Pro (dấu tiếng Việt hoàn hảo) |

## Nguyên tắc "không chết trang"

- `<html class="no-js">` → JS gỡ class; nếu GSAP không tải → `html.gsap-fail` hiện toàn bộ nội dung.
- `prefers-reduced-motion`: tắt toàn bộ animation, canvas và marquee.
- Canvas tàn lửa: DPR ≤ 2, dừng khi tab ẩn, giới hạn số hạt theo diện tích.

## Cấu trúc

```
sunbii-main/
├── index.html                        # Trang chính
├── chinh-sach/
│   ├── dieu-khoan-su-dung.html       # Điều khoản sử dụng
│   ├── bao-mat.html                  # Chính sách bảo mật
│   ├── bao-hanh-doi-tra.html         # Bảo hành & đổi trả (đồng bộ services.sunbii.vn)
│   └── cookie.html                   # Chính sách cookie
├── assets/css/style.css              # Design system + policy styles
├── assets/js/main.js                 # Hiệu ứng + tiện ích
├── sitemap.xml · robots.txt · README.md
```

Hình ảnh/favicon trỏ tuyệt đối về `https://sunbii.vn/images/...` — deploy ở đâu cũng chạy,
repo nhẹ (không cần upload ảnh).

## Deploy

Ghi đè webroot của sunbii.vn bằng nội dung thư mục này (giữ nguyên thư mục `/images/`
và `/images/favicons/` hiện có trên server):

```bash
# ví dụ nếu quản lý bằng git
git add -A
git commit -m "feat: sunbii.vn v2 — industry standard + policy pages"
git push origin main
```

## Việc nên làm sau khi lên máy chủ

1. Kiểm tra `/images/thumbail.png` (fix chính tả thành `thumbnail.png` sẽ tốt hơn, nhớ sửa cả meta og:image).
2. Bổ sung favicon `.svg` thật của SUNBII (đang trỏ link sẵn).
3. Nếu có Google Search Console: submit lại `sitemap.xml`.
