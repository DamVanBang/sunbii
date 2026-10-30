# SUNBII WORLD — Trang chủ chơi được của sunbii.vn

Trang chủ sunbii.vn phiên bản **thế giới mở 3D có vật lý thật** (skill
`playable-3d-world-bruno`): lái buggy bằng WASD, húc đổ chữ SUNBII và tường gạch,
bay qua dốc nitro, và **lái vào 6 trạm phát sáng — mỗi trạm mở một trang web**
của hệ sinh thái SUNBII.

## Bản đồ thế giới (±45m)

| Khu | Trạm | Trang web | Cảnh 3D |
|---|---|---|---|
| Trung tâm (0,0) | 🏁 Quảng trường | *(trang này)* | Chữ **SUNBII** húc đổ được + tường gạch + 2 dốc nitro |
| Bắc (0,-24) | **01 SUNBII API** | api.sunbii.vn | 3 tháp server LED nhấp nháy |
| Đông (24,0) | **02 XƯỞNG SERVICES** ⭐ | services.sunbii.vn | **Xưởng pin xe điện**: cần nâng xe, kệ cell 18650, bàn làm việc, chồng lốp, bảng hiệu |
| Tây (-24,0) | **03 INVITES** | invites.sunbii.vn | Cổng vòm cưới + thiệp thư đổ được |
| Nam (0,24) | **04 EV-S3** | ev.sunbii.vn | Trụ sạc xe điện + slalom nón giao thông |
| Tây-Bắc (-17,-17) | **05 FORUM** | forum.sunbii.vn | Bảng thông báo cộng đồng + ghế dài |
| Đông-Bắc (17,-17) | **06 FOUNDER** | damvanbang.sunbii.vn | Triển lãm mini 3 bệ |

**Xưởng Services (G2)** chính là ga-ra pin xe điện thật của SUNBII — xe lái vào
sàn bê tông, quanh mình là cần nâng đang sửa xe, kệ cell và mùi… bê tông mới tô.

## Điều khiển

- **Desktop:** `W A S D` / phím mũi tên · `SHIFT` Nitro · `R` reset xe khi lật
- **Mobile:** D-pad ảo góc phải (gom cả nút N²O)
- **Không muốn lái?** Bấm menu góc trên phải — xe **teleport** thẳng tới trạm
  và tự mở bảng thông tin (skill luật 4)
- Đỗ xe vào **vòng sáng** của bất kỳ trạm → drawer Glassmorphism trượt ra
  với thông tin + nút **Mở trang ↗** (tab mới)
- **Minimap** góc phải: 6 điểm trạm màu + mũi tên xe realtime

## Kiến trúc (theo skill `playable-3d-world-bruno`)

```
sunbii-world/
├── index.html        # HUD: loader, teleport menu, keycaps, d-pad, minimap, drawer
├── css/style.css     # Dark-glass HUD trên nền cát sáng
├── js/engine.js      # PlayableWorldEngine (skill) + mở rộng có ghi chú:
│                     #   stations cấu hình ngoài, helper vật lý (addStaticBox/
│                     #   addDynamicBox/Cylinder), tường biên vô hình, FOV nitro
├── js/app.js         # Nội dung SUNBII: 7 khu, xưởng, chữ húc đổ, minimap, HUD
└── README.md
```

- **Không cuộn trang** — `overflow: hidden`, world 100vw×100vh (luật 1)
- **cannon-es 0.20** qua importmap CDN; mọi vật thể đều có `CANNON.Body` đồng bộ
- **allowSleep** + `body.sleep()` khởi tạo → tường gạch/cell/pin ngủ tới khi bị tông
- **PCFSoftShadowMap + ACESFilmic** — đổ bóng mềm chuẩn toy-industrial
- Mỗi trang web mở bằng `target="_blank"` — thế giới không bị rời đi

## Hiệu năng

- ~75 physics bodies (phần lớn đang ngủ), 1 draw shadow map 2048
- Mobile: keycaps ẩn → d-pad ảo; minimap thu nhỏ; DPR ≤ 2
- Debug: `window.__world` (engine) — `__world.carBody`, `__world.zones`…

## Deploy

Trang này thay thế / nằm cạnh trang chủ sunbii.vn:
- **Phương án A:** deploy lên `sunbii.vn/` làm trang chủ chơi được
- **Phương án B:** deploy lên `sunbii.vn/play/`, trang chuẩn `sunbii-main/` giữ ở gốc
  và link "🎮 Vào thế giới 3D" từ menu

```bash
cd sunbii-world
git init && git add -A
git commit -m "feat: sunbii.vn playable world homepage — 6 trạm web + xưởng services"
git remote add origin <URL_GIT_SERVER>
git push -u origin main
```
