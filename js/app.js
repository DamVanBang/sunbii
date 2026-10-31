/* ============================================================
   SUNBII WORLD v3 — Cinematic Warm/Autumn
   Palette mùa thu ấm · hàng rào gỗ · cây thông/cây tròn low-poly
   · đá tảng · model 3D thật tải từ Khronos glTF samples (CC-BY)
   · chữ SUNBII TextGeometry 3D thật · RoomEnvironment studio.
   Engine: PlayableWorldEngine v3 (RaycastVehicle chống lật).
   ============================================================ */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { PlayableWorldEngine } from './engine.js?v=35';

/* Màu trạm đã dịu (desaturated) cho cảnh 3D — UI drawer dùng cùng giá trị */
const STATIONS = [
  {
    id: 'api', ch: '01', name: 'SUNBII API', sub: 'Workspace 17 module · Tự động hoá',
    desc: 'Nền tảng API bảo mật, hiệu năng cao phục vụ hàng triệu yêu cầu mỗi ngày: xác thực, captcha, thông báo, quản lý bảo hành, kho và vận hành server — không cần can thiệp thủ công.',
    url: 'https://api.sunbii.vn/', cta: 'Mở workspace ↗', color: '#4A6FA5',
    x: 0, z: -24, r: 4.2,
    specs: [['17+', 'module'], ['1M+/ngày', 'yêu cầu'], ['24/7', 'uptime monitor']],
  },
  {
    id: 'workshop', ch: '02', name: 'XƯỞNG SUNBII SERVICES', sub: 'Pin lithium · BMS · Cân cell',
    desc: 'Xưởng sửa chữa pin xe điện thật: đóng khối pin, cân cell, sửa BMS/controller — kèm hệ thống tra cứu bảo hành điện tử minh bạch. Chiếc xe trên cần nâng là của khách, đừng tông!',
    url: 'https://services.sunbii.vn/', cta: 'Đặt lịch vào xưởng ↗', color: '#C98E3F',
    x: 24, z: 0, r: 4.8,
    specs: [['±5mV', 'độ chính xác cell'], ['6–12T', 'bảo hành pin'], ['100%', 'phiếu điện tử']],
  },
  {
    id: 'invites', ch: '03', name: 'SUNBII INVITES', sub: 'Thiệp cưới điện ảnh online',
    desc: 'Thiệp cưới, sinh nhật, họp lớp: link riêng, album, âm nhạc, RSVP & sổ lưu bút — xem ngay trên trình duyệt, không cần cài đặt.',
    url: 'https://invites.sunbii.vn/', cta: 'Tạo thiệp ↗', color: '#C98E9F',
    x: -24, z: 0, r: 4.2,
    specs: [['3', 'dịp thiệp'], ['RSVP', '+ sổ lưu bút'], ['4', 'gói Free→VIP']],
  },
  {
    id: 'ev', ch: '04', name: 'EV-S3 CYBERCOCKPIT', sub: 'Buồng lái số cho xe điện',
    desc: 'Điều khiển trung tâm ESP32-S3: JK BMS qua BLE/4G, GPS L76K và bản đồ MapLibre 3D — giám sát từng cell pin realtime ngay trên điện thoại.',
    url: 'https://ev.sunbii.vn/', cta: 'Vào buồng lái ↗', color: '#5FA37E',
    x: 0, z: 24, r: 4.2,
    specs: [['ESP32-S3', 'dual-core 240MHz'], ['JK BMS', 'realtime'], ['3D', 'MapLibre']],
  },
  {
    id: 'forum', ch: '05', name: 'SUNBII FORUM', sub: 'Cộng đồng & tri thức',
    desc: 'Mái nhà chung của hệ sinh thái: chia sẻ kinh nghiệm, tài liệu kỹ thuật và hỗ trợ sản phẩm SUNBII — nơi tri thức đi vòng tròn.',
    url: 'https://forum.sunbii.vn/', cta: 'Vào diễn đàn ↗', color: '#8B7FB5',
    x: -17, z: -17, r: 3.8,
    specs: [['100%', 'miễn phí'], ['24/7', 'cộng đồng'], ['VI', 'ngôn ngữ']],
  },
  {
    id: 'founder', ch: '06', name: 'FOUNDER PORTFOLIO', sub: 'Đàm Văn Bằng · Kiến trúc sư',
    desc: 'Hồ sơ trình diễn WebGL của người sáng lập — sinh năm 2006, kiến tạo SUNBII từ 20/01/2021, vẫn viết code mỗi ngày.',
    url: 'https://damvanbang.sunbii.vn/', cta: 'Xem hồ sơ ↗', color: '#C45B4E',
    x: 17, z: -17, r: 3.8,
    specs: [['2006', 'gen Z builder'], ['6', 'sản phẩm'], ['20·01·21', 'SUNBII day one']],
  },
];

const LETTERS = ['S', 'U', 'N', 'B', 'I', 'I'];
const LETTER_COLORS = ['#A84B33', '#C98E3F', '#3E4A38', '#C9A23F', '#A84B33', '#3E4A38'];

/* ============================================================
   ENGINE + CALLBACK ZONE
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

let engine = null;
try {
  engine = new PlayableWorldEngine(container, onZoneChange, { stations: STATIONS, bounds: 45 });
} catch (e) {
  (window.__buildErrors = window.__buildErrors || []).push('CONSTRUCTOR: ' + e.message + ' | ' + String(e.stack).split('\n')[1]);
}
window.__world = engine;

/* ============================================================
   SÀN VẼ MÙA THU — đường + vạch + patch trạm + chữ sơn
   ============================================================ */
function buildGround() {
  const tex = engine.makeCanvasTexture((ctx, S) => {
    const s = S / 100, c = S / 2;
    const toPx = (x, z) => [c + x * s, c + z * s];

    ctx.fillStyle = '#D3BF97';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 320; i++) {
      const warm = Math.random() < 0.5;
      ctx.fillStyle = warm
        ? `rgba(196,166,120,${0.06 + Math.random() * 0.1})`
        : `rgba(150,130,96,${0.05 + Math.random() * 0.08})`;
      ctx.beginPath();
      ctx.arc(Math.random() * S, Math.random() * S, 6 + Math.random() * 30, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineCap = 'round';
    STATIONS.forEach((st) => {
      const [px, py] = toPx(st.x, st.z);
      ctx.strokeStyle = '#C2AC80';
      ctx.lineWidth = 3.4 * s;
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(px, py); ctx.stroke();

      ctx.strokeStyle = '#AB9468';
      ctx.lineWidth = 0.22 * s;
      ctx.setLineDash([1.1 * s, 1.2 * s]);
      ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(px, py); ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = st.color + '42';
      ctx.beginPath(); ctx.arc(px, py, 5.4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = st.color;
      ctx.lineWidth = 0.22 * s;
      ctx.beginPath(); ctx.arc(px, py, 5.4 * s, 0, Math.PI * 2); ctx.stroke();
    });

    ctx.fillStyle = 'rgba(226,211,172,0.55)';
    ctx.beginPath(); ctx.arc(c, c, 8.6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#A84B33';
    ctx.lineWidth = 0.28 * s;
    ctx.beginPath(); ctx.arc(c, c, 8.6 * s, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#A84B33';
    ctx.font = `900 ${3.1 * s}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('SUNBII', c, c + 1.05 * s);
    ctx.font = `700 ${0.85 * s}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = '#3E4A38';
    ctx.fillText('WORLD HQ', c, c + 2.1 * s);

    ctx.fillStyle = '#4A3A2A';
    for (let i = 0; i < 6; i++) {
      ctx.fillRect(c - 7.5 * s, c + (10.4 + i * 0.95) * s, 15 * s, 0.4 * s);
    }
  }, 2048);
  engine.setGroundTexture(tex);
}

/* ============================================================
   BILLBOARD TÊN TRẠM + CHỮ SUNBII TEXTGEOMETRY + KY BOWLING
   ============================================================ */
function buildSignage() {
  STATIONS.forEach((S) => {
    engine.addNameSprite(S.name, S.color, new THREE.Vector3(S.x, 4.7, S.z));
  });

  /* Chữ SUNBII: TextGeometry 3D thật (font helvetiker_bold) — fallback khối bo */
  const fontUrl = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json';
  new FontLoader().load(
    fontUrl,
    (font) => {
      LETTERS.forEach((ch, i) => {
        const geo = new TextGeometry(ch, {
          font,
          size: 1.32,
          height: 0.42,
          curveSegments: 6,
          bevelEnabled: true,
          bevelThickness: 0.035,
          bevelSize: 0.028,
          bevelSegments: 2,
        });
        geo.computeBoundingBox();
        const bb = geo.boundingBox;
        const w = bb.max.x - bb.min.x;
        geo.translate(-bb.min.x - w / 2, 0, -(bb.max.z - bb.min.z) / 2);
        const mat = new THREE.MeshStandardMaterial({
          color: LETTER_COLORS[i], roughness: 0.32, metalness: 0.25,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        engine.scene.add(mesh);
        const pw = Math.max(w, 0.8);
        const body = new CANNON.Body({ mass: 3, material: engine.defaultMaterial, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.5 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(pw / 2, 0.72, 0.3)));
        body.position.set((i - 2.5) * 1.72, 0.78, -14.5);
        body.sleep();
        engine.world.addBody(body);
        engine.syncList.push({ mesh, body });
      });
    },
    undefined,
    () => {
      // Fallback: khối bo tròn (RoundedBoxGeometry) + texture chữ
      LETTERS.forEach((ch, i) => {
        const tex = engine.makeCanvasTexture((ctx, S) => {
          ctx.fillStyle = LETTER_COLORS[i];
          ctx.fillRect(0, 0, S, S);
          ctx.fillStyle = '#F4EBDD';
          ctx.font = `900 ${S * 0.62}px "Be Vietnam Pro", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(ch, S / 2, S / 2 + S * 0.04);
        });
        engine.addDynamicBox({
          pos: new THREE.Vector3((i - 2.5) * 1.72, 0.78, -14.5),
          size: { x: 1.42, y: 1.42, z: 1.42 },
          color: '#ffffff', mass: 3, texture: tex,
        });
      });
    }
  );

  // Ky bowling tam giác
  let pin = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col <= row; col++) {
      engine.addDynamicCylinder({
        pos: new THREE.Vector3(11 + col * 0.62 - row * 0.31, 0.48, 3.5 + row * 0.7),
        radiusTop: 0.16, radiusBottom: 0.3, height: 0.95,
        color: pin % 2 ? '#EFE6D2' : '#B5533C', mass: 0.45, roughness: 0.4,
      });
      pin++;
    }
  }
}

/* ============================================================
   XƯỞNG SUNBII SERVICES + GearboxAssy (model Khronos, CC-BY)
   ============================================================ */
function buildWorkshop() {
  const S = STATIONS.find((s) => s.id === 'workshop');
  const cx = S.x, cz = S.z;

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(14, 0.12, 11),
    new THREE.MeshStandardMaterial({ color: '#A8A199', roughness: 0.92 })
  );
  slab.position.set(cx + 0.5, 0.06, cz + 1);
  slab.receiveShadow = true;
  engine.scene.add(slab);
  [[-3, 2], [1.5, -1.5], [3.5, 3]].forEach(([dx, dz]) => {
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(0.5 + Math.random() * 0.4, 18),
      new THREE.MeshStandardMaterial({ color: '#4E4A42', roughness: 0.95, transparent: true, opacity: 0.3 })
    );
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(cx + 0.5 + dx, 0.13, cz + 1 + dz);
    engine.scene.add(stain);
  });

  const wallTex = engine.makeCanvasTexture((ctx, S2) => {
    ctx.fillStyle = '#B0A88F';
    ctx.fillRect(0, 0, S2, S2);
    for (let x = 0; x < S2; x += S2 / 24) {
      ctx.fillStyle = (x / (S2 / 24)) % 2 ? '#A29A83' : '#B9B19A';
      ctx.fillRect(x, 0, S2 / 24, S2);
    }
  }, 256);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  wallTex.repeat.set(4, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75, metalness: 0.15 });
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
  mkWall(14, 3.4, 0.25, cx + 0.5, 1.7, cz - 4.4);
  mkWall(0.25, 3.4, 11, cx + 7.4, 1.7, cz + 1);
  mkWall(0.25, 3.4, 11, cx - 6.4, 1.7, cz + 1);

  const signTex = engine.makeCanvasTexture((ctx, S2) => {
    ctx.fillStyle = '#3E3428';
    ctx.fillRect(0, 0, S2, S2);
    ctx.fillStyle = '#C98E3F';
    ctx.fillRect(0, S2 * 0.38, S2, S2 * 0.24);
    ctx.fillStyle = '#F4EBDD';
    ctx.font = `900 ${S2 * 0.125}px "Be Vietnam Pro", sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('XƯỞNG', S2 / 2, S2 * 0.29);
    ctx.fillText('SUNBII SERVICES', S2 / 2, S2 * 0.55);
    ctx.font = `500 ${S2 * 0.07}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = '#C98E3F';
    ctx.fillText('PIN · BMS · CÂN CELL', S2 / 2, S2 * 0.74);
  }, 512);
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 4.2, 2.1, cz - 4.15), size: { x: 0.3, y: 4.2, z: 0.3 }, color: '#4A3A2A', metalness: 0.3, roughness: 0.55 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx + 5.2, 2.1, cz - 4.15), size: { x: 0.3, y: 4.2, z: 0.3 }, color: '#4A3A2A', metalness: 0.3, roughness: 0.55 });
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(9.8, 2.4, 0.2),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.65 })
  );
  signBoard.position.set(cx + 0.5, 3.4, cz - 4.1);
  signBoard.castShadow = true;
  engine.scene.add(signBoard);

  const liftY = 1.4;
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 1.7, 0.7, cz + 1.4), size: { x: 0.45, y: 1.4, z: 0.55 }, color: '#C98E3F', metalness: 0.55, roughness: 0.35 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx + 1.7, 0.7, cz + 1.4), size: { x: 0.45, y: 1.4, z: 0.55 }, color: '#C98E3F', metalness: 0.55, roughness: 0.35 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx, liftY, cz + 1.4), size: { x: 4.6, y: 0.24, z: 2.6 }, color: '#6B6E66', metalness: 0.65, roughness: 0.35 });
  const oldCar = new THREE.Mesh(
    new THREE.BoxGeometry(2.0, 0.62, 3.8),
    new THREE.MeshStandardMaterial({ color: '#8F6E4E', roughness: 0.45, metalness: 0.3 })
  );
  oldCar.position.set(cx, liftY + 0.43, cz + 1.4);
  oldCar.castShadow = true;
  engine.scene.add(oldCar);
  const oldCabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.52, 1.8),
    new THREE.MeshPhysicalMaterial({ color: '#1C2228', roughness: 0.08, metalness: 0.3, envMapIntensity: 1.6 })
  );
  oldCabin.position.set(cx, liftY + 1.0, cz + 1.1);
  oldCabin.castShadow = true;
  engine.scene.add(oldCabin);
  const liftPhy = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
  liftPhy.addShape(new CANNON.Box(new CANNON.Vec3(1.05, 0.6, 1.95)));
  liftPhy.position.set(cx, liftY + 0.62, cz + 1.4);
  engine.world.addBody(liftPhy);

  [-3.2, 3.2].forEach((dx) => {
    const rackX = cx + dx;
    engine.addStaticBox({ pos: new THREE.Vector3(rackX, 1.1, cz - 2.6), size: { x: 1.7, y: 2.2, z: 0.55 }, color: '#4A4238', metalness: 0.3, roughness: 0.55 });
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        const cell = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.13, 0.44, 14),
          new THREE.MeshStandardMaterial({ color: row === 1 ? '#C98E3F' : '#6B8E5E', roughness: 0.35, metalness: 0.4 })
        );
        cell.position.set(rackX - 0.55 + col * 0.37, 0.58 + row * 0.64, cz - 2.32);
        cell.castShadow = true;
        engine.scene.add(cell);
      }
    }
  });

  for (let i = 0; i < 6; i++) {
    engine.addDynamicCylinder({
      pos: new THREE.Vector3(cx - 1.4 + i * 0.55, 0.22, cz + 4 + (i % 2) * 0.5),
      radiusTop: 0.13, radiusBottom: 0.13, height: 0.44,
      color: i % 2 ? '#6B8E5E' : '#C98E3F', mass: 0.4,
    });
  }

  engine.addStaticBox({ pos: new THREE.Vector3(cx - 5.1, 0.52, cz + 2.6), size: { x: 1.0, y: 1.04, z: 3.0 }, color: '#6E5238', roughness: 0.75 });
  engine.addStaticBox({ pos: new THREE.Vector3(cx - 5.1, 1.1, cz + 2.6), size: { x: 1.25, y: 0.1, z: 3.3 }, color: '#3E3428', metalness: 0.4, roughness: 0.4 });

  // GearboxAssy — model thật Khronos (CC-BY) đặt lên bàn
  new GLTFLoader().load(
    'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/GearboxAssy/glTF-Binary/GearboxAssy.glb',
    (gltf) => {
      const m = gltf.scene;
      m.scale.setScalar(0.45);
      m.rotation.y = 0.5;
      m.position.set(cx - 5.1, 1.16, cz + 2.4);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      engine.scene.add(m);
    },
    undefined,
    () => { /* mạng lỗi → bỏ qua, bàn vẫn đẹp */ }
  );

  [-1, 1].forEach((sx) => {
    engine.addDynamicCylinder({
      pos: new THREE.Vector3(cx + 5 + sx * 1.2, 0.55, cz + 3.4),
      radiusTop: 0.42, radiusBottom: 0.42, height: 1.1,
      color: sx > 0 ? '#C98E3F' : '#4A4238', mass: 3, roughness: 0.6, seg: 18,
    });
  });
}

/* ============================================================
   CÁC TRẠM KHÁC (API · Invites · EV · Forum · Founder)
   ============================================================ */
function buildStationProps() {
  STATIONS.forEach((S) => {
    const { x, z } = S;

    if (S.id === 'api') {
      [-2.4, 0, 2.4].forEach((dx, k) => {
        const tex = engine.makeCanvasTexture((ctx, S2) => {
          ctx.fillStyle = '#20262E';
          ctx.fillRect(0, 0, S2, S2);
          for (let r = 0; r < 7; r++) {
            ctx.fillStyle = (r + k) % 3 === 0 ? '#8FB98A' : '#2A3644';
            ctx.fillRect(S2 * 0.16, S2 * (0.1 + r * 0.12), S2 * 0.68, S2 * 0.05);
          }
        }, 128);
        engine.addStaticBox({
          pos: new THREE.Vector3(x + dx, 2.25, z - 1.6),
          size: { x: 1.5, y: 4.5, z: 1.1 },
          color: '#ffffff', texture: tex, metalness: 0.5, roughness: 0.4,
        });
      });
      for (let k = 0; k < 2; k++) {
        const cable = new THREE.Mesh(
          new THREE.BoxGeometry(2.4, 0.06, 0.06),
          new THREE.MeshStandardMaterial({ color: '#2A3644', roughness: 0.5 })
        );
        cable.position.set(x - 1.2 + k * 2.4, 3.4 - k * 0.7, z - 1.6);
        engine.scene.add(cable);
      }
      engine.addDynamicBox({ pos: new THREE.Vector3(x + 1.4, 0.5, z + 2.2), size: { x: 0.9, y: 0.9, z: 0.9 }, color: '#4A6FA5', mass: 1.2 });
    }

    if (S.id === 'invites') {
      engine.addStaticCylinder({ pos: new THREE.Vector3(x - 2.2, 1.6, z - 1), radiusTop: 0.22, radiusBottom: 0.26, height: 3.2, color: '#D9C7B2', roughness: 0.45 });
      engine.addStaticCylinder({ pos: new THREE.Vector3(x + 2.2, 1.6, z - 1), radiusTop: 0.22, radiusBottom: 0.26, height: 3.2, color: '#D9C7B2', roughness: 0.45 });
      const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 0.4), new THREE.MeshStandardMaterial({ color: '#C98E3F', roughness: 0.4 }));
      beam.position.set(x, 3.3, z - 1);
      beam.castShadow = true;
      engine.scene.add(beam);
      for (let f = 0; f < 7; f++) {
        const fl = new THREE.Mesh(
          new THREE.SphereGeometry(0.14, 10, 8),
          new THREE.MeshStandardMaterial({ color: f % 2 ? '#C98E3F' : '#E8DFC8', roughness: 0.4 })
        );
        fl.position.set(x - 2.2 + (f / 6) * 4.4, 3.3 + 0.18, z - 1 + Math.sin(f * 2.1) * 0.12);
        engine.scene.add(fl);
      }
      const carpet = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 7),
        new THREE.MeshStandardMaterial({ color: '#B08A96', roughness: 0.85 })
      );
      carpet.rotation.x = -Math.PI / 2;
      carpet.position.set(x, 0.02, z + 4);
      carpet.receiveShadow = true;
      engine.scene.add(carpet);
      engine.addDynamicBox({ pos: new THREE.Vector3(x - 1, 0.55, z + 1.5), size: { x: 0.9, y: 0.1, z: 0.65 }, color: '#EFE6D2', mass: 0.5, rotY: 0.3 });
      engine.addDynamicBox({ pos: new THREE.Vector3(x + 1, 0.55, z + 1.2), size: { x: 0.9, y: 0.1, z: 0.65 }, color: '#C98E9F', mass: 0.5, rotY: -0.2 });
    }

    if (S.id === 'ev') {
      engine.addStaticCylinder({ pos: new THREE.Vector3(x - 1.6, 1.25, z), radiusTop: 0.42, radiusBottom: 0.5, height: 2.5, color: '#5FA37E', roughness: 0.4, metalness: 0.35, seg: 20 });
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.9, 0.1),
        new THREE.MeshPhysicalMaterial({ color: '#122019', roughness: 0.06, metalness: 0.2, envMapIntensity: 1.8 })
      );
      screen.position.set(x - 1.6, 1.55, z + 0.48);
      engine.scene.add(screen);
      engine.addStaticBox({ pos: new THREE.Vector3(x + 2.2, 0.55, z - 1), size: { x: 1.6, y: 1.1, z: 0.9 }, color: '#2A3644', metalness: 0.5, roughness: 0.35 });
      for (let i = 0; i < 4; i++) {
        engine.addDynamicCylinder({
          pos: new THREE.Vector3(x + 1.4 + (i % 2) * 1.6, 0.36, z - 2 + i * 1.4),
          radiusTop: 0.08, radiusBottom: 0.3, height: 0.66,
          color: '#B5533C', mass: 0.35,
        });
      }
    }

    if (S.id === 'forum') {
      engine.addStaticBox({ pos: new THREE.Vector3(x, 1.5, z - 1.2), size: { x: 3.4, y: 2.0, z: 0.16 }, color: '#C9A23F', roughness: 0.6 });
      engine.addStaticBox({ pos: new THREE.Vector3(x - 1.4, 0.75, z - 1.35), size: { x: 0.18, y: 1.5, z: 0.18 }, color: '#6E5238' });
      engine.addStaticBox({ pos: new THREE.Vector3(x + 1.4, 0.75, z - 1.35), size: { x: 0.18, y: 1.5, z: 0.18 }, color: '#6E5238' });
      const noteTex = engine.makeCanvasTexture((ctx, S2) => {
        ctx.fillStyle = '#EFE6D2';
        ctx.fillRect(0, 0, S2, S2);
        ctx.fillStyle = '#3E4A38';
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
      engine.addStaticBox({ pos: new THREE.Vector3(x, 0.3, z + 1.4), size: { x: 2.6, y: 0.12, z: 0.6 }, color: '#6E5238', roughness: 0.7 });
      engine.addStaticBox({ pos: new THREE.Vector3(x - 1, 0.15, z + 1.4), size: { x: 0.14, y: 0.3, z: 0.5 }, color: '#54402C' });
      engine.addStaticBox({ pos: new THREE.Vector3(x + 1, 0.15, z + 1.4), size: { x: 0.14, y: 0.3, z: 0.5 }, color: '#54402C' });
      [[-0.5, '#B5533C'], [0, '#4A6FA5'], [0.5, '#C98E3F']].forEach(([dx, color], k) => {
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 0.14, 0.5),
          new THREE.MeshStandardMaterial({ color, roughness: 0.65 })
        );
        book.position.set(x + 1.6, 0.07 + k * 0.15, z + 0.2);
        book.rotation.y = (k - 1) * 0.3;
        book.castShadow = true;
        engine.scene.add(book);
      });
    }

    if (S.id === 'founder') {
      [-1.8, 0, 1.8].forEach((dx, k) => {
        engine.addStaticCylinder({ pos: new THREE.Vector3(x + dx, 0.5, z + (k === 1 ? -0.8 : 0.4)), radiusTop: 0.55, radiusBottom: 0.7, height: 1.0, color: k === 1 ? '#A84B33' : '#E8DFC8', roughness: 0.45, seg: 28 });
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(0.8, 0.6, 0.06),
          new THREE.MeshStandardMaterial({ color: '#3E4A38', roughness: 0.35 })
        );
        frame.position.set(x + dx, 1.35, z + (k === 1 ? -0.8 : 0.4));
        engine.scene.add(frame);
      });
      const trophy = new THREE.Group();
      const gold = new THREE.MeshStandardMaterial({ color: '#C9A23F', metalness: 0.95, roughness: 0.18 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.3, 16), gold);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 10), gold);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 14), new THREE.MeshStandardMaterial({ color: '#3E3428', roughness: 0.35 }));
      stem.position.y = -0.22; base.position.y = -0.32;
      trophy.add(cup, stem, base);
      trophy.position.set(x, 1.75, z - 0.8);
      engine.scene.add(trophy);
      engine.onFrame.push((t) => { trophy.rotation.y = t * 1.4; });
    }
  });
}

/* ============================================================
   CÂY MÙA THU (thông + tán tròn) · ĐÁ TẢNG · HÀNG RÀO GỖ
   ============================================================ */
function buildNature() {
  const mats = {
    trunk: new THREE.MeshStandardMaterial({ color: '#6E5238', roughness: 0.9 }),
    pineA: new THREE.MeshStandardMaterial({ color: '#4C6342', roughness: 0.85 }),
    pineB: new THREE.MeshStandardMaterial({ color: '#57704A', roughness: 0.85 }),
    autumn1: new THREE.MeshStandardMaterial({ color: '#C97B3D', roughness: 0.8 }),
    autumn2: new THREE.MeshStandardMaterial({ color: '#D9A05B', roughness: 0.8 }),
    autumn3: new THREE.MeshStandardMaterial({ color: '#B5651D', roughness: 0.8 }),
    rock: new THREE.MeshStandardMaterial({ color: '#B0A898', roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: '#96754B', roughness: 0.8 }),
    woodDark: new THREE.MeshStandardMaterial({ color: '#7A5C3E', roughness: 0.8 }),
  };

  function pine(x, z, scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, 1.6, 10), mats.trunk);
    trunk.position.y = 0.8;
    trunk.castShadow = true;
    g.add(trunk);
    [[1.55, 2.2, 2.3], [1.2, 1.7, 3.3], [0.85, 1.3, 4.15]].forEach(([r, h, y], k) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), k % 2 ? mats.pineA : mats.pineB);
      cone.position.y = y * scale * 0.8 + 0.6;
      cone.castShadow = true;
      g.add(cone);
    });
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    engine.scene.add(g);
    const body = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
    body.addShape(new CANNON.Cylinder(0.24, 0.24, 2.2, 10));
    body.position.set(x, 1.1, z);
    engine.world.addBody(body);
  }

  function roundTree(x, z, colorMat, scale = 1) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.8, 10), mats.trunk);
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    g.add(trunk);
    [[0, 2.9, 1.4], [0.75, 2.5, 1.0], [-0.7, 2.6, 0.95]].forEach(([dx, fy, fr], k) => {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(fr, 12, 10), colorMat);
      ball.position.set(x + dx * scale, fy * scale, z + (k - 1) * 0.35 * scale);
      ball.castShadow = true;
      engine.scene.add(ball);
    });
    g.position.set(x, 0, z);
    g.scale.setScalar(scale);
    engine.scene.add(g);
    const body = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
    body.addShape(new CANNON.Cylinder(0.28, 0.28, 2.4, 10));
    body.position.set(x, 1.2, z);
    engine.world.addBody(body);
  }

  function rock(x, z, s) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(s, 0),
      mats.rock
    );
    rock.position.set(x, s * 0.6, z);
    rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    rock.castShadow = true;
    rock.receiveShadow = true;
    engine.scene.add(rock);
  }

  // Rừng quanh rìa + dọc đường (né miệng đường)
  const treePlan = [
    [30, -18, 'pine', 1.2], [34, -6, 'pine', 1.0], [-30, -20, 'round1', 1.1], [-34, -4, 'pine', 1.2],
    [-12, 28, 'round2', 1.0], [12, 30, 'pine', 1.15], [28, 18, 'round3', 1.0], [-28, 16, 'pine', 1.1],
    [14, -28, 'round1', 0.95], [-14, -30, 'pine', 1.05], [36, 8, 'round2', 1.0], [-36, 10, 'round1', 1.05],
    [9, -18, 'pine', 0.9], [-9, -18, 'pine', 0.85], [18, 8, 'round3', 0.9], [-18, 10, 'pine', 0.9],
    [5, 26, 'round2', 0.9], [-5, 26, 'round1', 0.85], [24, -8, 'pine', 0.95], [-24, -8, 'round3', 0.9],
  ];
  treePlan.forEach(([x, z, kind, scale]) => {
    if (kind === 'pine') pine(x, z, scale);
    else roundTree(x, z, kind === 'round1' ? mats.autumn1 : kind === 'round2' ? mats.autumn2 : mats.autumn3, scale);
  });

  // Đá tảng rải
  [[9, 14, 0.7], [-8, 16, 0.55], [16, 8, 0.5], [-16, 12, 0.6], [0, -20, 0.7], [20, -14, 0.45], [-20, 14, 0.5]].forEach(([x, z, s]) => rock(x, z, s));

  // Bụi cây + hoa màu điểm xuyết
  const bushMat = new THREE.MeshStandardMaterial({ color: '#6B8E5E', roughness: 0.85 });
  const flowerColors = ['#C98E3F', '#B5533C', '#E8DFC8', '#8B7FB5'];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2 + 0.3;
    const r = 12 + Math.random() * 20;
    const bx = Math.cos(ang) * r;
    const bz = Math.sin(ang) * r;
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.42, 9, 7), bushMat);
    bush.position.set(bx, 0.32, bz);
    bush.castShadow = true;
    engine.scene.add(bush);
    if (i % 2 === 0) {
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 6),
        new THREE.MeshStandardMaterial({ color: flowerColors[i % 4], roughness: 0.5 })
      );
      flower.position.set(bx + 0.5, 0.14, bz + 0.4);
      engine.scene.add(flower);
    }
  }
}

/* ============================================================
   SÂN CHƠI — domino, tháp thùng, spinner, hầm, pad boost
   ============================================================ */
function buildPlayground() {
  // Domino 8 viên — húc đổ dây chuyền
  for (let i = 0; i < 8; i++) {
    engine.addDynamicBox({
      pos: new THREE.Vector3(-8 + i * 0.75, 0.75, 10.5),
      size: { x: 0.24, y: 1.5, z: 0.55 },
      color: i % 2 ? '#E8DFC8' : '#B5533C', mass: 0.4, rotY: 0.08,
    });
  }
  // Tháp thùng 3 tầng — đạp sập được
  for (let lv = 0; lv < 3; lv++) {
    for (let c = 0; c < 2; c++) {
      engine.addDynamicBox({
        pos: new THREE.Vector3(14 + c * 1.05 + (lv % 2) * 0.5, 0.52 + lv * 1.04, -4),
        size: { x: 1.0, y: 1.0, z: 1.0 },
        color: ['#C98E3F', '#B5533C', '#8B7355'][lv], mass: 1.6, rotY: (lv * 0.4) % Math.PI,
      });
    }
  }
  // Spinner thanh quay — đi gần là bị huý
  engine.addSpinner(-12, -6);
  // Hầm đi qua trên đường ra API
  engine.addStaticBox({ pos: new THREE.Vector3(-2.4, 1.6, -17), size: { x: 0.5, y: 3.2, z: 2.2 }, color: '#4A6FA5', metalness: 0.4, roughness: 0.4 });
  engine.addStaticBox({ pos: new THREE.Vector3(2.4, 1.6, -17), size: { x: 0.5, y: 3.2, z: 2.2 }, color: '#4A6FA5', metalness: 0.4, roughness: 0.4 });
  engine.addStaticBox({ pos: new THREE.Vector3(0, 3.4, -17), size: { x: 5.3, y: 0.5, z: 2.4 }, color: '#4A6FA5', metalness: 0.4, roughness: 0.4 });
  // 2 pad boost — lái qua là nhảy + bùng tốc độ
  engine.addBoostPad(0, 14, '#10B981');
  engine.addBoostPad(13, 0, '#10B981');
  // Bóng tiếp xúc cho các cụm lớn
  engine.addContactShadow(24.5, 1, 10, 0.22);
  engine.addContactShadow(0, -24, 7, 0.18);
  engine.addContactShadow(-24, 0, 6, 0.16);
  engine.addContactShadow(0, 24, 6, 0.16);
}

/* Hàng rào gỗ quanh quảng trường (chừa 6 cửa tại miệng đường) */
function buildFences() {
  const wood = new THREE.MeshStandardMaterial({ color: '#96754B', roughness: 0.8 });
  const woodDark = new THREE.MeshStandardMaterial({ color: '#7A5C3E', roughness: 0.8 });
  const roadAngles = STATIONS.map((s) => Math.atan2(s.z, s.x));
  const R = 10.8;
  const gapCheck = (ang) => roadAngles.some((ra) => {
    let d = Math.abs(((ang - ra) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    return d < 0.38;
  });
  const step = 0.24;
  let prev = null;
  for (let a = 0; a <= Math.PI * 2 + 0.001; a += step) {
    const blocked = gapCheck(a);
    if (blocked) { prev = null; continue; }
    const px = Math.cos(a) * R, pz = Math.sin(a) * R;
    if (prev) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.95, 8), wood);
      post.position.set(px, 0.47, pz);
      post.castShadow = true;
      engine.scene.add(post);
      const mx = (px + prev.x) / 2, mz = (pz + prev.z) / 2;
      const len = Math.hypot(px - prev.x, pz - prev.z);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.06), woodDark);
      rail.position.set(mx, 0.72, mz);
      rail.rotation.y = -Math.atan2(pz - prev.z, px - prev.x);
      rail.castShadow = true;
      engine.scene.add(rail);
      const rail2 = rail.clone();
      rail2.position.y = 0.42;
      engine.scene.add(rail2);
      const b = new CANNON.Body({ mass: 0, material: engine.defaultMaterial });
      b.addShape(new CANNON.Box(new CANNON.Vec3(len / 2, 0.45, 0.08)));
      b.position.set(mx, 0.5, mz);
      b.quaternion.setFromEuler(0, rail.rotation.y, 0);
      engine.world.addBody(b);
    }
    prev = { x: px, z: pz };
  }
}

/* ============================================================
   HUD — teleport, drawer, keycap, d-pad, minimap, âm thanh
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

  document.addEventListener('keydown', (e) => {
    const kc = document.querySelector(`.kc[data-key="${e.code}"]`);
    if (kc) kc.classList.add('is-down');
  });
  document.addEventListener('keyup', (e) => {
    const kc = document.querySelector(`.kc[data-key="${e.code}"]`);
    if (kc) kc.classList.remove('is-down');
  });

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

  const mm = document.getElementById('minimap');
  const mctx = mm.getContext('2d');
  mm.style.cursor = 'pointer';
  mm.title = 'Bấm vào chấm trạm để di chuyển nhanh';
  mm.addEventListener('click', (e) => {
    const r = mm.getBoundingClientRect();
    const scale = mm.width / 96;
    const wx = (e.clientX - r.left - mm.width / 2) / scale;
    const wz = (e.clientY - r.top - mm.height / 2) / scale;
    let best = null;
    let bestD = 15;
    STATIONS.forEach((s) => {
      const d = Math.hypot(s.x - wx, s.z - wz);
      if (d < bestD) { bestD = d; best = s; }
    });
    if (best) engine.teleportToZone(best.id);
    else if (Math.hypot(wx, wz) < 11) engine.teleportHome();
  });
  const fwd = new THREE.Vector3();
  function drawMinimap() {
    const S = mm.width;
    const scale = S / 96;
    const cx = S / 2, cy = S / 2;
    mctx.clearRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(48,36,26,0.82)';
    mctx.fillRect(0, 0, S, S);
    mctx.strokeStyle = 'rgba(245,215,142,0.4)';
    mctx.strokeRect(1, 1, S - 2, S - 2);

    mctx.strokeStyle = 'rgba(201,142,63,0.5)';
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
      mctx.strokeStyle = '#F4EBDD';
      mctx.lineWidth = 1.2;
      mctx.stroke();
    });

    mctx.fillStyle = '#C9A23F';
    mctx.fillRect(cx - 3, cy - 3, 6, 6);

    const px = cx + engine.carGroup.position.x * scale;
    const py = cy + engine.carGroup.position.z * scale;
    fwd.set(0, 0, 1).applyQuaternion(engine.carGroup.quaternion);
    mctx.strokeStyle = '#FF6B35';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.moveTo(px, py);
    mctx.lineTo(px + fwd.x * 11, py + fwd.z * 11);
    mctx.stroke();
    mctx.beginPath();
    mctx.arc(px, py, 4.2, 0, Math.PI * 2);
    mctx.fillStyle = '#FF6B35';
    mctx.fill();
    mctx.strokeStyle = '#FFFDF8';
    mctx.lineWidth = 1.5;
    mctx.stroke();

    requestAnimationFrame(drawMinimap);
  }
  requestAnimationFrame(drawMinimap);

  setTimeout(() => {
    const t = document.getElementById('toast');
    if (t) t.classList.add('is-hidden');
  }, 7000);
}

/* ---------- Âm thanh: động cơ + va chạm ---------- */
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
    whoosh() {
      if (!started || !ctx || muted) return;
      const t = ctx.currentTime;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 900;
      f.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      src.connect(f);
      f.connect(g);
      g.connect(master);
      src.start(t);
    },
    chime() {
      if (!started || !ctx || muted) return;
      const t = ctx.currentTime;
      [[880, 0], [1174.66, 0.12]].forEach(([freq, dt]) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.22, t + dt + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.9);
        o.connect(g);
        g.connect(master);
        o.start(t + dt);
        o.stop(t + dt + 1);
      });
    },
    toggleMute() {
      muted = !muted;
      if (ctx && master) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.05);
      return muted;
    },
  };

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

/* BOOT — camera bay vào + model 3D tải từ mạng */
[buildGround, buildSignage, buildWorkshop, buildStationProps, buildNature, buildFences, buildPlayground, initAudio, wireHUD].forEach((fn) => {
  try { fn(); } catch (e) {
    (window.__buildErrors = window.__buildErrors || []).push(fn.name + ': ' + e.message);
    console.error('BUILD FAIL', fn.name, e);
  }
});

/* Model xe thật: CesiumMilkTruck (Khronos glTF Sample Models, CC-BY)
   qua jsDelivr — lỗi mạng giữ nguyên xe procedural fallback */
new GLTFLoader().load(
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb',
  (gltf) => {
    engine.attachCarModel(gltf.scene);
  },
  undefined,
  () => { /* fallback procedural đang hiển thị sẵn */ }
);

/* Camera bay từ trên cao xuống góc iso chuẩn (orbit intro) */
engine.camera.position.set(0, 38, 18);
if (window.gsap) {
  gsap.to(engine.orbit, { pitch: 0, duration: 2.8, ease: 'power2.inOut', onComplete: () => { engine.orbit.intro = false; } });
} else {
  engine.orbit.pitch = 0;
  engine.orbit.intro = false;
}

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.getElementById('loader').classList.add('is-done');
  });
});
setTimeout(() => {
  document.getElementById('loader').classList.add('is-done');
}, 3000);
