/* ============================================================
   PlayableWorldEngine v4 — Cinematic Warm/Autumn + PLAYGROUND
   Từ skill `playable-3d-world-bruno` + chuẩn bruno-simon.com:
   + ARCADE drive: angularFactor(0,1,0) + neo mặt đất + bicycle
     steering (bẻ lái theo cung tròn, không xoay tại chỗ)
   + MỚI v4: bóng tiếp xúc (contact shadow), bụi bánh xe, mây
     low-poly trôi, pad boost nhảy + tăng tốc, spinner huý xe,
     âm thanh chime/whoosh, xe rơi khi vào trang
   Luật skill: không cuộn, cannon-es, allowSleep, Quick Teleport,
   procedural fallback.
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
    this.onFrame = [];
    this.onCollide = null;
    this.audio = null;

    this.carSpeed = 0;
    this.carHeading = 0;
    this.groundY = 0.42;
    this.axlePos = { x: 0, z: 6.22 };
    this.steerVisual = 0;
    this.throttle = 0;
    this.orbit = { yaw: 0, pitch: 0.85, dragging: false, lastX: 0, lastY: 0, intro: true };
    this.cameraBase = { x: 0, y: 14, z: 19.5 };
    this.zoom = 1;
    this.zoomTarget = 1;
    this.pointers = new Map();
    this.padBoostTimer = 0;
    this.jumpY = 1.6;   // xe rơi xuống khi vào trang (như bruno)
    this.jumpV = 0;
    this.pads = [];
    this.spinners = [];

    this.initThree();
    this.initPhysics();
    this.buildEnvironment();
    this.buildVehicle();
    this.buildDust();
    this.buildClouds();
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

  // Bóng tiếp xúc — mặt phẳng gradient đen mờ (fake AO, chi phí ~0)
  addContactShadow(x, z, size = 4, opacity = 0.3) {
    if (!this.shadowTex) {
      this.shadowTex = this.makeCanvasTexture((ctx, S) => {
        const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        g.addColorStop(0, 'rgba(30,25,18,0.85)');
        g.addColorStop(0.6, 'rgba(30,25,18,0.4)');
        g.addColorStop(1, 'rgba(30,25,18,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }, 128);
    }
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size * 0.72),
      new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, opacity, depthWrite: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.025, z);
    this.scene.add(m);
    return m;
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

  /* Pad boost: lái qua → nhảy + bùng tốc độ */
  addBoostPad(x, z, color = '#10B981') {
    const group = new THREE.Group();
    group.position.set(x, 0.05, z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2.1, 32),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);
    const chevron = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.55),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
    );
    chevron.rotation.x = -Math.PI / 2;
    group.add(chevron);
    this.scene.add(group);
    this.pads.push({ x, z, ring, chevron, color });
    return group;
  }

  /* Spinner: thanh quay KINEMATIC — đi gần là bị huý */
  addSpinner(x, z) {
    const post = this.addStaticCylinder({ pos: new THREE.Vector3(x, 0.8, z), radiusTop: 0.3, radiusBottom: 0.4, height: 1.6, color: '#4A4238', metalness: 0.4, roughness: 0.5, seg: 18 });

    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 0.32, 0.34),
      new THREE.MeshStandardMaterial({ color: '#B5533C', roughness: 0.4, metalness: 0.3 })
    );
    bar.position.set(x, 0.62, z);
    bar.castShadow = true;
    this.scene.add(bar);
    const tips = [-3.2, 3.2].map((dx) => {
      const t = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.4, 0.5),
        new THREE.MeshStandardMaterial({ color: '#EFE6D2', roughness: 0.5 })
      );
      t.position.set(x + dx, 0.62, z);
      t.castShadow = true;
      this.scene.add(t);
      return t;
    });

    const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: this.defaultMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(3.6, 0.16, 0.17)));
    body.position.set(x, 0.62, z);
    this.world.addBody(body);

    this.spinners.push({ bar, tips, body, x, z });
  }

  // ---------- 1. THREE.JS ----------
  initThree() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#E3D3B4');
    this.scene.fog = new THREE.FogExp2('#E3D3B4', 0.0058);

    this.camera = new THREE.PerspectiveCamera(40, this.width / this.height, 0.5, 300);
    this.camera.position.set(0, 38, 20);
    this.cameraLookTarget = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

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
          c.rgb *= vec3(1.03, 1.0, 0.955);
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
      restitution: 0.1,
    });
    this.world.defaultContactMaterial = contactMat;

    const floorBody = new CANNON.Body({ mass: 0, material: this.defaultMaterial });
    floorBody.addShape(new CANNON.Plane());
    floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(floorBody);
  }

  // ---------- 3. SÀN ----------
  buildEnvironment() {
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: '#D8C49C', roughness: 0.95 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    outer.receiveShadow = true;
    this.scene.add(outer);
  }

  // ---------- 4. XE ARCADE + CHI TIẾT ----------
  buildVehicle() {
    this.carGroup = new THREE.Group();
    this.scene.add(this.carGroup);
    this.carTilt = new THREE.Group();
    this.carGroup.add(this.carTilt);
    this.fallbackParts = [];

    const matBody = new THREE.MeshStandardMaterial({ color: '#A63B26', roughness: 0.32, metalness: 0.55 });
    const matDark = new THREE.MeshStandardMaterial({ color: '#1C2228', roughness: 0.12, metalness: 0.85 });
    const matChrome = new THREE.MeshStandardMaterial({ color: '#C8CDD4', roughness: 0.16, metalness: 0.95 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 3.3), matBody);
    chassis.position.y = 0.05;
    chassis.castShadow = true;
    this.carTilt.add(chassis);
    this.fallbackParts.push(chassis);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 1.1), matBody);
    hood.position.set(0, 0.38, 1.15);
    hood.rotation.x = -0.09;
    hood.castShadow = true;
    this.carTilt.add(hood);
    this.fallbackParts.push(hood);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.52, 1.5), matDark);
    cabin.position.set(0, 0.55, -0.25);
    cabin.castShadow = true;
    this.carTilt.add(cabin);
    this.fallbackParts.push(cabin);

    const fBumper = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.28, 0.3), matChrome);
    fBumper.position.set(0, -0.12, 1.78);
    fBumper.castShadow = true;
    this.carTilt.add(fBumper);
    this.fallbackParts.push(fBumper);
    const rBumper = fBumper.clone();
    rBumper.position.z = -1.78;
    this.carTilt.add(rBumper);
    this.fallbackParts.push(rBumper);
    [-1, 1].forEach((sx) => {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 2.4), matDark);
      skirt.position.set(sx * 1.02, -0.18, 0);
      this.carTilt.add(skirt);
      this.fallbackParts.push(skirt);
    });

    const lightMat = new THREE.MeshStandardMaterial({ color: '#FFF6D8', emissive: '#FFE9A8', emissiveIntensity: 1.5 });
    const tailMat = new THREE.MeshStandardMaterial({ color: '#FF3020', emissive: '#FF3020', emissiveIntensity: 1.2 });
    [-0.62, 0.62].forEach((sx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lightMat);
      hl.position.set(sx, 0.12, 1.72);
      this.carTilt.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.06), tailMat);
      tl.position.set(sx, 0.12, -1.72);
      this.carTilt.add(tl);
    });

    [-0.3, 0.3].forEach((sx) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 12), matChrome);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(sx, -0.14, -1.8);
      this.carTilt.add(pipe);
    });

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.1, 8), matDark);
    antenna.position.set(-0.6, 1.25, -1.0);
    this.carTilt.add(antenna);
    this.flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.34),
      new THREE.MeshStandardMaterial({ color: '#FBC02D', side: THREE.DoubleSide, roughness: 0.6 })
    );
    this.flag.position.set(-0.32, 1.62, -1.0);
    this.carTilt.add(this.flag);

    /* Vật lý arcade: CHỈ yaw + neo mặt đất */
    const chassisShape = new CANNON.Box(new CANNON.Vec3(0.98, 0.4, 1.72));
    this.chassisBody = new CANNON.Body({
      mass: 34,
      material: this.defaultMaterial,
      linearDamping: 0.25,
      angularDamping: 0.9,
    });
    this.chassisBody.addShape(chassisShape);
    this.chassisBody.position.set(0, this.groundY + 1.4, 5); // rơi xuống khi vào trang
    this.chassisBody.angularFactor.set(0, 1, 0);
    this.chassisBody.updateMassProperties();
    this.world.addBody(this.chassisBody);

    /* Bóng tiếp xúc bám theo xe (tạo trong buildVehicle) */
    this.carShadow = this.addContactShadow(0, 5, 5.2, 0.34);

    /* 4 bánh hình ảnh: xoay theo tốc độ, 2 bánh TRƯỚC (phía -z) lái */
    this.wheelMeshes = [];
    const tireGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.38, 20);
    tireGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.4, 12);
    hubGeo.rotateZ(Math.PI / 2);
    const tireMat = new THREE.MeshStandardMaterial({ color: '#232323', roughness: 0.75 });
    const hubMat = new THREE.MeshStandardMaterial({ color: '#C8CDD4', roughness: 0.2, metalness: 0.9 });
    [[-1.08, -1.22, true], [1.08, -1.22, true], [-1.08, 1.22, false], [1.08, 1.22, false]].forEach(([x, z, front]) => {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      const hub = new THREE.Mesh(hubGeo, hubMat);
      g.add(tire, hub);
      g.position.set(x, 0.05, z);
      g.userData.front = front;
      this.carGroup.add(g);
      this.wheelMeshes.push(g);
    });

    /* Va chạm → âm thanh */
    this.chassisBody.addEventListener('collide', (e) => {
      const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
      if (v > 2 && this.onCollide) this.onCollide(Math.min(v / 10, 1));
    });

    this.carSpeed = 0;
    this.carHeading = 0;
    this.throttle = 0;
    this.steerVisual = 0;
  }

  // ---------- BỤI BÁNH XE ----------
  buildDust() {
    const N = 70;
    const tex = this.makeCanvasTexture((ctx, S) => {
      const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      g.addColorStop(0, 'rgba(190,168,128,0.85)');
      g.addColorStop(1, 'rgba(190,168,128,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }, 64);
    this.dustGeo = new THREE.BufferGeometry();
    this.dustPos = new Float32Array(N * 3);
    this.dustLife = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.dustPos[i * 3 + 1] = -50;
      this.dustLife[i] = Math.random() * -3;
    }
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    this.dustGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 300);
    const mat = new THREE.PointsMaterial({
      map: tex, size: 1.15, transparent: true, opacity: 0.5,
      depthWrite: false, color: '#C9B28A', sizeAttenuation: true,
    });
    this.dust = new THREE.Points(this.dustGeo, mat);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
    this.dustN = N;
  }

  // ---------- MÂY LOW-POLY ----------
  buildClouds() {
    const mat = new THREE.MeshStandardMaterial({ color: '#FBF6EC', roughness: 1 });
    this.clouds = [];
    const spots = [[-20, 22, -30], [10, 24, -34], [24, 20, 12], [-26, 23, 18], [4, 26, 30], [-8, 21, -38]];
    spots.forEach(([x, y, z], i) => {
      const g = new THREE.Group();
      [[0, 0, 0, 2.2], [1.8, -0.3, 0.4, 1.6], [-1.7, -0.25, -0.3, 1.5], [0.6, 0.7, 0, 1.4]].forEach(([dx, dy, dz, r]) => {
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
        s.position.set(dx, dy, dz);
        g.add(s);
      });
      g.position.set(x, y, z);
      g.scale.setScalar(0.8 + Math.random() * 0.6);
      this.scene.add(g);
      this.clouds.push({ g, sp: 0.24 + Math.random() * 0.3, x0: x });
    });
  }

  // ---------- 5. GẠCH ----------
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
    this.carHeading = 0;
    this.carSpeed = 0;
    this.axlePos = { x: target.x, z: target.z + 3.4 + 1.22 };
    this.syncCar();
  }

  teleportHome() {
    this.carHeading = 0;
    this.carSpeed = 0;
    this.axlePos = { x: 0, z: 6.22 };
    this.syncCar();
  }

  // Đồng bộ thân xe theo trục bánh sau (dùng khi teleport)
  syncCar() {
    const fx = -Math.sin(this.carHeading);
    const fz = -Math.cos(this.carHeading);
    this.chassisBody.position.set(this.axlePos.x + fx * 1.22, this.groundY + (this.jumpY || 0), this.axlePos.z + fz * 1.22);
    this.chassisBody.velocity.set(fx * this.carSpeed, 0, fz * this.carSpeed);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.setFromEuler(0, this.carHeading, 0);
  }

  // ---------- 7. PHÍM + POINTER (orbit / pinch) ----------
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

    const el = this.renderer.domElement;
    this.pointers = new Map();
    el.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.orbit.dragging = true;
        this.orbit.lastX = e.clientX;
        this.orbit.lastY = e.clientY;
      } else {
        this.orbit.dragging = false;
      }
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const prev = this.pointers.get(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (this.pointers.size === 2) {
        // PINCH zoom (cảm ứng)
        const ids = [...this.pointers.keys()];
        const other = this.pointers.get(ids.find((id) => id !== e.pointerId) || ids[0]);
        const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        if (d0 > 0 && d1 > 0) {
          this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * (d0 / d1), 0.45, 2.4);
        }
        return;
      }
      if (!this.orbit.dragging) return;
      const dx = e.clientX - this.orbit.lastX;
      const dy = e.clientY - this.orbit.lastY;
      this.orbit.lastX = e.clientX;
      this.orbit.lastY = e.clientY;
      this.orbit.yaw -= dx * 0.006;
      this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + dy * 0.004, -0.12, 0.6);
    });
    const release = (e) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) this.orbit.dragging = false;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    /* Zoom con lăn */
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * (1 + e.deltaY * 0.0011), 0.45, 2.4);
    }, { passive: false });

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
    const elapsed = this.clock.getElapsedTime();

    /* Tăng/giảm tốc (pad boost nhân tối đa) */
    const accel = this.keys.boost ? 26 : 20;
    const maxSpeed = (this.keys.boost ? 21 : 14) * (this.padBoostTimer > 0 ? 1.5 : 1);
    if (this.keys.forward) this.carSpeed = Math.min(this.carSpeed + accel * dt, maxSpeed);
    else if (this.keys.backward) this.carSpeed = Math.max(this.carSpeed - accel * 0.8 * dt, -7);
    else this.carSpeed = THREE.MathUtils.lerp(this.carSpeed, 0, dt * 2.6);

    /* Bánh trước đánh lái — góc giảm theo tốc độ */
    const speedMs = Math.abs(this.carSpeed);
    const maxSteer = 0.42 / (1 + speedMs * 0.05);
    const steerInput = (this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0);
    this.steerVisual = THREE.MathUtils.lerp(this.steerVisual, steerInput * maxSteer, Math.min(dt * 8, 1));

    /* BICYCLE: heading quay theo cung — turnRate = v/L·tan(δ) */
    const steer = this.steerVisual;
    const turnRate = (this.carSpeed / 2.44) * Math.tan(THREE.MathUtils.clamp(steer * 1.9, -0.6, 0.6));
    this.carHeading += turnRate * dt;

    const fx = -Math.sin(this.carHeading);
    const fz = -Math.cos(this.carHeading);
    this.axlePos.x = THREE.MathUtils.clamp(this.axlePos.x + fx * this.carSpeed * dt, -(this.bounds - 3), this.bounds - 3);
    this.axlePos.z = THREE.MathUtils.clamp(this.axlePos.z + fz * this.carSpeed * dt, -(this.bounds - 3), this.bounds - 3);

    this.chassisBody.wakeUp();
    this.chassisBody.velocity.set(fx * this.carSpeed, 0, fz * this.carSpeed);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.setFromEuler(0, this.carHeading, 0);

    /* Nhảy (pad boost) — vật lý vẫn phẳng, chỉ nâng hình ảnh */
    if (this.jumpY > 0 || this.jumpV > 0) {
      this.jumpV -= 22 * dt;
      this.jumpY = Math.max(0, this.jumpY + this.jumpV * dt);
      if (this.jumpY === 0) this.jumpV = 0;
    }

    this.world.step(1 / 60, dt, 3);

    /* Neo mặt đất + sync */
    this.chassisBody.position.y = this.groundY;
    this.chassisBody.quaternion.setFromEuler(0, this.carHeading, 0);
    this.chassisBody.velocity.y = 0;

    this.carGroup.position.set(
      this.chassisBody.position.x,
      this.chassisBody.position.y + this.jumpY,
      this.chassisBody.position.z
    );
    this.carGroup.rotation.set(0, this.carHeading, 0);
    this.carShadow.position.set(this.carGroup.position.x, 0.026, this.carGroup.position.z);
    this.carShadow.material.opacity = 0.34 - Math.min(this.jumpY * 0.1, 0.18);

    /* Bánh xe + nghiêng hình ảnh */
    const wheelSpin = this.carSpeed * dt * 2.4;
    this.wheelMeshes.forEach((g) => {
      g.children[0].rotation.x -= wheelSpin;
      if (g.userData.front) g.rotation.y = this.steerVisual;
    });
    let targetPitch = 0;
    if (this.keys.forward) targetPitch = 0.026;
    else if (this.keys.backward) targetPitch = -0.02;
    else if (Math.abs(this.carSpeed) > 1) targetPitch = -0.012;
    const targetRoll = THREE.MathUtils.clamp(
      ((this.keys.left ? 1 : 0) - (this.keys.right ? 1 : 0)) * Math.min(speedMs / 14, 1) * 0.055,
      -0.07, 0.07
    );
    this.carTilt.rotation.x = THREE.MathUtils.lerp(this.carTilt.rotation.x, targetPitch, dt * 5);
    this.carTilt.rotation.z = THREE.MathUtils.lerp(this.carTilt.rotation.z, targetRoll, dt * 5);

    /* Cờ phất */
    this.flag.rotation.y = Math.sin(elapsed * 9) * (0.2 + Math.min(Math.abs(this.carSpeed) / 14, 1) * 0.6);

    this.speedKmh = Math.abs(this.carSpeed) * 3.6;
    this.throttle = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 0.6 : 0);

    /* Bụi sau xe khi chạy nhanh */
    this.updateDust(dt, elapsed);

    /* Spinner quay (KINEMATIC) — đi gần là bị huý */
    const tipOff = new CANNON.Vec3();
    for (const sp of this.spinners) {
      sp.body.angularVelocity.set(0, 2.2, 0);
      sp.bar.quaternion.copy(sp.body.quaternion);
      sp.tips.forEach((tip, k) => {
        tipOff.set(k === 0 ? -3.2 : 3.2, 0, 0);
        const world = sp.body.pointToWorldFrame(tipOff);
        tip.position.set(world.x, world.y, world.z);
      });
    }

    /* Pad boost */
    if (this.padBoostTimer > 0) this.padBoostTimer -= dt;
    for (const pad of this.pads) {
      pad.ring.scale.setScalar(1 + Math.sin(elapsed * 3) * 0.06);
      const d = Math.hypot(this.carGroup.position.x - pad.x, this.carGroup.position.z - pad.z);
      if (d < 2 && this.jumpY === 0 && this.padBoostTimer <= 0) {
        this.jumpV = 6.4;
        this.padBoostTimer = 1.4;
        if (this.audio) this.audio.whoosh();
      }
    }

    /* Camera orbit quanh xe + zoom */
    if (!this.orbit.dragging && !this.orbit.intro) {
      this.orbit.yaw *= 0.96;
      this.orbit.pitch *= 0.94;
    }
    this.zoom = THREE.MathUtils.lerp(this.zoom, this.zoomTarget, Math.min(dt * 7, 1));
    const baseR = Math.hypot(this.cameraBase.y, this.cameraBase.z) * (this.zoom || 1);
    const elev = THREE.MathUtils.clamp(
      Math.atan2(this.cameraBase.y, this.cameraBase.z) + this.orbit.pitch, 0.12, 1.25
    );
    const ox = Math.sin(this.orbit.yaw) * Math.cos(elev) * baseR;
    const oy = Math.sin(elev) * baseR;
    const oz = Math.cos(this.orbit.yaw) * Math.cos(elev) * baseR;
    const desiredCamPos = new THREE.Vector3(
      this.carGroup.position.x + ox,
      this.carGroup.position.y + oy,
      this.carGroup.position.z + oz
    );
    this.camera.position.lerp(desiredCamPos, 0.09);
    this.cameraLookTarget.lerp(this.carGroup.position, 0.12);
    this.camera.lookAt(this.cameraLookTarget);
    const targetFov = (this.keys.boost || this.padBoostTimer > 0) ? 45 : 40;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
      this.camera.updateProjectionMatrix();
    }

    /* Trạm + zone */
    let foundZone = null;
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
      if (foundZone && this.audio) this.audio.chime();
    }

    /* Mây trôi */
    for (const c of this.clouds) {
      c.g.position.x += c.sp * dt;
      if (c.g.position.x > 70) c.g.position.x = -70;
    }

    if (this.audio) this.audio.setSpeed(this.speedKmh, Math.abs(this.throttle));

    this.composer.render();
  }

  /* Bụi update */
  updateDust(dt, elapsed) {
    const w = this;
    const pos = w.dustPos;
    const life = w.dustLife;
    const speed = Math.abs(w.carSpeed);
    const emitting = speed > 6;
    for (let i = 0; i < w.dustN; i++) {
      life[i] -= dt;
      if (life[i] <= 0) {
        if (emitting && Math.random() < 0.3) {
          const rx = w.carGroup.position.x + (Math.random() - 0.5) * 1.6 - Math.sin(w.carHeading) * 1.6;
          const rz = w.carGroup.position.z + (Math.random() - 0.5) * 1.6 - Math.cos(w.carHeading) * 1.6;
          pos[i * 3] = rx;
          pos[i * 3 + 1] = 0.15 + Math.random() * 0.3;
          pos[i * 3 + 2] = rz;
          life[i] = 0.5 + Math.random() * 0.6;
        } else {
          pos[i * 3 + 1] = -50;
        }
      } else {
        pos[i * 3 + 1] += dt * (0.6 + life[i]);
        pos[i * 3] += Math.sin(elapsed * 3 + i) * dt * 0.5;
      }
    }
    w.dustGeo.attributes.position.needsUpdate = true;
  }
}
