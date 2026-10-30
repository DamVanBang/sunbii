/* ============================================================
   PlayableWorldEngine v3 — Cinematic Warm/Autumn
   Từ skill `playable-3d-world-bruno` + chuẩn thẩm mỹ cao cấp:
   + Palette mùa thu ấm, FogExp2 nhẹ — không màu nhựa chói
   + RoomEnvironment (PMREM) + ACESFilmic — vật liệu kim loại
     nhám & kính phản chiếu thật, không cần file .hdr
   + DirectionalLight bóng đổ PCFSoft 2048px sâu và sắc
   + Hậu kỳ: UnrealBloom (kìm hãm) + Vignette + Warm grade
   + RaycastVehicle chống lật: rollInfluence ~0, trục hông rộng,
     lái giảm góc theo tốc độ, RWD, auto-unflip
   Luật skill giữ nguyên: không cuộn, cannon-es, allowSleep,
   Quick Teleport, procedural fallback khi mạng lỗi.
   ============================================================ */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

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
    this.onFrame = [];   // các callback trang trí mỗi frame (app.js đăng ký)
    this.onCollide = null;
    this.audio = null;
    this.steer = 0;
    this.engineForce = 0;
    this.flipTimer = 0;

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
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  addStaticBox({ pos, size, color, rotY = 0, roughness = 0.55, metalness = 0.05, texture = null }) {
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

  addDynamicBox({ pos, size, color, mass = 1, texture = null, roughness = 0.45, sleep = true, rotY = 0 }) {
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

  setGroundTexture(tex) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  addNameSprite(text, color, pos) {
    const tex = this.makeCanvasTexture((ctx, S) => {
      const h = S * 0.3, w = S, bh = h * 0.86, bw = w * 0.92, bx = (w - bw) / 2, by = (h - bh) / 2;
      ctx.clearRect(0, 0, S, S);
      ctx.fillStyle = 'rgba(48,36,26,0.9)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 10);
      else ctx.rect(bx, by, bw, bh);
      ctx.fill();
      ctx.strokeStyle = 'rgba(245,215,142,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(bx + 10, by + bh * 0.15, 7, bh * 0.7);
      ctx.fillStyle = '#F4EBDD';
      ctx.font = `700 ${h * 0.4}px "Be Vietnam Pro", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, w / 2 + 5, h / 2);
    }, 512);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(7.6, 2.3, 1);
    sprite.position.copy(pos);
    this.scene.add(sprite);
    return sprite;
  }

  // ---------- 1. THREE.JS: ACES + Studio env + Shadow sâu ----------
  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#E3D3B4');
    this.scene.fog = new THREE.FogExp2('#E3D3B4', 0.0058);

    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.5, 260);
    this.cameraOffset = new THREE.Vector3(0, 13, 17);
    this.cameraLookTarget = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.container.appendChild(this.renderer.domElement);

    // Studio lighting procedural (không .hdr): phản xạ lên kim loại/kính
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // DirectionalLight: bóng sâu sắc
    this.dirLight = new THREE.DirectionalLight('#FFEFD2', 2.1);
    this.dirLight.position.set(30, 46, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(2048, 2048);
    const d = 44;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.near = 2;
    this.dirLight.shadow.camera.far = 140;
    this.dirLight.shadow.bias = -0.0002;
    this.dirLight.shadow.normalBias = 0.03;
    this.scene.add(this.dirLight);

    // Hậu kỳ: Render → Bloom (kìm hãm) → Vignette + Warm grade → Output
    this.composer = new EffectComposer(
      this.renderer,
      new THREE.WebGLRenderTarget(this.width, this.height, { samples: 4, type: THREE.HalfFloatType })
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(this.width, this.height), 0.18, 0.45, 0.82);
    this.composer.addPass(this.bloom);
    const vignette = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uStrength: { value: 0.62 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uStrength; varying vec2 vUv;
        void main() {
          vec4 c = texture2D(tDiffuse, vUv);
          float d = distance(vUv, vec2(0.5, 0.44));
          c.rgb *= 1.0 - smoothstep(0.42, 0.95, d) * uStrength;
          c.rgb *= vec3(1.03, 1.0, 0.955); // grade ấm nhẹ
          gl_FragColor = vec4(c.rgb, 1.0);
        }
      `,
    });
    this.composer.addPass(vignette);
    this.composer.addPass(new OutputPass());
  }

  // ---------- 2. VẬT LÝ ----------
  initPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -18, 0);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;

    this.defaultMaterial = new CANNON.Material('default');
    const contactMat = new CANNON.ContactMaterial(this.defaultMaterial, this.defaultMaterial, {
      friction: 0.42,
      restitution: 0.18,
    });
    this.world.defaultContactMaterial = contactMat;

    const floorBody = new CANNON.Body({ mass: 0, material: this.defaultMaterial });
    floorBody.addShape(new CANNON.Plane());
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floorBody);
  }

  // ---------- 3. SÀN + DỐC ----------
  buildEnvironment() {
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: '#D8C49C', roughness: 0.95 })
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
    const mat = new THREE.MeshStandardMaterial({ color: '#B5533C', roughness: 0.55 });
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

  // ---------- 4. XE + RAYCAST VEHICLE (chống lật) ----------
  buildVehicle() {
    const chassisShape = new CANNON.Box(new CANNON.Vec3(0.98, 0.4, 1.72));
    this.chassisBody = new CANNON.Body({ mass: 34, material: this.defaultMaterial, angularDamping: 0.5 });
    this.chassisBody.addShape(chassisShape);
    this.chassisBody.position.set(0, 2.6, 5);

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelOpt = {
      radius: 0.46,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 46,
      suspensionRestLength: 0.36,
      frictionSlip: 2.4,
      dampingRelaxation: 2.8,
      dampingCompression: 4.6,
      maxSuspensionForce: 100000,
      rollInfluence: 0.004,          // CHỐNG LẬT: gần bằng 0
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(),
      maxSuspensionTravel: 0.32,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };
    // Trục hông rộng ±1.08 (chống lật) — bánh trước z +1.22
    [
      new CANNON.Vec3(1.08, -0.12, 1.22),
      new CANNON.Vec3(-1.08, -0.12, 1.22),
      new CANNON.Vec3(1.08, -0.12, -1.22),
      new CANNON.Vec3(-1.08, -0.12, -1.22),
    ].forEach((p) => {
      wheelOpt.chassisConnectionPointLocal = p;
      this.vehicle.addWheel(wheelOpt);
    });
    this.vehicle.addToWorld(this.world);

    /* Mesh xe procedural — FALLBACK khi model mạng chưa tải/ lỗi */
    this.fallbackParts = [];
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);

    const matBody = new THREE.MeshStandardMaterial({ color: '#A63B26', roughness: 0.32, metalness: 0.55 });
    const matDark = new THREE.MeshStandardMaterial({ color: '#1C2228', roughness: 0.12, metalness: 0.85 });
    const matChrome = new THREE.MeshStandardMaterial({ color: '#C8CDD4', roughness: 0.16, metalness: 0.95 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.3), matBody);
    chassis.position.y = 0.05;
    chassis.castShadow = true;
    this.carGroup.add(chassis);
    this.fallbackParts.push(chassis);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.1), matBody);
    hood.position.set(0, 0.38, 1.15);
    hood.rotation.x = -0.09;
    hood.castShadow = true;
    this.carGroup.add(hood);
    this.fallbackParts.push(hood);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.52, 1.5), matDark);
    cabin.position.set(0, 0.55, -0.25);
    cabin.castShadow = true;
    this.carGroup.add(cabin);
    this.fallbackParts.push(cabin);

    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.28, 0.3), matChrome);
    fBumper.position.set(0, -0.12, 1.78);
    fBumper.castShadow = true;
    this.carGroup.add(fBumper);
    this.fallbackParts.push(fBumper);
    const rBumper = fBumper.clone();
    rBumper.position.z = -1.78;
    this.carGroup.add(rBumper);
    this.fallbackParts.push(rBumper);
    [-1, 1].forEach((sx) => {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 2.4), matDark);
      skirt.position.set(sx * 1.02, -0.18, 0);
      this.carGroup.add(skirt);
      this.fallbackParts.push(skirt);
    });

    const lightMat = new THREE.MeshStandardMaterial({ color: '#FFF6D8', emissive: '#FFE9A8', emissiveIntensity: 1.5 });
    const tailMat = new THREE.MeshStandardMaterial({ color: '#FF3020', emissive: '#FF3020', emissiveIntensity: 1.2 });
    [-0.62, 0.62].forEach((sx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
      hl.position.set(sx, 0.12, 1.72);
      this.carGroup.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
      tl.position.set(sx, 0.12, -1.72);
      this.carGroup.add(tl);
    });

    [-0.3, 0.3].forEach((sx) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 12), matChrome);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx, -0.14, -1.8);
      this.carGroup.add(pipe);
    });

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), matDark);
    antenna.position.set(-0.6, 1.25, -1.0);
    this.carGroup.add(antenna);
    this.flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.34),
      new THREE.MeshStandardMaterial({ color: '#FBC02D', side: THREE.DoubleSide, roughness: 0.6 })
    );
    this.flag.position.set(-0.32, 1.62, -1.0);
    this.carGroup.add(this.flag);

    /* 4 bánh: lốp + vành */
    this.wheelMeshes = [];
    const tireGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.4, 24);
    tireGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.42, 12);
    hubGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, new THREE.MeshStandardMaterial({ color: '#232323', roughness: 0.75 }));
      tire.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, matChrome);
      g.add(tire, hub);
      this.scene.add(g);
      this.wheelMeshes.push(g);
    }

    /* Va chạm → âm thanh */
    this.chassisBody.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 2.2 && this.onCollide) this.onCollide(Math.min(v / 12, 1));
    });

    this.engineForce = 0;
    this.steer = 0;
    this.speedKmh = 0;
    this.throttle = 0;
  }

  // Gắn model 3D tải từ mạng (thay thân xe fallback)
  attachCarModel(root) {
    try {
      const bb = new THREE.Box3().setFromObject(root);
      const size = bb.getSize(new THREE.Vector3());
      if (size.x > size.z) root.rotation.y = Math.PI / 2;
      const bb2 = new THREE.Box3().setFromObject(root);
      const size2 = bb2.getSize(new THREE.Vector3());
      const scale = 3.8 / Math.max(size2.z, size2.x, 0.001);
      root.scale.setScalar(scale);
      const bb3 = new THREE.Box3().setFromObject(root);
      const center = bb3.getCenter(new THREE.Vector3());
      root.position.x -= center.x;
      root.position.z -= center.z;
      root.position.y -= bb3.min.y - (-0.82);
      root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (/wheel/i.test(o.name)) o.visible = false; // giữ bánh vật lý của engine
        }
      });
      this.fallbackParts.forEach((m) => { m.visible = false; });
      this.carGroup.add(root);
      this.carModelLoaded = true;
    } catch (e) { /* giữ fallback */ }
  }

  // ---------- 5. TƯỜNG GẠCH ----------
  buildPlaygroundBricks() {
    const brickGeo = new THREE.BoxGeometry(1.1, 0.6, 0.6);
    const colors = ['#EDE5D4', '#C98E3F', '#9C6B4F', '#A84B33'];

    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 6; col++) {
        const mat = new THREE.MeshStandardMaterial({ color: colors[(row + col) % colors.length], roughness: 0.55 });
        const mesh = new THREE.Mesh(brickGeo, mat);
        const x = (col - 2.5) * 1.15 + (row % 2) * 0.3;
        const y = 0.3 + row * 0.62;
        const z = -9;
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const body = new CANNON.Body({ mass: 0.8, sleepSpeedLimit: 0.25, sleepTimeLimit: 0.5 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(0.55, 0.3, 0.3)));
        body.position.set(x, y, z);
        body.sleep();
        this.world.addBody(body);
        this.syncList.push({ mesh, body });
      }
    }
  }

  // ---------- 6. TRẠM ----------
  buildTriggerZones() {
    this.stationConfigs.forEach((cfg) => {
      const group = new THREE.Group();
      group.position.set(cfg.x, 0.06, cfg.z);

      const padMesh = new THREE.Mesh(
        new THREE.RingGeometry(2.8, 3.3, 48),
        new THREE.MeshBasicMaterial({ color: cfg.color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      padMesh.rotation.x = -Math.PI / 2;
      group.add(padMesh);

      const totemMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.05, 0),
        new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.25, metalness: 0.65 })
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
    [
      { pos: [0, 2, -b], size: [b * 2, 4, 1] },
      { pos: [0, 2, b], size: [b * 2, 4, 1] },
      { pos: [-b, 2, 0], size: [1, 4, b * 2] },
      { pos: [b, 2, 0], size: [1, 4, b * 2] },
    ].forEach(({ pos, size }) => {
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
    this.chassisBody.quaternion.setFromEuler(0, 0, 0);
    this.flipTimer = 0;
  }

  teleportHome() {
    this.chassisBody.position.set(0, 2.5, 6);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.setFromEuler(0, 0, 0);
    this.flipTimer = 0;
  }

  // ---------- 7. PHÍM ----------
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
      this.composer.setSize(this.width, this.height);
    });
  }

  // ---------- 8. VÒNG LẶP ----------
  animate() {
    requestAnimationFrame(() => this.animate());
    if (document.hidden) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);

    /* Lái: góc quay giảm theo tốc độ (không văng, không lật) */
    const speedMs = this.chassisBody.velocity.length();
    const maxSteer = 0.4 / (1 + speedMs * 0.05);
    const steerTarget = ((this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0)) * maxSteer;
    this.steer = THREE.MathUtils.lerp(this.steer, steerTarget, dt * 7);
    this.vehicle.setSteeringValue(this.steer, 0);
    this.vehicle.setSteeringValue(this.steer, 1);

    /* RWD — lực đổ vào bánh sau, tăng dần mượt */
    const maxForce = this.keys.boost ? 2100 : 1350;
    const forceTarget = this.keys.forward ? maxForce : this.keys.backward ? -maxForce * 0.55 : 0;
    this.engineForce = THREE.MathUtils.lerp(this.engineForce, forceTarget, dt * 4.5);
    this.vehicle.applyEngineForce(this.engineForce, 2);
    this.vehicle.applyEngineForce(this.engineForce, 3);

    const braking = this.keys.forward || this.keys.backward ? 0.1 : 2.4;
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(braking, i);

    this.world.step(1 / 60, dt, 3);

    /* Sync xe + bánh */
    this.carGroup.position.copy(this.chassisBody.position);
    this.carGroup.quaternion.copy(this.chassisBody.quaternion);
    for (let i = 0; i < 4; i++) {
      this.vehicle.updateWheelTransform(i);
      const t = this.vehicle.wheelInfos[i].worldTransform;
      this.wheelMeshes[i].position.copy(t.position);
      this.wheelMeshes[i].quaternion.copy(t.quaternion);
    }

    /* Tự động hối xe nếu bị lật ngược */
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.carGroup.quaternion);
    if (up.y < 0.25 && speedMs < 2) {
      this.flipTimer += dt;
      if (this.flipTimer > 1.6) { this.teleportHome(); this.flipTimer = 0; }
    } else this.flipTimer = 0;

    /* Tốc độ km/h */
    const fwd = this.chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, -1));
    const vel = this.chassisBody.velocity;
    this.speedKmh = Math.hypot(vel.x, vel.z) * 3.6;
    this.throttle = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 0.6 : 0);

    /* Camera */
    const desiredCamPos = new THREE.Vector3(
      this.carGroup.position.x + this.cameraOffset.x,
      this.carGroup.position.y + this.cameraOffset.y,
      this.carGroup.position.z + this.cameraOffset.z
    );
    this.camera.position.lerp(desiredCamPos, 0.08);
    this.cameraLookTarget.lerp(this.carGroup.position, 0.12);
    this.camera.lookAt(this.cameraLookTarget);
    const targetFov = this.keys.boost ? 45 : 40;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
      this.camera.updateProjectionMatrix();
    }

    /* Trạm + pad + auto-unflip zone check */
    let foundZone = null;
    const elapsed = this.clock.getElapsedTime();
    for (const z of this.zones) {
      z.totemMesh.rotation.y = elapsed * 1.1;
      z.totemMesh.position.y = 2.2 + Math.sin(elapsed * 2.2) * 0.22;
      const dist = Math.hypot(this.carGroup.position.x - z.x, this.carGroup.position.z - z.z);
      if (dist < z.r) foundZone = z;
    }
    const pulseScale = 1 + Math.sin(elapsed * 2) * 0.045;
    this.pulse.forEach((pad) => { pad.scale.set(pulseScale, pulseScale, 1); });
    (this.onFrame || []).forEach((f) => f(elapsed, this.scene));

    if (foundZone?.id !== this.activeZone?.id) {
      this.activeZone = foundZone;
      if (this.onZoneChange) this.onZoneChange(foundZone);
    }

    if (this.audio) this.audio.setSpeed(this.speedKmh, Math.abs(this.throttle));

    this.composer.render();
  }
}
