/* ============================================================
   PlayableWorldEngine v2 — từ skill `playable-3d-world-bruno`
   Nâng cấp đồ hoạ & tương tác đợt 2 (feedback: "đồ hoạ + thao tác
   chưa đạt" — tham chiếu bruno-simon.com):
   + RaycastVehicle cannon-es: giảm xóc 4 bánh thật, đánh lái
     bánh trước, bánh xoay theo tốc độ (không còn velocity-hack)
   + setGroundTexture(): sàn vẽ canvas (đường, vạch, patch trạm)
   + Âm thanh: động cơ theo tốc độ + tiếng va chạm (WebAudio)
   + Helper vật lý + trạm cấu hình ngoài + biên vô hình (giữ nguyên)
   Luật cốt lõi của skill giữ nguyên: không cuộn, cannon-es,
   allowSleep, Quick Teleport, procedural aesthetic.
   ============================================================ */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class PlayableWorldEngine {
  constructor(container, onZoneChange, opts = {}) {
    this.container = container;
    this.onZoneChange = onZoneChange;
    this.stationConfigs = opts.stations || [];
    this.bounds = opts.bounds || 45;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.clock = new THREE.Clock();

    this.keys = { forward: false, backward: false, left: false, right: false, boost: false, brake: false };
    this.syncList = [];
    this.zones = [];
    this.activeZone = null;
    this.pulse = [];
    this.onCollide = null; // callback va chạm (app.js gắn âm thanh)
    this.audio = null;     // gắn từ app.js: { setSpeed, thud, toggleMute }
    this.steer = 0;

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

  /* ---------- Helper dùng chung ---------- */
  makeCanvasTexture(draw, size = 256) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    draw(ctx, size);
    const tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 8;
    return tex;
  }

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

  addDynamicBox({ pos, size, color, mass = 1, texture = null, roughness = 0.4, sleep = true, rotY = 0 }) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      new THREE.MeshStandardMaterial({ color, roughness, map: texture })
    );
    mesh.position.copy(pos);
    mesh.rotation.y = rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass, material: this.defaultMaterial, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.5 });
    body.addShape(new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)));
    body.position.copy(pos);
    body.quaternion.setFromEuler(0, rotY, 0);
    if (sleep) body.sleep();
    this.world.addBody(body);
    const pair = { mesh, body };
    this.syncList.push(pair);
    return pair;
  }

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

  // Sàn vẽ canvas (đường + vạch + patch trạm) — chất Bruno nằm ở đây
  setGroundTexture(tex) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  // Billboard tên trạm (luôn hướng camera)
  addNameSprite(text, color, pos) {
    const tex = this.makeCanvasTexture((ctx, S) => {
      const w = S, h = S * 0.3;
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(38,50,56,0.88)';
      const bw = w * 0.92, bh = h * 0.86, bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, bh * 0.3) : ctx.rect(bx, by, bw, bh);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillRect(bx, by + bh * 0.12, 8, bh * 0.76);
      ctx.fillStyle = '#FFFDF8';
      ctx.font = `700 ${h * 0.42}px "Be Vietnam Pro", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2 + 4, h / 2);
    }, 512);
    tex.premultiplyAlpha = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(7.4, 2.2, 1);
    sprite.position.copy(pos);
    this.scene.add(sprite);
    return sprite;
  }

  // ---------- 1. THREE.JS + ÁNH SÁNG ----------
  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#E8DEC8');
    this.scene.fog = new THREE.FogExp2('#E8DEC8', 0.0085);

    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.5, 260);
    this.cameraOffset = new THREE.Vector3(0, 13, 17);
    this.cameraLookTarget = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.container.appendChild(this.renderer.domElement);

    const ambient = new THREE.HemisphereLight('#FFFDF8', '#C9B38C', 0.8);
    this.scene.add(ambient);

    this.dirLight = new THREE.DirectionalLight('#FFF5E1', 1.9);
    this.dirLight.position.set(28, 42, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    const d = 48;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.bias = -0.0004;
    this.scene.add(this.dirLight);
  }

  // ---------- 2. VẬT LÝ CANNON-ES ----------
  initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -18, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    this.defaultMaterial = new CANNON.Material('default');
    const contactMat = new CANNON.ContactMaterial(this.defaultMaterial, this.defaultMaterial, {
      friction: 0.4,
      restitution: 0.2,
    });
    this.world.defaultContactMaterial = contactMat;

    const floorBody = new CANNON.Body({ mass: 0, material: this.defaultMaterial });
    floorBody.addShape(new CANNON.Plane());
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floorBody);
  }

  // ---------- 3. SÀN + DỐC NHẢY ----------
  buildEnvironment() {
    // Sàn nền phẳng lớn (bên ngoài khu 100m) — sàn có vẽ đường do app.js cung cấp
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: '#E2D6BC', roughness: 0.9 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.scene.add(outer);

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

  // ---------- 4. XE BUGGY CHI TIẾT + RAYCAST VEHICLE ----------
  buildVehicle() {
    /* ---- Khối vật lý xe + RaycastVehicle (giảm xóc 4 bánh thật) ---- */
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.0, 0.45, 1.75));
    this.chassisBody = new CANNON.Body({ mass: 32, material: this.defaultMaterial });
    this.chassisBody.addShape(chassisShape);
    this.chassisBody.position.set(0, 3.2, 5);
    this.chassisBody.angularDamping = 0.35;

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelOpt = {
      radius: 0.46,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 52,
      suspensionRestLength: 0.38,
      frictionSlip: 2.6,
      dampingRelaxation: 2.6,
      dampingCompression: 4.5,
      maxSuspensionForce: 100000,
      rollInfluence: 0.02,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };
    // 2 bánh trước (z dương) + 2 bánh sau
    [
      new CANNON.Vec3(0.95, 0.02, 1.2),
      new CANNON.Vec3(-0.95, 0.02, 1.2),
      new CANNON.Vec3(0.95, 0.02, -1.2),
      new CANNON.Vec3(-0.95, 0.02, -1.2),
    ].forEach((p) => {
      wheelOpt.chassisConnectionPointLocal = p;
      this.vehicle.addWheel(wheelOpt);
    });
    this.vehicle.addToWorld(this.world);

    /* ---- Mesh chi tiết của xe ---- */
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    const matBody = new THREE.MeshStandardMaterial({ color: '#FF471A', roughness: 0.28, metalness: 0.25 });
    const matDark = new THREE.MeshStandardMaterial({ color: '#22252A', roughness: 0.2, metalness: 0.75 });
    const matChrome = new THREE.MeshStandardMaterial({ color: '#C8CDD4', roughness: 0.18, metalness: 0.9 });

    // Thân chính + nắp capo vát
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.3), matBody);
    chassis.position.y = 0.05;
    chassis.castShadow = true;
    this.carGroup.add(chassis);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.1), matBody);
    hood.position.set(0, 0.38, 1.15);
    hood.rotation.x = -0.09;
    hood.castShadow = true;
    this.carGroup.add(hood);

    // Cabin kính
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.52, 1.5), matDark);
    cabin.position.set(0, 0.55, -0.25);
    cabin.castShadow = true;
    this.carGroup.add(cabin);

    // Cản trước/sau + gờ hông
    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.28, 0.3), matChrome);
    fBumper.position.set(0, -0.12, 1.78);
    fBumper.castShadow = true;
    this.carGroup.add(fBumper);
    const rBumper = fBumper.clone();
    rBumper.position.z = -1.78;
    this.carGroup.add(rBumper);
    [-1, 1].forEach((sx) => {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 2.4), matDark);
      skirt.position.set(sx * 1.02, -0.18, 0);
      this.carGroup.add(skirt);
    });

    // Đèn pha + đèn hậu (emissive)
    const lightMat = new THREE.MeshStandardMaterial({ color: '#FFF6D8', emissive: '#FFE9A8', emissiveIntensity: 1.4 });
    const tailMat = new THREE.MeshStandardMaterial({ color: '#FF3020', emissive: '#FF3020', emissiveIntensity: 1.2 });
    [-0.62, 0.62].forEach((sx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
      hl.position.set(sx, 0.12, 1.72);
      this.carGroup.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
      tl.position.set(sx, 0.12, -1.72);
      this.carGroup.add(tl);
    });

    // Ống xả đôi
    [-0.3, 0.3].forEach((sx) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 12), matChrome);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx, -0.14, -1.8);
      this.carGroup.add(pipe);
    });

    // Ăn-ten + cờ phất phơ
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), matDark);
    antenna.position.set(-0.6, 1.25, -1.0);
    this.carGroup.add(antenna);
    this.flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.34),
      new THREE.MeshStandardMaterial({ color: '#FBC02D', side: THREE.DoubleSide, roughness: 0.6 })
    );
    this.flag.position.set(-0.32, 1.62, -1.0);
    this.carGroup.add(this.flag);

    /* ---- 4 bánh xe: lốp + vành, xoay & lái theo vehicle ---- */
    this.wheelMeshes = [];
    const tireGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.4, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12);
    hubGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, new THREE.MeshStandardMaterial({ color: '#1C1D21', roughness: 0.8 }));
      tire.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, matChrome);
      g.add(tire, hub);
      this.scene.add(g);
      this.wheelMeshes.push(g);
    }

    /* ---- Tiếng va chạm ---- */
    this.chassisBody.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 2.2 && this.onCollide) this.onCollide(Math.min(v / 12, 1));
    });

    this.throttle = 0;
    this.speedKmh = 0;
  }

  // ---------- 5. TƯỜNG GẠCH ĐẬP PHÁ ----------
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
        body.sleep();
        this.world.addBody(body);

        this.syncList.push({ mesh, body });
      }
    }
  }

  // ---------- 6. TRẠM TRIGGER ZONES ----------
  buildTriggerZones() {
    this.stationConfigs.forEach((cfg) => {
      const group = new THREE.Group();
      group.position.set(cfg.x, 0.06, cfg.z);

      const padMesh = new THREE.Mesh(
        new THREE.RingGeometry(2.8, 3.3, 48),
        new THREE.MeshBasicMaterial({ color: cfg.color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      padMesh.rotation.x = -Math.PI / 2;
      group.add(padMesh);

      const totemMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.05, 0),
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

  teleportToZone(zoneId) {
    const target = this.zones.find((z) => z.id === zoneId);
    if (!target) return;
    this.chassisBody.position.set(target.x, 2.5, target.z + 3.2);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.setFromEuler(0, 0, 0); // quay mặt về phía trạm (-z)
    this.vehicle.wheels.forEach((wi) => { wi.steerValue = 0; });
  }

  teleportHome() {
    this.chassisBody.position.set(0, 2.5, 6);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.setFromEuler(0, 0, 0);
  }

  // ---------- 7. BẮT PHÍM ----------
  bindControls() {
    const handleKey = (e, isDown) => {
      const k = e.code;
      if (k === 'KeyW' || k === 'ArrowUp') this.keys.forward = isDown;
      if (k === 'KeyS' || k === 'ArrowDown') this.keys.backward = isDown;
      if (k === 'KeyA' || k === 'ArrowLeft') this.keys.left = isDown;
      if (k === 'KeyD' || k === 'ArrowRight') this.keys.right = isDown;
      if (k === 'ShiftLeft' || k === 'ShiftRight') this.keys.boost = isDown;
      if (k === 'KeyR' && isDown) this.teleportHome();
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

  // ---------- 8. VÒNG LẶP VẬT LÝ & RENDER ----------
  animate() {
    requestAnimationFrame(() => this.animate());
    if (document.hidden) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);

    /* Lái: đánh lái mượt bánh trước + lực động cơ 4 bánh */
    const steerTarget = ((this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0)) * 0.5;
    this.steer = THREE.MathUtils.lerp(this.steer, steerTarget, dt * 6);
    this.vehicle.setSteeringValue(this.steer, 0);
    this.vehicle.setSteeringValue(this.steer, 1);

    const maxForce = this.keys.boost ? 2600 : 1500;
    let force = 0;
    if (this.keys.forward) force = maxForce;                 // W → tiến về -z thế giới (yaw 0)
    else if (this.keys.backward) force = -maxForce * 0.55;
    for (let i = 0; i < 4; i++) this.vehicle.applyEngineForce(force, i);

    const brake = this.keys.forward || this.keys.backward ? 0.15 : 2.2;
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brake, i);

    this.world.step(1 / 60, dt, 3);

    /* Xe chính theo chassis */
    this.carGroup.position.copy(this.chassisBody.position);
    this.carGroup.quaternion.copy(this.chassisBody.quaternion);

    /* Bánh xe từ worldTransform (gồm cả góc lái + xoay theo tốc độ) */
    for (let i = 0; i < 4; i++) {
      this.vehicle.updateWheelTransform(i);
      const t = this.vehicle.wheelInfos[i].worldTransform;
      this.wheelMeshes[i].position.copy(t.position);
      this.wheelMeshes[i].quaternion.copy(t.quaternion);
    }

    /* Cờ phất theo tốc độ */
    const elapsed = this.clock.getElapsedTime();
    this.flag.rotation.y = Math.sin(elapsed * 9) * (0.25 + Math.abs(this.throttle) * 0.5);

    /* Tốc độ km/h (chiếu vận tốc lên hướng xe) */
    const fwd = this.chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
    const vel = this.chassisBody.velocity;
    const signed = fwd.x * vel.x + fwd.z * vel.z;
    this.speedKmh = Math.abs(signed) * 3.6;
    this.throttle = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 0.6 : 0);

    /* Camera bám mượt + FOV nitro */
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

    /* Trạm: totem xoay + pad thở + zone check */
    let foundZone = null;
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

    /* Âm thanh động cơ */
    if (this.audio) this.audio.setSpeed(this.speedKmh, Math.abs(this.throttle));

    this.renderer.render(this.scene, this.camera);
  }
}
