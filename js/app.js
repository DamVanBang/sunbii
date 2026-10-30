/* ============================================================
   SUNBII WORLD — Trang chủ chơi được (app.js)
   Engine: PlayableWorldEngine từ skill `playable-3d-world-bruno`
   Nội dung SUNBII: 6 trạm web + Xưởng Services + chữ SUNBII physics
   + minimap + drawer + keycap/mobile controls.
   ============================================================ */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PlayableWorldEngine } from './engine.js';

/* ============================================================
   1) CẤU HÌNH TRẠM — mỗi trạm = một trang web của hệ sinh thái
   ============================================================ */
const STATIONS = [
  {
    id: 'api', ch: '01', name: 'SUNBII API', sub: 'Workspace 17 module · Tự động hoá',
    desc: 'Nền tảng API bảo mật, hiệu năng cao phục vụ hàng triệu yêu cầu mỗi ngày: xác thực, captcha, thông báo, quản lý bảo hành, kho và vận hành server — không cần can thiệp thủ công.',
    url: 'https://api.sunbii.vn/', cta: 'Mở workspace ↗', color: '#2563EB',
    x: 0, z: -24, r: 4.2,
    specs: [['17+', 'module'], ['1M+/ngày', 'yêu cầu'], ['24/7', 'uptime monitor']],
  },
  {
    id: 'workshop', ch: '02', name: 'XƯỞNG SUNBII SERVICES', sub: 'Pin lithium · BMS · Cân cell',
    desc: 'Xưởng sửa chữa pin xe điện thật: đóng khối pin, cân cell, sửa BMS/controller — kèm hệ thống tra cứu bảo hành điện tử minh bạch. Chính là ga-ra bạn đang đỗ xe đấy!',
    url: 'https://services.sunbii.vn/', cta: 'Đặt lịch vào xưởng ↗', color: '#F59E0B',
    x: 24, z: 0, r: 4.6,
    specs: [['±5mV', 'độ chính xác cell'], ['6–12T', 'bảo hành pin'], ['100%', 'phiếu điện tử']],
  },
  {
    id: 'invites', ch: '03', name: 'SUNBII INVITES', sub: 'Thiệp cưới điện ảnh online',
    desc: 'Thiệp cưới, sinh nhật, họp lớp: link riêng, album, âm nhạc, RSVP & sổ lưu bút — xem ngay trên trình duyệt, không cần cài đặt.',
    url: 'https://invites.sunbii.vn/', cta: 'Tạo thiệp ↗', color: '#EC4899',
    x: -24, z: 0, r: 4.2,
    specs: [['3', 'dịp thiệp'], ['RSVP', '+ sổ lưu bút'], ['4', 'gói Free→VIP']],
  },
  {
    id: 'ev', ch: '04', name: 'EV-S3 CYBERCOCKPIT', sub: 'Buồng lái số cho xe điện',
    desc: 'Điều khiển trung tâm ESP32-S3: JK BMS qua BLE/4G, GPS L76K và bản đồ MapLibre 3D — giám sát từng cell pin realtime ngay trên điện thoại.',
    url: 'https://ev.sunbii.vn/', cta: 'Vào buồng lái ↗', color: '#10B981',
    x: 0, z: 24, r: 4.2,
    specs: [['ESP32-S3', 'dual-core 240MHz'], ['JK BMS', 'realtime'], ['3D', 'MapLibre']],
  },
  {
    id: 'forum', ch: '05', name: 'SUNBII FORUM', sub: 'Cộng đồng & tri thức',
    desc: 'Mái nhà chung của hệ sinh thái: chia sẻ kinh nghiệm, tài liệu kỹ thuật và hỗ trợ sản phẩm SUNBII — nơi tri thức đi vòng tròn.',
    url: 'https://forum.sunbii.vn/', cta: 'Vào diễn đàn ↗', color: '#7C3AED',
    x: -17, z: -17, r: 3.8,
    specs: [['100%', 'miễn phí'], ['24/7', 'cộng đồng'], ['VI', 'ngôn ngữ']],
  },
  {
    id: 'founder', ch: '06', name: 'FOUNDER PORTFOLIO', sub: 'Đàm Văn Bằng · Kiến trúc sư',
    desc: 'Hồ sơ trình diễn WebGL của người sáng lập — sinh năm 2006, kiến tạo SUNBII từ 20/01/2021, vẫn viết code mỗi ngày.',
    url: 'https://damvanbang.sunbii.vn/', cta: 'Xem hồ sơ ↗', color: '#EF4444',
    x: 17, z: -17, r: 3.8,
    specs: [['2006', 'gen Z builder'], ['6', 'sản phẩm'], ['20·01·21', 'SUNBII day one']],
  },
];

const LETTERS = ['S', 'U', 'N', 'B', 'I', 'I'];
const LETTER_COLORS = ['#D84315', '#F59E0B', '#263238', '#FBC02D', '#D84315', '#263238'];

/* ============================================================
   2) KHỞI TẠO ENGINE
   ============================================================ */
const container = document.getElementById('world');

/* Callback zone → drawer (module-level vì engine gọi nó ngay lúc khởi tạo) */
function onZoneChange(zone) {
  const drawer = document.getElementById('drawer');
  if (!zone) {
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    return;
  }
  document.getElementById('drawerCh').textContent = 'TRẠM ' + zone.ch;
  document.getElementById('drawerName').textContent = zone.name;
  document.getElementById('drawerSub').textContent = zone.sub;
  document.getElementById('drawerDesc').textContent = zone.desc;
  document.getElementById('drawerCta').href = zone.url;
  const specs = document.getElementById('drawerSpecs');
  specs.innerHTML = '';
  (zone.specs || []).forEach(([b, sp]) => {
    const div = document.createElement('div');
    div.className = 'spec';
    div.innerHTML = `<b>${b}</b><span>${sp}</span>`;
    specs.appendChild(div);
  });
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
}

const engine = new PlayableWorldEngine(container, onZoneChange, { stations: STATIONS, bounds: 45 });
window.__world = engine; // debug hook

/* ============================================================
   3) DỰNG NỘI DUNG SUNBII TRÊN NỀN ENGINE
   ============================================================ */

/* --- Chữ SUNBII 3D húc đổ được (đằng sau tường gạch) --- */
function buildLetterBlocks() {
  LETTERS.forEach((ch, i) => {
    const tex = engine.makeCanvasTexture((ctx, S) => {
      ctx.fillStyle = LETTER_COLORS[i];
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#FFF8EF';
      ctx.font = `900 ${S * 0.62}px "Be Vietnam Pro", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, S / 2, S / 2 + S * 0.04);
    });
    engine.addDynamicBox({
      pos: new THREE.Vector3((i - 2.5) * 1.62, 0.78, -14.5),
      size: { x: 1.42, y: 1.42, z: 1.42 },
      color: '#ffffff',
      mass: 2.5,
      texture: tex,
    });
  });
}

/* --- Bảng chỉ dẫn 6 hướng quanh quảng trường --- */
function buildDirectionPlates() {
  STATIONS.forEach((s, i) => {
    const ang = (i / STATIONS.length) * Math.PI * 2;
    const x = Math.cos(ang) * 6.5;
    const z = Math.sin(ang) * 6.5;
    const tex = engine.makeCanvasTexture((ctx, S) => {
      ctx.fillStyle = s.color;
      ctx.fillRect(0, 0, S, S);
      ctx.fillStyle = '#FFFDF8';
      ctx.font = `700 ${S * 0.16}px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(s.name.split(' ').slice(0, 2).join(' '), S / 2, S * 0.44);
      ctx.font = `900 ${S * 0.3}px "Be Vietnam Pro", sans-serif`;
      ctx.fillText('▸', S / 2, S * 0.78);
    }, 256);
    // Tấm chỉ dẫn nằm phẳng trên mặt đất, xoay hướng ra trạm
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: false })
    );
    plate.rotation.x = -Math.PI / 2;
    plate.rotation.z = -ang - Math.PI / 2;
    plate.position.set(x, 0.03, z);
    engine.scene.add(plate);
  });
}

/* ============================================================
   4) TRẠM 02 — XƯỞNG SUNBII SERVICES (ga-ra pin xe điện)
   ============================================================ */
function buildWorkshop() {
  const S = STATIONS.find((s) => s.id === 'workshop');
  const cx = S.x, cz = S.z;

  // Sàn bê tông xưởng
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(13, 0.12, 10),
    new THREE.MeshStandardMaterial({ color: '#9C9A92', roughness: 0.9 })
  );
  slab.position.set(cx, 0.06, cz + 1);
  slab.receiveShadow = true;
  engine.scene.add(slab);

  // Bảng hiệu "XƯỞNG SUNBII SERVICES" trên cao
  const signTex = engine.makeCanvasTexture((ctx, S2) => {
    ctx.fillStyle = '#263238';
    ctx.fillRect(0, 0, S2, S2);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, S2 * 0.4, S2, S2 * 0.2);
    ctx.fillStyle = '#FFFDF8';
    ctx.font = `900 ${S2 * 0.13}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('XƯỞNG', S2 / 2, S2 * 0.3);
    ctx.fillText('SUNBII SERVICES', S2 / 2, S2 * 0.56);
    ctx.font = `500 ${S2 * 0.075}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('PIN · BMS · CÂN CELL', S2 / 2, S2 * 0.74);
  }, 512);
  const signH = 4.6;
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 3.4, signH / 2, cz - 3.2), size: { x: 0.28, y: signH, z: 0.28 }, color: '#4A4E57', roughness: 0.4, metalness: 0.6 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx + 3.4, signH / 2, cz - 3.2), size: { x: 0.28, y: signH, z: 0.28 }, color: '#4A4E57', roughness: 0.4, metalness: 0.6 });
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(7.4, 2.2, 0.18),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 })
  );
  signBoard.position.set(cx, signH - 0.6, cz - 3.2);
  signBoard.castShadow = true;
  engine.scene.add(signBoard);

  // CẦ NÂNG XE (car lift) + chiếc xe cũ đang được sửa
  const liftY = 1.35;
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 1.6, 0.65, cz + 1), size: { x: 0.4, y: 1.3, z: 0.5 }, color: '#F59E0B', roughness: 0.35, metalness: 0.5 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx + 1.6, 0.65, cz + 1), size: { x: 0.4, y: 1.3, z: 0.5 }, color: '#F59E0B', roughness: 0.35, metalness: 0.5 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx, liftY, cz + 1), size: { x: 4.2, y: 0.22, z: 2.4 }, color: '#5B616B', roughness: 0.4, metalness: 0.6 });
  // Chiếc xe khách hàng bỏ lại trong xưởng
  const carBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.6, 3.6),
    new THREE.MeshStandardMaterial({ color: '#B0553A', roughness: 0.35, metalness: 0.3 })
  );
  carBody.position.set(cx, liftY + 0.41, cz + 1);
  carBody.castShadow = true;
  engine.scene.add(carBody);
  const carCabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.5, 1.7),
    new THREE.MeshStandardMaterial({ color: '#22252A', roughness: 0.2, metalness: 0.7 })
  );
  carCabin.position.set(cx, liftY + 0.95, cz + 0.6);
  carCabin.castShadow = true;
  engine.scene.add(carCabin);
  // Khối vật lý tĩnh che khuất xe (xe không lái được — trang trí + cản trở)
  const liftCarPhysics = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
  liftCarPhysics.addShape(new CANNON.Box(new CANNON.Vec3(1.0, 0.55, 1.85)));
  liftCarPhysics.position.set(cx, liftY + 0.6, cz + 1);
  engine.world.addBody(liftCarPhysics);

  // KỆ CELL PIN: 2 khung kệ + dãy cell 18650 xanh
  [-2.6, 2.6].forEach((dx) => {
    const rackX = cx + dx;
    engine.addStaticBox({ pos: new THREE.Vector3(rackX, 1.05, cz - 2.4), size: { x: 1.5, y: 2.1, z: 0.5 }, color: '#3E4450', roughness: 0.5, metalness: 0.4 });
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cell = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.13, 0.42, 14),
          new THREE.MeshStandardMaterial({ color: row === 1 ? '#F59E0B' : '#34D399', roughness: 0.3, metalness: 0.35 })
        );
        cell.position.set(rackX - 0.5 + col * 0.34, 0.55 + row * 0.62, cz - 2.15);
        cell.castShadow = true;
        engine.scene.add(cell);
      }
    }
  });

  // CELL RỜI TRÊN SÀN (đổ được — vật lý động)
  for (let i = 0; i < 6; i++) {
    engine.addDynamicCylinder({
      pos: new THREE.Vector3(cx - 1.2 + i * 0.5, 0.22, cz + 3.4 + (i % 2) * 0.4),
      radiusTop: 0.13, radiusBottom: 0.13, height: 0.42,
      color: i % 2 ? '#34D399' : '#F59E0B', mass: 0.4,
    });
  }

  // BÀN LÀM VIỆC + dụng cụ
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 4.6, 0.5, cz + 2.2), size: { x: 0.9, y: 1.0, z: 2.6 }, color: '#7A5C3E', roughness: 0.7 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 4.6, 1.06, cz + 2.2), size: { x: 1.1, y: 0.08, z: 2.9 }, color: '#4A4E57', roughness: 0.35, metalness: 0.5 });

  // CHỒNG LỐP xe điện
  for (let k = 0; k < 3; k++) {
    const tire = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.26, 14, 32),
      new THREE.MeshStandardMaterial({ color: '#1C1D21', roughness: 0.85 })
    );
    tire.rotation.x = Math.PI / 2;
    tire.position.set(cx + 4.4, 0.28 + k * 0.54, cz + 2.2);
    tire.castShadow = true;
    engine.scene.add(tire);
    if (k === 0) {
      const tb = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
      tb.addShape(new CANNON.Cylinder(0.88, 0.88, 1.62, 16));
      tb.position.set(cx + 4.4, 0.81, cz + 2.2);
      engine.world.addBody(tb);
    }
  }
}

/* ============================================================
   5) CÁC TRẠM KHÁC (API · Invites · EV · Forum · Founder)
   ============================================================ */
function buildStationProps() {
  STATIONS.forEach((S) => {
    const { x, z } = S;

    if (S.id === 'api') {
      // 3 tháp server + đèn LED nhấp nháy
      [-2.2, 0, 2.2].forEach((dx, k) => {
        const tex = engine.makeCanvasTexture((ctx, S2) => {
          ctx.fillStyle = '#181C24';
          ctx.fillRect(0, 0, S2, S2);
          for (let r = 0; r < 7; r++) {
            ctx.fillStyle = (r + k) % 3 === 0 ? '#34D399' : '#0E2A44';
            ctx.fillRect(S2 * 0.16, S2 * (0.1 + r * 0.12), S2 * 0.68, S2 * 0.05);
          }
        }, 128);
        engine.addStaticBox({
          pos: new THREE.Vector3(x + dx, 2.25, z - 1.5),
          size: { x: 1.5, y: 4.5, z: 1.1 },
          color: '#ffffff', texture: tex, metalness: 0.4, roughness: 0.35,
        });
      });
      engine.addDynamicBox({ pos: new THREE.Vector3(x + 1.2, 0.5, z + 2), size: { x: 0.9, y: 0.9, z: 0.9 }, color: '#2563EB', mass: 1.2 });
    }

    if (S.id === 'invites') {
      // Cổng vòm cưới
      engine.addStaticCylinder({ pos: new THREE.Vector3(x - 2.2, 1.6, z - 1), radiusTop: 0.22, radiusBottom: 0.26, height: 3.2, color: '#F8B4C4', roughness: 0.4 });
      engine.addStaticCylinder({ pos: new THREE.Vector3(x + 2.2, 1.6, z - 1), radiusTop: 0.22, radiusBottom: 0.26, height: 3.2, color: '#F8B4C4', roughness: 0.4 });
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(5.2, 0.3, 0.4),
        new THREE.MeshStandardMaterial({ color: '#F5D78E', roughness: 0.4 })
      );
      beam.position.set(x, 3.3, z - 1);
      beam.castShadow = true;
      engine.scene.add(beam);
      // 2 thiệp thư động (đổ được)
      engine.addDynamicBox({ pos: new THREE.Vector3(x - 1, 0.55, z + 1.5), size: { x: 0.9, y: 0.1, z: 0.65 }, color: '#FFF8EF', mass: 0.5, rotY: 0.3 });
      engine.addDynamicBox({ pos: new THREE.Vector3(x + 1, 0.55, z + 1.2), size: { x: 0.9, y: 0.1, z: 0.65 }, color: '#F8B4C4', mass: 0.5, rotY: -0.2 });
    }

    if (S.id === 'ev') {
      // Trụ sạc xe điện + màn hình
      engine.addStaticCylinder({ pos: new THREE.Vector3(x - 1.6, 1.25, z), radiusTop: 0.42, radiusBottom: 0.5, height: 2.5, color: '#10B981', roughness: 0.35, metalness: 0.3, seg: 20 });
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.9, 0.1),
        new THREE.MeshStandardMaterial({ color: '#052E22', roughness: 0.2, metalness: 0.4 })
      );
      screen.position.set(x - 1.6, 1.55, z + 0.48);
      engine.scene.add(screen);
      // 4 nón giao thông slalom (đổ được)
      for (let i = 0; i < 4; i++) {
        engine.addDynamicCylinder({
          pos: new THREE.Vector3(x + 1.4 + (i % 2) * 1.6, 0.36, z - 2 + i * 1.4),
          radiusTop: 0.08, radiusBottom: 0.3, height: 0.66,
          color: '#FF6B35', mass: 0.35,
        });
      }
    }

    if (S.id === 'forum') {
      // Bảng thông báo cộng đồng + ghế dài
      engine.addStaticBox({ pos: new THREE.Vector3(x, 1.5, z - 1.2), size: { x: 3.4, y: 2.0, z: 0.16 }, color: '#F5D78E', roughness: 0.6 });
      engine.addStaticBox({ pos: new THREE.Vector3(x - 1.4, 0.75, z - 1.35), size: { x: 0.18, y: 1.5, z: 0.18 }, color: '#8A6A4F' });
      engine.addStaticBox({ pos: new THREE.Vector3(x + 1.4, 0.75, z - 1.35), size: { x: 0.18, y: 1.5, z: 0.18 }, color: '#8A6A4F' });
      const noteTex = engine.makeCanvasTexture((ctx, S2) => {
        ctx.fillStyle = '#FFF8EF';
        ctx.fillRect(0, 0, S2, S2);
        ctx.fillStyle = '#263238';
        ctx.font = `700 ${S2 * 0.09}px "Be Vietnam Pro", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('SUNBII FORUM', S2 / 2, S2 * 0.2);
        ctx.font = `${S2 * 0.07}px "Be Vietnam Pro", sans-serif`;
        ['— Kinh nghiệm —', '— Tài liệu —', '— Hỗ trợ —', '— Góp ý —'].forEach((t, k) => {
          ctx.fillText(t, S2 / 2, S2 * (0.36 + k * 0.14));
        });
      }, 256);
      const note = new THREE.Mesh(
        new THREE.PlaneGeometry(3.0, 1.76),
        new THREE.MeshBasicMaterial({ map: noteTex })
      );
      note.position.set(x, 1.5, z - 1.1);
      engine.scene.add(note);
      engine.addStaticBox({ pos: new THREE.Vector3(x, 0.3, z + 1.4), size: { x: 2.6, y: 0.12, z: 0.6 }, color: '#8A6A4F', roughness: 0.7 });
      engine.addStaticBox({ pos: new THREE.Vector3(x - 1, 0.15, z + 1.4), size: { x: 0.14, y: 0.3, z: 0.5 }, color: '#6E5238' });
      engine.addStaticBox({ pos: new THREE.Vector3(x + 1, 0.15, z + 1.4), size: { x: 0.14, y: 0.3, z: 0.5 }, color: '#6E5238' });
    }

    if (S.id === 'founder') {
      // 3 bệ triển lãm mini
      [-1.8, 0, 1.8].forEach((dx, k) => {
        engine.addStaticCylinder({ pos: new THREE.Vector3(x + dx, 0.5, z + (k === 1 ? -0.8 : 0.4)), radiusTop: 0.55, radiusBottom: 0.7, height: 1.0, color: k === 1 ? '#D84315' : '#FFFDF8', roughness: 0.4, seg: 28 });
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.6, 0.06),
          new THREE.MeshStandardMaterial({ color: '#263238', roughness: 0.3 })
        );
        frame.position.set(x + dx, 1.35, z + (k === 1 ? -0.8 : 0.4));
        engine.scene.add(frame);
      });
    }
  });
}

/* ============================================================
   6) CÂY XOÀI + ĐÁ (trang trí quanh rìa thế giới)
   ============================================================ */
function buildNature() {
  const spots = [
    [30, -18], [34, -6], [-30, -20], [-34, -4], [-12, 28], [12, 30],
    [28, 18], [-28, 16], [14, -28], [-14, -30], [36, 8], [-36, 10],
  ];
  spots.forEach(([x, z], i) => {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.24, 1.7, 10),
      new THREE.MeshStandardMaterial({ color: '#8A6A4F', roughness: 0.85 })
    );
    trunk.position.set(x, 0.85, z);
    trunk.castShadow = true;
    engine.scene.add(trunk);

    const c1 = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 2.4, 9),
      new THREE.MeshStandardMaterial({ color: i % 2 ? '#7AA95C' : '#5E9450', roughness: 0.8 })
    );
    c1.position.set(x, 2.6, z);
    c1.castShadow = true;
    engine.scene.add(c1);

    const c2 = new THREE.Mesh(
      new THREE.ConeGeometry(1.05, 1.8, 9),
      new THREE.MeshStandardMaterial({ color: i % 2 ? '#86B466' : '#68A058', roughness: 0.8 })
    );
    c2.position.set(x, 3.7, z);
    c2.castShadow = true;
    engine.scene.add(c2);

    // Va chạm thân cây (xe không xuyên cây)
    const body = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
    body.addShape(new CANNON.Cylinder(0.24, 0.24, 2.4, 10));
    body.position.set(x, 1.2, z);
    engine.world.addBody(body);
  });
}

/* ============================================================
   7) HUD — teleport menu, drawer, keycaps, d-pad, minimap
   ============================================================ */
function wireHUD() {
  /* Teleport menu */
  const menu = document.getElementById('teleportMenu');
  const btn = (label, id) => {
    const b = document.createElement('button');
    b.className = 'tp-btn';
    b.innerHTML = label;
    b.addEventListener('click', () => {
      if (id === 'spawn') {
        engine.carBody.position.set(0, 3, 0);
        engine.carBody.velocity.set(0, 0, 0);
        engine.carBody.angularVelocity.set(0, 0, 0);
        engine.carHeading = 0;
        engine.carBody.wakeUp();
      } else {
        engine.teleportToZone(id);
      }
    });
    menu.appendChild(b);
    return b;
  };
  btn('<b>⌂</b> Quảng trường', 'spawn');
  STATIONS.forEach((s) => btn(`<b>${s.ch}</b> ${s.name.replace('XƯỞNG SUNBII ', '').replace('SUNBII ', '')}`, s.id));

  /* Drawer đóng bằng nút ✕ (mở/đóng theo zone nằm ở module-level onZoneChange) */
  document.getElementById('drawerClose').addEventListener('click', () => {
    const drawer = document.getElementById('drawer');
    drawer.classList.remove('is-open');
  });

  /* Keycap light-up */
  document.addEventListener('keydown', (e) => {
    const kc = document.querySelector(`.kc[data-key="${e.code}"]`);
    if (kc) kc.classList.add('is-down');
  });
  document.addEventListener('keyup', (e) => {
    const kc = document.querySelector(`.kc[data-key="${e.code}"]`);
    if (kc) kc.classList.remove('is-down');
  });

  /* Mobile d-pad */
  const KEY_FIELD = { KeyW: 'forward', KeyS: 'backward', KeyA: 'left', KeyD: 'right', ShiftLeft: 'boost' };
  document.querySelectorAll('.dp').forEach((b) => {
    const code = b.dataset.key;
    const set = (v) => {
      const field = KEY_FIELD[code];
      if (field) engine.keys[field] = v;
      b.classList.toggle('is-down', v);
    };
    b.addEventListener('touchstart', (e) => { e.preventDefault(); set(true); }, { passive: false });
    b.addEventListener('touchend', (e) => { e.preventDefault(); set(false); }, { passive: false });
    b.addEventListener('touchcancel', () => set(false));
    b.addEventListener('mousedown', () => set(true));
    b.addEventListener('mouseup', () => set(false));
    b.addEventListener('mouseleave', () => set(false));
  });

  /* Minimap */
  const mm = document.getElementById('minimap');
  const mctx = mm.getContext('2d');
  function drawMinimap() {
    const S = mm.width;
    const scale = S / 96; // thế giới ±48m
    const cx = S / 2, cy = S / 2;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(38,50,56,0.82)';
    mctx.fillRect(0, 0, S, S);
    mctx.strokeStyle = 'rgba(245,215,142,0.35)';
    mctx.strokeRect(1, 1, S - 2, S - 2);

    // trạm
    STATIONS.forEach((s) => {
      mctx.beginPath();
      mctx.arc(cx + s.x * scale, cy + s.z * scale, 5, 0, Math.PI * 2);
      mctx.fillStyle = s.color;
      mctx.fill();
      mctx.strokeStyle = '#FFFDF8';
      mctx.lineWidth = 1.2;
      mctx.stroke();
    });

    // quảng trường
    mctx.fillStyle = '#F5D78E';
    mctx.fillRect(cx - 3, cy - 3, 6, 6);

    // xe + hướng chạy
    const px = cx + engine.carGroup.position.x * scale;
    const py = cy + engine.carGroup.position.z * scale;
    const fx = -Math.sin(engine.carHeading);
    const fz = -Math.cos(engine.carHeading);
    mctx.strokeStyle = '#FF471A';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.moveTo(px, py);
    mctx.lineTo(px + fx * 11, py + fz * 11);
    mctx.stroke();
    mctx.beginPath();
    mctx.arc(px, py, 4.2, 0, Math.PI * 2);
    mctx.fillStyle = '#FF471A';
    mctx.fill();
    mctx.strokeStyle = '#FFFDF8';
    mctx.lineWidth = 1.5;
    mctx.stroke();

    requestAnimationFrame(drawMinimap);
  }
  requestAnimationFrame(drawMinimap);

  /* Toast tự ẩn */
  setTimeout(() => {
    const t = document.getElementById('toast');
    if (t) t.classList.add('is-hidden');
  }, 7000);
}

/* ============================================================
   8) BOOT
   ============================================================ */
buildLetterBlocks();
buildDirectionPlates();
buildWorkshop();
buildStationProps();
buildNature();
wireHUD();

/* Ẩn loading sau khi thế giới dựng xong (1-2 frame render đầu)
   + đảm bảo tuyệt đối 3 giây — tab nền không bao giờ kẹt màn hình nạp */
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById('loader').classList.add('is-done');
  });
});
setTimeout(() => {
  document.getElementById('loader').classList.add('is-done');
}, 3000);
