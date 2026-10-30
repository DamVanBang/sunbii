/* ============================================================
   SUNBII WORLD v2 — đồ hoạ & tương tác nâng cấp (tham chiếu
   bruno-simon.com): sàn vẽ đường ra 6 trạm, RaycastVehicle,
   billboard tên trạm, âm thanh động cơ + va chạm, trang trí dày.
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
    desc: 'Xưởng sửa chữa pin xe điện thật: đóng khối pin, cân cell, sửa BMS/controller — kèm hệ thống tra cứu bảo hành điện tử minh bạch. Chiếc xe trên cần nâng là của khách, đừng tông!',
    url: 'https://services.sunbii.vn/', cta: 'Đặt lịch vào xưởng ↗', color: '#F59E0B',
    x: 24, z: 0, r: 4.8,
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
   2) ENGINE + CALLBACK ZONE
   ============================================================ */
const container = document.getElementById('world');

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
   3) SÀN VẼ CANVAS — đường ra 6 trạm (chất Bruno nằm ở đây)
   ============================================================ */
function buildGround() {
  const tex = engine.makeCanvasTexture((ctx, S) => {
    const s = S / 100, c = S / 2;
    const toPx = (x, z) => [c + x * s, c + z * s];

    // nền cát + vệt loang
    ctx.fillStyle = '#E5D8BE';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(198,182,148,${0.06 + Math.random() * 0.1})`;
      ctx.beginPath();
      ctx.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 28, 0, Math.PI * 2);
      ctx.fill();
    }

    // đường ra từng trạm + vạch đứt giữa + patch màu trạm
    ctx.lineCap = 'round';
    STATIONS.forEach((st) => {
      const [px, py] = toPx(st.x, st.z);
      ctx.strokeStyle = '#D8CBB0';
      ctx.lineWidth = 3.4 * s;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(px, py); ctx.stroke();

      ctx.strokeStyle = '#C4B491';
      ctx.lineWidth = 0.22 * s;
      ctx.setLineDash([1.1 * s, 1.2 * s]);
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = st.color + '59';
      ctx.beginPath(); ctx.arc(px, py, 5.4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = st.color;
      ctx.lineWidth = 0.22 * s;
      ctx.beginPath(); ctx.arc(px, py, 5.4 * s, 0, Math.PI * 2); ctx.stroke();
    });

    // quảng trường: vòng + chữ SUNBII sơn trên nền
    ctx.fillStyle = 'rgba(255,253,248,0.5)';
    ctx.beginPath(); ctx.arc(c, c, 8.6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#D84315';
    ctx.lineWidth = 0.28 * s;
    ctx.beginPath(); ctx.arc(c, c, 8.6 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#D84315';
    ctx.font = `900 ${3.1 * s}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SUNBII', c, c + 1.05 * s);
    ctx.font = `700 ${0.85 * s}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = '#263238';
    ctx.fillText('WORLD HQ', c, c + 2.1 * s);

    // vạch qua đường hai phía nam bắc quảng trường
    ctx.fillStyle = '#263238';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(c - 7.5 * s, c + (10.4 + i * 0.95) * s, 15 * s, 0.4 * s);
    }
  }, 2048);
  engine.setGroundTexture(tex);
}

/* ============================================================
   4) BILLBOARD TÊN TRẠM + CHỮ SUNBII + KY BOWLING
   ============================================================ */
function buildSignage() {
  STATIONS.forEach((S) => {
    engine.addNameSprite(S.name, S.color, new THREE.Vector3(S.x, 4.7, S.z));
  });

  // Chữ SUNBII 3D húc đổ được
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
      color: '#ffffff', mass: 2.5, texture: tex,
    });
  });

  // 6 ky bowling kiểu dáng tam giác (góc đông quảng trường)
  let pin = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col <= row; col++) {
      engine.addDynamicCylinder({
        pos: new THREE.Vector3(11 + col * 0.62 - row * 0.31, 0.48, 3.5 + row * 0.7),
        radiusTop: 0.16, radiusBottom: 0.3, height: 0.95,
        color: pin++ % 2 ? '#FFFDF8' : '#FF6B35', mass: 0.45, roughness: 0.35,
      });
    }
  }
}

/* ============================================================
   5) TRẠM 02 — XƯỞNG SUNBII SERVICES (ga-ra pin xe điện)
   ============================================================ */
function buildWorkshop() {
  const S = STATIONS.find((s) => s.id === 'workshop');
  const cx = S.x, cz = S.z;

  // Sàn bê tông + vết dầu
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.12, 11),
    new THREE.MeshStandardMaterial({ color: '#9C9A92', roughness: 0.9 })
  );
  slab.position.set(cx + 0.5, 0.06, cz + 1);
  slab.receiveShadow = true;
  engine.scene.add(slab);
  [[-3, 2], [1.5, -1.5], [3.5, 3]].forEach(([dx, dz]) => {
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(0.5 + Math.random() * 0.4, 18),
      new THREE.MeshStandardMaterial({ color: '#4A4E57', roughness: 0.95, transparent: true, opacity: 0.35 })
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(cx + 0.5 + dx, 0.13, cz + 1 + dz);
    engine.scene.add(stain);
  });

  // Tường sau + hai tường bên (tôn sọc)
  const wallTex = engine.makeCanvasTexture((ctx, S2) => {
    ctx.fillStyle = '#B9BdC6';
    ctx.fillRect(0, 0, S2, S2);
    for (let x = 0; x < S2; x += S2 / 24) {
      ctx.fillStyle = x / (S2 / 24) % 2 ? '#A9ADB6' : '#C4C8D0';
      ctx.fillRect(x, 0, S2 / 24, S2);
    }
  }, 256);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(4, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7, metalness: 0.2 });
  const mkWall = (w, h, d, px, py, pz) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(px, py, pz);
    m.castShadow = true;
    m.receiveShadow = true;
    engine.scene.add(m);
    const b = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
    b.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    b.position.set(px, py, pz);
    engine.world.addBody(b);
  };
  mkWall(14, 3.4, 0.25, cx + 0.5, 1.7, cz - 4.4);   // tường sau
  mkWall(0.25, 3.4, 11, cx + 7.4, 1.7, cz + 1);     // tường phải
  mkWall(0.25, 3.4, 11, cx - 6.4, 1.7, cz + 1);     // tường trái

  // BẢNG HIỆU trên cao
  const signTex = engine.makeCanvasTexture((ctx, S2) => {
    ctx.fillStyle = '#263238';
    ctx.fillRect(0, 0, S2, S2);
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(0, S2 * 0.38, S2, S2 * 0.24);
    ctx.fillStyle = '#FFFDF8';
    ctx.font = `900 ${S2 * 0.125}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('XƯỞNG', S2 / 2, S2 * 0.29);
    ctx.fillText('SUNBII SERVICES', S2 / 2, S2 * 0.55);
    ctx.font = `500 ${S2 * 0.07}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('PIN · BMS · CÂN CELL', S2 / 2, S2 * 0.74);
  }, 512);
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 4.2, 2.1, cz - 4.15), size: { x: 0.3, y: 4.2, z: 0.3 }, color: '#4A4E57', metalness: 0.6, roughness: 0.4 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx + 5.2, 2.1, cz - 4.15), size: { x: 0.3, y: 4.2, z: 0.3 }, color: '#4A4E57', metalness: 0.6, roughness: 0.4 });
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 2.4, 0.2),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.6 })
  );
  signBoard.position.set(cx + 0.5, 3.4, cz - 4.1);
  signBoard.castShadow = true;
  engine.scene.add(signBoard);

  // CẦ NÂNG + xe khách hàng
  const liftY = 1.4;
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 1.7, 0.7, cz + 1.4), size: { x: 0.45, y: 1.4, z: 0.55 }, color: '#F59E0B', metalness: 0.5, roughness: 0.35 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx + 1.7, 0.7, cz + 1.4), size: { x: 0.45, y: 1.4, z: 0.55 }, color: '#F59E0B', metalness: 0.5, roughness: 0.35 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx, liftY, cz + 1.4), size: { x: 4.6, y: 0.24, z: 2.6 }, color: '#5B616B', metalness: 0.6, roughness: 0.4 });
  const oldCar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 3.8), new THREE.MeshStandardMaterial({ color: '#B0553A', roughness: 0.4, metalness: 0.25 }));
  oldCar.position.set(cx, liftY + 0.43, cz + 1.4);
  oldCar.castShadow = true;
  engine.scene.add(oldCar);
  const oldCabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.52, 1.8), new THREE.MeshStandardMaterial({ color: '#22252A', roughness: 0.25, metalness: 0.7 }));
  oldCabin.position.set(cx, liftY + 1.0, cz + 1.1);
  oldCabin.castShadow = true;
  engine.scene.add(oldCabin);
  const liftPhy = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
  liftPhy.addShape(new CANNON.Box(new CANNON.Vec3(1.05, 0.6, 1.95)));
  liftPhy.position.set(cx, liftY + 0.62, cz + 1.4);
  engine.world.addBody(liftPhy);

  // KỆ CELL 18650 (2 kệ × 12 cell)
  [-3.2, 3.2].forEach((dx) => {
    const rackX = cx + dx;
    engine.addStaticBox({ pos: new THREE.Vector3(rackX, 1.1, cz - 2.6), size: { x: 1.7, y: 2.2, z: 0.55 }, color: '#3E4450', metalness: 0.4, roughness: 0.5 });
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cell = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.13, 0.44, 14),
          new THREE.MeshStandardMaterial({ color: row === 1 ? '#F59E0B' : '#34D399', roughness: 0.3, metalness: 0.35 })
        );
        cell.position.set(rackX - 0.55 + col * 0.37, 0.58 + row * 0.64, cz - 2.32);
        cell.castShadow = true;
        engine.scene.add(cell);
      }
    }
  });

  // CELL RỜI trên sàn (đổ được)
  for (let i = 0; i < 6; i++) {
    engine.addDynamicCylinder({
      pos: new THREE.Vector3(cx - 1.4 + i * 0.55, 0.22, cz + 4 + (i % 2) * 0.5),
      radiusTop: 0.13, radiusBottom: 0.13, height: 0.44,
      color: i % 2 ? '#34D399' : '#F59E0B', mass: 0.4,
    });
  }

  // BÀN LÀM VIỆC + thùng phuy
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 5.1, 0.52, cz + 2.6), size: { x: 1.0, y: 1.04, z: 3.0 }, color: '#7A5C3E', roughness: 0.75 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 5.1, 1.1, cz + 2.6), size: { x: 1.25, y: 0.1, z: 3.3 }, color: '#4A4E57', metalness: 0.5, roughness: 0.35 });
  [-1, 1].forEach((sx) => {
    engine.addDynamicCylinder({
      pos: new THREE.Vector3(cx + 5 + sx * 1.2, 0.55, cz + 3.4),
      radiusTop: 0.42, radiusBottom: 0.42, height: 1.1,
      color: sx > 0 ? '#F59E0B' : '#3E4450', mass: 3, roughness: 0.55, seg: 18,
    });
  });
}

/* ============================================================
   6) CÁC TRẠM KHÁC — trang trí theo chủ đề từng trang web
   ============================================================ */
function buildStationProps() {
  STATIONS.forEach((S) => {
    const { x, z } = S;

    if (S.id === 'api') {
      [-2.4, 0, 2.4].forEach((dx, k) => {
        const tex = engine.makeCanvasTexture((ctx, S2) => {
          ctx.fillStyle = '#181C24';
          ctx.fillRect(0, 0, S2, S2);
          for (let r = 0; r < 7; r++) {
            ctx.fillStyle = (r + k) % 3 === 0 ? '#34D399' : '#0E2A44';
            ctx.fillRect(S2 * 0.16, S2 * (0.1 + r * 0.12), S2 * 0.68, S2 * 0.05);
          }
        }, 128);
        engine.addStaticBox({
          pos: new THREE.Vector3(x + dx, 2.25, z - 1.6),
          size: { x: 1.5, y: 4.5, z: 1.1 },
          color: '#ffffff', texture: tex, metalness: 0.4, roughness: 0.35,
        });
      });
      // cáp nối các tháp
      for (let k = 0; k < 2; k++) {
        const cable = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.06, 0.06),
          new THREE.MeshStandardMaterial({ color: '#0E2A44', roughness: 0.5 })
        );
        cable.position.set(x - 1.2 + k * 2.4, 3.4 - k * 0.7, z - 1.6);
        engine.scene.add(cable);
      }
      engine.addDynamicBox({ pos: new THREE.Vector3(x + 1.4, 0.5, z + 2.2), size: { x: 0.9, y: 0.9, z: 0.9 }, color: '#2563EB', mass: 1.2 });
    }

    if (S.id === 'invites') {
      engine.addStaticCylinder({ pos: new THREE.Vector3(x - 2.2, 1.6, z - 1), radiusTop: 0.22, radiusBottom: 0.26, height: 3.2, color: '#F8B4C4', roughness: 0.4 });
      engine.addStaticCylinder({ pos: new THREE.Vector3(x + 2.2, 1.6, z - 1), radiusTop: 0.22, radiusBottom: 0.26, height: 3.2, color: '#F8B4C4', roughness: 0.4 });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: '#F5D78E', roughness: 0.4 }));
      beam.position.set(x, 3.3, z - 1);
      beam.castShadow = true;
      engine.scene.add(beam);
      // hoa trên vòm
      for (let f = 0; f < 7; f++) {
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 10, 8),
          new THREE.MeshStandardMaterial({ color: f % 2 ? '#F59E0B' : '#FFF8EF', roughness: 0.4 })
        );
        fl.position.set(x - 2.2 + (f / 6) * 4.4, 3.3 + 0.18, z - 1 + Math.sin(f * 2.1) * 0.12);
        engine.scene.add(fl);
      }
      // thảm lối đi
      const carpet = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 7),
        new THREE.MeshStandardMaterial({ color: '#F8B4C4', roughness: 0.85 })
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(x, 0.02, z + 4);
      carpet.receiveShadow = true;
      engine.scene.add(carpet);
      engine.addDynamicBox({ pos: new THREE.Vector3(x - 1, 0.55, z + 1.5), size: { x: 0.9, y: 0.1, z: 0.65 }, color: '#FFF8EF', mass: 0.5, rotY: 0.3 });
      engine.addDynamicBox({ pos: new THREE.Vector3(x + 1, 0.55, z + 1.2), size: { x: 0.9, y: 0.1, z: 0.65 }, color: '#F8B4C4', mass: 0.5, rotY: -0.2 });
    }

    if (S.id === 'ev') {
      engine.addStaticCylinder({ pos: new THREE.Vector3(x - 1.6, 1.25, z), radiusTop: 0.42, radiusBottom: 0.5, height: 2.5, color: '#10B981', roughness: 0.35, metalness: 0.3, seg: 20 });
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.9, 0.1),
        new THREE.MeshStandardMaterial({ color: '#052E22', roughness: 0.2, metalness: 0.4 })
      );
      screen.position.set(x - 1.6, 1.55, z + 0.48);
      engine.scene.add(screen);
      // pin dự phòng lớn
      engine.addStaticBox({ pos: new THREE.Vector3(x + 2.2, 0.55, z - 1), size: { x: 1.6, y: 1.1, z: 0.9 }, color: '#0E2A44', metalness: 0.4, roughness: 0.35 });
      for (let i = 0; i < 4; i++) {
        engine.addDynamicCylinder({
          pos: new THREE.Vector3(x + 1.4 + (i % 2) * 1.6, 0.36, z - 2 + i * 1.4),
          radiusTop: 0.08, radiusBottom: 0.3, height: 0.66,
          color: '#FF6B35', mass: 0.35,
        });
      }
    }

    if (S.id === 'forum') {
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
      // chồng sách
      [[-0.5, '#EC4899'], [0, '#2563EB'], [0.5, '#F59E0B']].forEach(([dx, color], k) => {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.14, 0.5),
          new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
        );
        book.position.set(x + 1.6, 0.07 + k * 0.15, z + 0.2);
        book.rotation.y = (k - 1) * 0.3;
        book.castShadow = true;
        engine.scene.add(book);
      });
    }

    if (S.id === 'founder') {
      [-1.8, 0, 1.8].forEach((dx, k) => {
        engine.addStaticCylinder({ pos: new THREE.Vector3(x + dx, 0.5, z + (k === 1 ? -0.8 : 0.4)), radiusTop: 0.55, radiusBottom: 0.7, height: 1.0, color: k === 1 ? '#D84315' : '#FFFDF8', roughness: 0.4, seg: 28 });
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.6, 0.06),
          new THREE.MeshStandardMaterial({ color: '#263238', roughness: 0.3 })
        );
        frame.position.set(x + dx, 1.35, z + (k === 1 ? -0.8 : 0.4));
        engine.scene.add(frame);
      });
      // cúp xoay giữa
      const trophy = new THREE.Group();
      const cup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.12, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: '#FBC02D', metalness: 0.9, roughness: 0.15 })
      );
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.16, 10),
        new THREE.MeshStandardMaterial({ color: '#FBC02D', metalness: 0.9, roughness: 0.15 })
      );
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14),
        new THREE.MeshStandardMaterial({ color: '#263238', roughness: 0.3 })
      );
      stem.position.y = -0.22; base.position.y = -0.32;
      trophy.add(cup, stem, base);
      trophy.position.set(x, 1.75, z - 0.8);
      engine.scene.add(trophy);
      engine.onFrame = engine.onFrame || [];
      engine.onFrame.push((t) => { trophy.rotation.y = t * 1.4; });
    }
  });
}

/* ============================================================
   7) CÂY + ĐÁ (tán cầu thay cho nón — chất Bruno hơn)
   ============================================================ */
function buildNature() {
  const spots = [
    [30, -18], [34, -6], [-30, -20], [-34, -4], [-12, 28], [12, 30],
    [28, 18], [-28, 16], [14, -28], [-14, -30], [36, 8], [-36, 10],
  ];
  spots.forEach(([x, z], i) => {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.26, 1.9, 10),
      new THREE.MeshStandardMaterial({ color: '#8A6A4F', roughness: 0.85 })
    );
    trunk.position.set(x, 0.95, z);
    trunk.castShadow = true;
    engine.scene.add(trunk);

    const greens = ['#7AA95C', '#5E9450', '#86B466'];
    [[0, 3.0, 1.35], [0.7, 2.5, 0.95], [-0.65, 2.7, 0.85]].forEach(([dx, fy, fr], k) => {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(fr, 12, 10),
        new THREE.MeshStandardMaterial({ color: greens[(i + k) % 3], roughness: 0.85 })
      );
      ball.position.set(x + dx, fy, z + (k - 1) * 0.3);
      ball.castShadow = true;
      engine.scene.add(ball);
    });

    const body = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
    body.addShape(new CANNON.Cylinder(0.24, 0.24, 2.4, 10));
    body.position.set(x, 1.2, z);
    engine.world.addBody(body);
  });

  // đá tảng
  [[9, 14], [-8, 16], [16, 8], [-16, 12], [0, -20]].forEach(([x, z]) => {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.4, 0),
      new THREE.MeshStandardMaterial({ color: '#B8B2A4', roughness: 0.85 })
    );
    rock.position.set(x, 0.3, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    engine.scene.add(rock);
  });
}

/* ============================================================
   8) HUD — teleport, drawer, keycap, d-pad, minimap, âm thanh
   ============================================================ */
function wireHUD() {
  const menu = document.getElementById('teleportMenu');
  const btn = (label, id) => {
    const b = document.createElement('button');
    b.className = 'tp-btn';
    b.innerHTML = label;
    b.addEventListener('click', () => {
      if (id === 'spawn') engine.teleportHome();
      else engine.teleportToZone(id);
    });
    menu.appendChild(b);
    return b;
  };
  btn('<b>⌂</b> Quảng trường', 'spawn');
  STATIONS.forEach((s) => btn(`<b>${s.ch}</b> ${s.name.replace('XƯỞNG SUNBII ', '').replace('SUNBII ', '')}`, s.id));

  document.getElementById('drawerClose').addEventListener('click', () => {
    document.getElementById('drawer').classList.remove('is-open');
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
  const fwd = new THREE.Vector3();
  function drawMinimap() {
    const S = mm.width;
    const scale = S / 96;
    const cx = S / 2, cy = S / 2;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(38,50,56,0.82)';
    mctx.fillRect(0, 0, S, S);
    mctx.strokeStyle = 'rgba(245,215,142,0.35)';
    mctx.strokeRect(1, 1, S - 2, S - 2);

    // đường đã vẽ trên ground → vẽ lại tuyến ra trạm cho minimap
    mctx.strokeStyle = 'rgba(216,203,176,0.55)';
    mctx.lineWidth = 3;
    STATIONS.forEach((s) => {
      mctx.beginPath();
      mctx.moveTo(cx, cy);
      mctx.lineTo(cx + s.x * scale, cy + s.z * scale);
      mctx.stroke();
    });

    STATIONS.forEach((s) => {
      mctx.beginPath();
      mctx.arc(cx + s.x * scale, cy + s.z * scale, 5, 0, Math.PI * 2);
      mctx.fillStyle = s.color;
      mctx.fill();
      mctx.strokeStyle = '#FFFDF8';
      mctx.lineWidth = 1.2;
      mctx.stroke();
    });

    mctx.fillStyle = '#F5D78E';
    mctx.fillRect(cx - 3, cy - 3, 6, 6);

    const px = cx + engine.carGroup.position.x * scale;
    const py = cy + engine.carGroup.position.z * scale;
    fwd.set(0, 0, 1).applyQuaternion(engine.carGroup.quaternion);
    mctx.strokeStyle = '#FF471A';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.moveTo(px, py);
    mctx.lineTo(px + fwd.x * 11, py + fwd.z * 11);
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

/* ---------- Âm thanh: động cơ + va chạm (WebAudio, không file) ---------- */
function initAudio() {
  const btn = document.getElementById('audioToggle');
  let ctx = null, master = null, engineOsc = null, engineGain = null;
  let started = false, muted = false;

  function ensure() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 46;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 460;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    started = true;
  }

  engine.audio = {
    setSpeed(kmh, throttle) {
      if (!started || !ctx) return;
      const f = 46 + kmh * 4.4 + throttle * 12;
      engineOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.045 + throttle * 0.05, ctx.currentTime, 0.12);
    },
    thud(power) {
      if (!started || !ctx || muted) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.05 + 0.3 * power, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + 0.22);
    },
    toggleMute() {
      muted = !muted;
      if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
      return muted;
    },
  };

  /* Chỉ bật tiếng sau tương tác đầu tiên (autoplay policy) */
  let kicked = false;
  const kick = (e) => {
    if (kicked) return;
    if (e && e.target && e.target.closest?.('#audioToggle')) return;
    kicked = true;
    ensure();
    engine.onCollide = (p) => engine.audio.thud(p);
  };
  addEventListener('keydown', kick, { capture: true });
  addEventListener('pointerdown', kick, { capture: true });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    kicked = true;
    ensure();
    const m = engine.audio.toggleMute();
    btn.textContent = m ? '🔇' : '🔊';
    btn.classList.toggle('is-muted', m);
  });
}

/* ============================================================
   9) BOOT — dựng thế giới + camera bay vào
   ============================================================ */
buildGround();
buildSignage();
buildWorkshop();
buildStationProps();
buildNature();
initAudio();
wireHUD();

/* Camera bay từ trên cao xuống góc iso chuẩn (như mở đầu phim) */
engine.camera.position.set(0, 44, 74);
engine.cameraOffset.set(0, 42, 68);
if (window.gsap) {
  gsap.to(engine.cameraOffset, { x: 0, y: 13, z: 17, duration: 2.6, ease: 'power2.inOut' });
} else {
  engine.cameraOffset.set(0, 13, 17);
}

/* Ẩn loading: 2 frame render + đảm bảo tuyệt đối 3 giây */
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById('loader').classList.add('is-done');
  });
});
setTimeout(() => {
  document.getElementById('loader').classList.add('is-done');
}, 3000);
