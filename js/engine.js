/* ============================================================
   PlayableWorldEngine — từ skill `playable-3d-world-bruno`
   (C:\Users\damva\.agents\skills\playable-3d-world-bruno\SKILL.md)
   Mở rộng có kiểm soát cho SUNBII WORLD:
   + Trạm (stations) nhận cấu hình từ ngoài (opts.stations)
   + Helper vật lý dùng chung: addStaticBox / addDynamicBox /
     addStaticCylinder / makeCanvasTexture (cho app.js dựng xưởng, chữ…)
   + Tường biên vô hình giữ xe trong thế giới ±45m
   + FOV giãn nhẹ khi Nitro
   Mọi luật cốt lõi của skill giữ nguyên: không cuộn trang, cannon-es
   bắt buộc, allowSleep, Quick Teleport, procedural aesthetic.
   ============================================================ */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PlayableWorldEngine {
  constructor(container, onZoneChange, opts = {}) {
    this.container = container;
    this.onZoneChange = onZoneChange; // Callback(zoneData | null) để bật/tắt UI HTML
    this.stationConfigs = opts.stations || [];
    this.bounds = opts.bounds || 45;  // biên thế giới ±45m
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.clock = new THREE.Clock();

    this.keys = { forward: false, backward: false, left: false, right: false, boost: false, brake: false };
    this.syncList = []; // Mảng chứa các cặp { mesh, body } cần đồng bộ mỗi frame
    this.zones = [];    // Danh sách các trạm tương tác (Trigger Pads)
    this.activeZone = null;
    this.pulse = [];    // các vòng pad cần hiệu ứng "thở"

    this.initThree();
    this.initPhysics();
    this.buildEnvironment();
    this.buildVehicle();
    this.buildPlaygroundBricks();
    this.buildTriggerZones();
    this.buildBounds();
    this.bindControls();
    this.animate();
  }

  /* ---------- Helper dùng chung cho app.js ---------- */
  makeCanvasTexture(draw, size = 256) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  // Hộp tĩnh (khối lượng 0) — nền, trụ, kệ xưởng…
  addStaticBox({ pos, size, color, rotY = 0, roughness = 0.5, metalness = 0.05, texture = null }) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({ color, roughness, metalness, map: texture })
    );
    mesh.position.copy(pos);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass: 0, material: this.defaultMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    body.position.copy(pos);
    body.quaternion.setFromEuler(0, rotY, 0);
    this.world.addBody(body);
    return { mesh, body };
  }

  // Hộp động (có khối lượng, ngủ ban đầu) — chữ SUNBII, gạch, cell…
  addDynamicBox({ pos, size, color, mass = 1, texture = null, roughness = 0.4, sleep = true }) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({ color, roughness, map: texture })
    );
    mesh.position.copy(pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass, material: this.defaultMaterial, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.5 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    body.position.copy(pos);
    if (sleep) body.sleep();
    this.world.addBody(body);
    const pair = { mesh, body };
    this.syncList.push(pair);
    return pair;
  }

  // Trụ tròn tĩnh — cột, lốp, cell trang trí
  addStaticCylinder({ pos, radiusTop, radiusBottom, height, color, rotX = 0, rotZ = 0, seg = 24, roughness = 0.5, metalness = 0.1 }) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, seg),
      new THREE.MeshStandardMaterial({ color, roughness, metalness })
    );
    mesh.position.copy(pos);
    mesh.rotation.x = rotX;
    mesh.rotation.z = rotZ;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass: 0, material: this.defaultMaterial });
    body.addShape(new CANNON.Cylinder(radiusTop, radiusBottom, height, 16));
    body.position.copy(pos);
    body.quaternion.setFromEuler(rotX, 0, rotZ);
    this.world.addBody(body);
    return { mesh, body };
  }

  // Trụ tròn ĐỘNG — cell pin, ky bowling (đổ được)
  addDynamicCylinder({ pos, radiusTop, radiusBottom, height, color, mass = 0.6, seg = 18, rotZ = 0, roughness = 0.5 }) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, seg),
      new THREE.MeshStandardMaterial({ color, roughness })
    );
    mesh.position.copy(pos);
    mesh.castShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass, material: this.defaultMaterial, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.5 });
    body.addShape(new CANNON.Cylinder(radiusTop, radiusBottom, height, 14));
    body.position.copy(pos);
    if (rotZ) body.quaternion.setFromEuler(0, 0, rotZ);
    body.sleep();
    this.world.addBody(body);
    const pair = { mesh, body };
    this.syncList.push(pair);
    return pair;
  }

  // ---------- 1. KHỞI TẠO THREE.JS & ÁNH SÁNG ĐỔ BÓNG ----------
  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#E8DEC8'); // Màu cát ấm đặc trưng phong cách Bruno Simon
    this.scene.fog = new THREE.FogExp2('#E8DEC8', 0.010);

    // Camera góc nhìn Isometric / Third-Person bám theo xe
    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.5, 220);
    this.cameraOffset = new THREE.Vector3(0, 15, 19);
    this.cameraLookTarget = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.container.appendChild(this.renderer.domElement);

    const ambient = new THREE.HemisphereLight('#FFFDF8', '#C9B38C', 0.85);
    this.scene.add(ambient);

    this.dirLight = new THREE.DirectionalLight('#FFF5E1', 1.8);
    this.dirLight.position.set(25, 40, 25);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    const d = 45;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);
  }

  // ---------- 2. KHỞI TẠO THẾ GIỚI VẬT LÝ CANNON-ES ----------
  initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -18, 0); // Trọng lực hơi nặng giúp xe đầm và không bị lật bồng bềnh
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    this.defaultMaterial = new CANNON.Material('default');
    const contactMat = new CANNON.ContactMaterial(this.defaultMaterial, this.defaultMaterial, {
      friction: 0.35,
      restitution: 0.15,
    });
    this.world.defaultContactMaterial = contactMat;

    // Mặt đất vật lý
    const floorBody = new CANNON.Body({ mass: 0, material: this.defaultMaterial });
    floorBody.addShape(new CANNON.Plane());
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floorBody);
  }

  // ---------- 3. DỰNG SÂN CHƠI, LƯỚI TỌA ĐỘ VÀ DỐC NHẢY ----------
  buildEnvironment() {
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#E5D8BE', roughness: 0.85 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    const grid = new THREE.GridHelper(120, 60, '#C7B698', '#D6C7AA');
    grid.position.y = 0.02;
    this.scene.add(grid);

    // Dốc nhảy (Jump Ramp) để xe bay lên không trung
    this.createStaticRamp(new THREE.Vector3(8, 0.8, -8), new THREE.Vector3(4, 1.6, 6), -0.28);
    this.createStaticRamp(new THREE.Vector3(-10, 0.8, 6), new THREE.Vector3(4, 1.6, 6), 0.28);
  }

  createStaticRamp(pos, size, tiltX) {
    const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const mat = new THREE.MeshStandardMaterial({ color: '#FF6B35', roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.rotation.x = tiltX;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
    const body = new CANNON.Body({ mass: 0 });
    body.addShape(shape);
    body.position.copy(pos);
    body.quaternion.copy(mesh.quaternion);
    this.world.addBody(body);
  }

  // ---------- 4. DỰNG CHIẾC XE ĐỊA HÌNH 3D (PROCEDURAL CYBER BUGGY) ----------
  buildVehicle() {
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    const chassisMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.65, 3.4),
      new THREE.MeshStandardMaterial({ color: '#FF471A', roughness: 0.25, metalness: 0.2 })
    );
    chassisMesh.position.y = 0.35;
    chassisMesh.castShadow = true;
    this.carGroup.add(chassisMesh);

    const cabinMesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.55, 1.6),
      new THREE.MeshStandardMaterial({ color: '#22252A', roughness: 0.15, metalness: 0.8 })
    );
    cabinMesh.position.set(0, 0.9, -0.2);
    cabinMesh.castShadow = true;
    this.carGroup.add(cabinMesh);

    this.wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.42, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#1C1D21', roughness: 0.7 });

    const wheelPositions = [
      [-1.1, 0.1, 1.15],  [1.1, 0.1, 1.15],  // 2 bánh trước
      [-1.1, 0.1, -1.15], [1.1, 0.1, -1.15], // 2 bánh sau
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(x, y, z);
      w.castShadow = true;
      this.carGroup.add(w);
      this.wheels.push(w);
    });

    // Khối Vật Lý của Xe (Box giúp leo dốc mượt không bị kẹt cạnh)
    const carShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.5, 1.7));
    this.carBody = new CANNON.Body({
      mass: 25,
      material: this.defaultMaterial,
      linearDamping: 0.4,
      angularDamping: 0.6,
    });
    this.carBody.addShape(carShape);
    this.carBody.position.set(0, 4, 0); // Thả rơi từ độ cao 4m xuống khi mở trang
    this.world.addBody(this.carBody);

    this.carHeading = 0;
    this.carSpeed = 0;
  }

  // ---------- 5. TƯỜNG GẠCH ĐẬP PHÁ (SLEEP OPTIMIZED) ----------
  buildPlaygroundBricks() {
    const brickGeo = new THREE.BoxGeometry(1.1, 0.6, 0.6);
    const colors = ['#FFFFFF', '#FFBE0B', '#3A86FF', '#FF006E'];

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const mat = new THREE.MeshStandardMaterial({
          color: colors[(row + col) % colors.length],
          roughness: 0.35,
        });
        const mesh = new THREE.Mesh(brickGeo, mat);
        const x = (col - 2.5) * 1.15 + (row % 2) * 0.3;
        const y = 0.3 + row * 0.62;
        const z = -9;

        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const body = new CANNON.Body({
          mass: 0.8,
          sleepSpeedLimit: 0.25,
          sleepTimeLimit: 0.5,
        });
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.55, 0.3, 0.3)));
        body.position.set(x, y, z);
        body.sleep(); // Cho ngủ ngay từ đầu để tiết kiệm 100% CPU cho đến khi xe húc vào
        this.world.addBody(body);

        this.syncList.push({ mesh, body });
      }
    }
  }

  // ---------- 6. TRẠM TRIGGER ZONES (cấu hình từ app.js) ----------
  buildTriggerZones() {
    this.stationConfigs.forEach((cfg) => {
      const group = new THREE.Group();
      group.position.set(cfg.x, 0.05, cfg.z);

      const padMesh = new THREE.Mesh(
        new THREE.RingGeometry(2.8, 3.3, 48),
        new THREE.MeshBasicMaterial({ color: cfg.color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      padMesh.rotation.x = -Math.PI / 2;
      group.add(padMesh);

      const totemMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.1, 0),
        new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.2, metalness: 0.5 })
      );
      totemMesh.position.y = 2.2;
      totemMesh.castShadow = true;
      group.add(totemMesh);

      this.scene.add(group);
      this.zones.push({ ...cfg, padMesh, totemMesh, r: cfg.r || 3.6 });
      this.pulse.push(padMesh);
    });
  }

  // Tường biên vô hình ±bounds — giữ xe trong thế giới
  buildBounds() {
    const b = this.bounds;
    const walls = [
      { pos: [0, 2, -b], size: [b * 2, 4, 1] },
      { pos: [0, 2, b], size: [b * 2, 4, 1] },
      { pos: [-b, 2, 0], size: [1, 4, b * 2] },
      { pos: [b, 2, 0], size: [1, 4, b * 2] },
    ];
    walls.forEach(({ pos, size }) => {
      const body = new CANNON.Body({ mass: 0, material: this.defaultMaterial });
      body.addShape(new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)));
      body.position.set(...pos);
      this.world.addBody(body);
    });
  }

  // HÀM DỊCH CHUYỂN TỨC THỜI (CHO MENU DÀNH CHO NGƯỜI KHÔNG MUỐN LÁI XE)
  teleportToZone(zoneId) {
    const target = this.zones.find((z) => z.id === zoneId);
    if (!target) return;
    this.carBody.position.set(target.x, 2.5, target.z + 2.4);
    this.carBody.velocity.set(0, 0, 0);
    this.carBody.angularVelocity.set(0, 0, 0);
    this.carHeading = Math.PI; // quay mặt về phía trạm
    this.carBody.wakeUp();
  }

  // ---------- 7. BẮT SỰ KIỆN PHÍM WASD / MŨI TÊN / BOOST ----------
  bindControls() {
    const handleKey = (e, isDown) => {
      const k = e.code;
      if (k === 'KeyW' || k === 'ArrowUp') this.keys.forward = isDown;
      if (k === 'KeyS' || k === 'ArrowDown') this.keys.backward = isDown;
      if (k === 'KeyA' || k === 'ArrowLeft') this.keys.left = isDown;
      if (k === 'KeyD' || k === 'ArrowRight') this.keys.right = isDown;
      if (k === 'ShiftLeft' || k === 'ShiftRight') this.keys.boost = isDown;
      if (k === 'KeyR' && isDown) {
        // Reset xe khi bị lật
        this.carBody.position.set(0, 4, 0);
        this.carBody.velocity.set(0, 0, 0);
        this.carBody.quaternion.set(0, 0, 0, 1);
        this.carHeading = 0;
      }
    };
    window.addEventListener('keydown', (e) => handleKey(e, true));
    window.addEventListener('keyup', (e) => handleKey(e, false));
    window.addEventListener('resize', () => {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.width, this.height);
    });
  }

  // ---------- 8. VÒNG LẶP VẬT LÝ & RENDER 60FPS ----------
  animate() {
    requestAnimationFrame(() => this.animate());
    if (document.hidden) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);

    // Điều khiển động lực học của xe
    const maxSpeed = this.keys.boost ? 26 : 15;

    if (this.keys.forward) this.carSpeed = THREE.MathUtils.lerp(this.carSpeed, maxSpeed, dt * 4);
    else if (this.keys.backward) this.carSpeed = THREE.MathUtils.lerp(this.carSpeed, -maxSpeed * 0.6, dt * 4);
    else this.carSpeed = THREE.MathUtils.lerp(this.carSpeed, 0, dt * 5);

    if (Math.abs(this.carSpeed) > 0.5) {
      const turnDir = this.carSpeed > 0 ? 1 : -1;
      if (this.keys.left) this.carHeading += 2.6 * dt * turnDir;
      if (this.keys.right) this.carHeading -= 2.6 * dt * turnDir;
    }

    // Áp dụng vận tốc ngang lên thân vật lý của xe (giữ nguyên vận tốc rơi Y của trọng lực)
    this.carBody.wakeUp();
    this.carBody.velocity.x = -Math.sin(this.carHeading) * this.carSpeed;
    this.carBody.velocity.z = -Math.cos(this.carHeading) * this.carSpeed;

    const targetQuat = new CANNON.Quaternion();
    targetQuat.setFromEuler(0, this.carHeading, 0);
    this.carBody.quaternion.slerp(targetQuat, 0.2, this.carBody.quaternion);

    // Bước nhảy thế giới vật lý
    this.world.step(1 / 60, dt, 3);

    // Đồng bộ Mesh của Xe + bánh xe quay
    this.carGroup.position.copy(this.carBody.position);
    this.carGroup.quaternion.copy(this.carBody.quaternion);
    this.wheels.forEach((w) => { w.rotation.x -= this.carSpeed * dt * 1.5; });

    // Đồng bộ toàn bộ vật thể động
    for (const item of this.syncList) {
      item.mesh.position.copy(item.body.position);
      item.mesh.quaternion.copy(item.body.quaternion);
    }

    // Camera Isometric bám mượt theo xe + FOV giãn khi nitro
    const desiredCamPos = new THREE.Vector3(
      this.carGroup.position.x + this.cameraOffset.x,
      this.carGroup.position.y + this.cameraOffset.y,
      this.carGroup.position.z + this.cameraOffset.z
    );
    this.camera.position.lerp(desiredCamPos, 0.08);
    this.cameraLookTarget.lerp(this.carGroup.position, 0.12);
    this.camera.lookAt(this.cameraLookTarget);
    const targetFov = this.keys.boost ? 46 : 40;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
      this.camera.updateProjectionMatrix();
    }

    // Vòng pad "thở" + totem xoay + kiểm tra Trigger Zone
    let foundZone = null;
    const elapsed = this.clock.getElapsedTime();
    for (const z of this.zones) {
      z.totemMesh.rotation.y = elapsed * 1.2;
      z.totemMesh.position.y = 2.2 + Math.sin(elapsed * 2.5) * 0.25;

      const dist = Math.hypot(this.carGroup.position.x - z.x, this.carGroup.position.z - z.z);
      if (dist < z.r) foundZone = z;
    }
    const pulseScale = 1 + Math.sin(elapsed * 2.2) * 0.05;
    this.pulse.forEach((pad) => { pad.scale.set(pulseScale, pulseScale, 1); });

    if (foundZone?.id !== this.activeZone?.id) {
      this.activeZone = foundZone;
      if (this.onZoneChange) this.onZoneChange(foundZone);
    }

    this.renderer.render(this.scene, this.camera);
  }
}
