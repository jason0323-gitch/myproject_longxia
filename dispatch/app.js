/* Rendering and touch/keyboard UI. engine.js owns every routing decision. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const { SWITCHES, STATIONS, Dispatcher } = RailDispatch;
  const canvas = $('scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  } catch (_) {
    $('graphics-error').hidden = false;
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  renderer.setClearColor(0xdceef0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 1200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa2c0ad, 2.6));
  const sunlight = new THREE.DirectionalLight(0xfff3dc, 2.6);
  sunlight.position.set(-45, 95, 40); scene.add(sunlight);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .7, metalness: .1 });
  const deckMat = material(0xe8eee9), railMat = material(0x527c93), tieMat = material(0x829f9f), pillarMat = material(0xc2d3cd);
  function box(w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  function basis(d) {
    const z = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
    return new THREE.Matrix4().makeBasis(d, new THREE.Vector3().crossVectors(z, d), z);
  }
  function label(text, color = '#264b5e', width = 17) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(3, 3, 506, 122, 28); ctx.fill();
    ctx.font = 'bold 54px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 256, 69);
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
    sprite.scale.set(width, width / 4, 1); sprite.renderOrder = 5; scene.add(sprite); return sprite;
  }
  const tracks = DispatchLayout.createTracks();
  const engine = new Dispatcher(tracks.map(t => t.length));
  const wrap = u => ((u % 1) + 1) % 1;
  const point = (track, u) => tracks[track].curve.getPointAt(track < 2 ? wrap(u) : Math.max(0, Math.min(1, u)));
  const tangent = (track, u) => tracks[track].curve.getTangentAt(track < 2 ? wrap(u) : Math.max(0, Math.min(1, u))).normalize();
  function line(points, color, radius = .13) {
    const curve = new THREE.CatmullRomCurve3(points);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 2), radius, 5, false), new THREE.MeshBasicMaterial({ color }));
    scene.add(mesh); return mesh;
  }
  box(218, 2, 132, material(0xc4d9bc), 0, -5.5);
  box(222, 1, 136, material(0x9dbec1), 0, -7);
  const grid = new THREE.GridHelper(216, 36, 0xb2c9ac, 0xb5ceaf); grid.position.y = -4.48; grid.scale.z = 130 / 216; scene.add(grid);
  const crossHighlights = [];
  tracks.forEach((track, index) => {
    const left = [], right = [], center = [];
    const count = index < 2 ? 200 : 100;
    for (let i = 0; i <= count; i++) {
      const u = i / count, p = point(index, u), d = tangent(index, u);
      const normal = new THREE.Vector3(-d.z, 0, d.x).normalize();
      left.push(p.clone().addScaledVector(normal, 1.15)); right.push(p.clone().addScaledVector(normal, -1.15));
      center.push(p.clone().add(new THREE.Vector3(0, .14, 0)));
      if (i < count) {
        const q = point(index, (i + 1) / count), m = box(p.distanceTo(q) + .07, .75, 4.4, deckMat);
        m.position.copy(p.clone().add(q).multiplyScalar(.5)); m.position.y -= .65;
        m.quaternion.setFromRotationMatrix(basis(q.clone().sub(p).normalize()));
        if (i % 2 === 0) {
          const tie = box(.32, .16, 3.2, tieMat); tie.position.copy(p); tie.position.y -= .15; tie.quaternion.setFromRotationMatrix(basis(d));
        }
        if (i % 12 === 0 && Math.abs(p.x) > 22) {
          const h = p.y + 4; box(1, h, 1.4, pillarMat, p.x, -4.4 + h / 2, p.z);
        }
      }
    }
    line(left, 0x527c93); line(right, 0x527c93);
    if (index >= 2) crossHighlights.push(line(center, 0xe9a12f, .28));
  });
  // Small stations and landscape reuse the original scene's geometry primitives.
  STATIONS.forEach((station, i) => {
    const p = point(station.track, station.u), d = tangent(station.track, station.u);
    const normal = new THREE.Vector3(-d.z, 0, d.x).normalize();
    const root = new THREE.Group(); root.position.copy(p).addScaledVector(normal, 7); root.quaternion.setFromRotationMatrix(basis(d)); scene.add(root);
    box(24, 1.2, 7, material(0xeee4ca), 0, -.2, 0, root);
    box(15, .5, 6, material(i ? 0xd9a467 : 0x3e9396), 0, 5, 0, root);
    for (const x of [-6, 6]) box(.35, 4.5, .35, pillarMat, x, 2.5, 0, root);
    const s = label(station.name, i ? '#aa7131' : '#176d72', 19); s.position.copy(root.position).y += 10;
  });
  for (const [x, z] of [[-89,-45],[-75,45],[-52,-45],[89,44],[72,-45],[44,45]]) {
    box(.9, 4, .9, material(0xa48e67), x, -2.5, z);
    const tree = new THREE.Mesh(new THREE.ConeGeometry(3.2, 7, 7), material(0x72a68b)); tree.position.set(x, 1, z); scene.add(tree);
  }
  const switchViews = SWITCHES.map(def => {
    const p = point(def.track, def.u), d = tangent(def.track, def.u);
    const labelPos = p.clone().add(new THREE.Vector3(def.track ? 5 : -5, 8, 0));
    const number = label(String(def.id + 1), '#945f16', 7); number.scale.y = 4; number.position.copy(labelPos);
    const signalPos = point(def.track, def.u - RailDispatch.SIGNAL_DISTANCE / tracks[def.track].length);
    const normal = new THREE.Vector3(-d.z, 0, d.x).normalize(); signalPos.addScaledVector(normal, 3.8);
    box(.35, 4, .35, railMat, signalPos.x, signalPos.y + 2, signalPos.z);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.8, 10, 8), new THREE.MeshBasicMaterial({ color: 0x26a77a })); lamp.position.copy(signalPos).y += 4.4; scene.add(lamp);
    // A continuous rail tongue interpolates toward the selected geometric branch.
    const straight = [], cross = [];
    for (let k = 0; k <= 16; k++) {
      const offset = k / 16 * 10;
      const sign = def.role === 'exit' ? 1 : -1;
      straight.push(point(def.track, def.u + sign * offset / tracks[def.track].length).add(new THREE.Vector3(0, .25, 0)));
      const u = def.role === 'exit' ? offset / tracks[def.link].length : 1 - offset / tracks[def.link].length;
      cross.push(point(def.link, u).add(new THREE.Vector3(0, .25, 0)));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(straight);
    const tongue = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xdf8e17 })); scene.add(tongue);
    // Thick highlight makes selected routes legible on narrow screens.
    const selectedStraight = line(straight, 0xe9a12f, .32), selectedCross = line(cross, 0xe9a12f, .32);
    return { lamp, tongue, straight, cross, selectedStraight, selectedCross };
  });
  const train = createDispatchTrain(THREE); scene.add(train.group);
  const trainLabel = label('G01', '#176d72', 9);
  const trainRing = new THREE.Mesh(new THREE.TorusGeometry(4, .2, 6, 32), new THREE.MeshBasicMaterial({ color: 0x11a39c })); trainRing.rotation.x = Math.PI / 2; scene.add(trainRing);
  const buttons = SWITCHES.map(def => {
    const b = document.createElement('button'); b.className = 'switch-card'; b.type = 'button'; b.dataset.switch = def.id;
    b.innerHTML = `<span class="number"><span>${def.id + 1} 号 · ${def.role === 'exit' ? '出岔' : '入岔'}</span><span class="lock"></span></span><svg viewBox="0 0 110 40" aria-hidden="true"><path d="M9 34 L100 6 M45 23 Q63 31 100 34" fill="none" stroke="#d3dfe0" stroke-width="5" stroke-linecap="round"/><path class="route" fill="none" stroke="#da982d" stroke-width="5" stroke-linecap="round"/></svg><b></b><small></small>`;
    b.addEventListener('click', () => { engine.toggle(def.id); sync(); });
    $(def.id < 2 ? 'switches-a' : 'switches-b').appendChild(b); return b;
  });
  let yaw = 0, pitch = 1.08, zoom = 1, follow = false, drag = null, last = 0, elapsed = 0, lastMessage = '';
  function updateCamera() {
    const direction = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const target = follow ? point(engine.train.track, engine.train.u) : new THREE.Vector3(0, 7, 0);
    let distance = follow ? 65 : Math.max(178, 115 / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    camera.position.copy(direction.multiplyScalar(distance * zoom)).add(target); camera.lookAt(target);
  }
  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight; camera.updateProjectionMatrix(); updateCamera();
  }
  function sync() {
    buttons.forEach((button, i) => {
      const s = engine.switches[i], locked = engine.locked(i);
      button.disabled = locked || s.moving > 0 || engine.auto;
      button.classList.toggle('locked', locked); button.classList.toggle('moving', s.moving > 0);
      button.setAttribute('aria-pressed', String(s.cross));
      button.setAttribute('aria-label', `${SWITCHES[i].name}：${s.cross ? '跨线' : '直行'}，${locked ? '列车通过，已锁定' : s.moving > 0 ? '正在转换' : engine.auto ? '自动演示中' : '点击切换'}`);
      button.querySelector('b').textContent = s.cross ? '跨线 ↗' : '直行 ↑';
      button.querySelector('small').textContent = locked ? '已锁定 · 等车尾通过' : s.moving > 0 ? '转换中 · 红灯等待' : engine.auto ? '自动演示中' : '点一下，切换方向';
      button.querySelector('.lock').textContent = locked ? '锁' : '';
      button.querySelector('.route').setAttribute('d', s.cross ? 'M9 34 L45 23 Q63 31 100 34' : 'M9 34 L100 6');
    });
    $('status').textContent = engine.status();
    if (engine.message !== lastMessage) { $('message').textContent = engine.message; lastMessage = engine.message; }
    $('speed').textContent = engine.train.speed.toFixed(0);
    $('crossings').textContent = engine.crossings; $('arrivals').textContent = engine.arrivals;
    $('journey').textContent = `G01 · ${engine.train.track < 2 ? (engine.train.track ? '右' : '左') + '环线' : '跨线联络桥'}${engine.auto ? ' · 演示中' : ''}`;
    $('pause').textContent = engine.paused ? '▶ 继续画面' : 'Ⅱ 暂停画面'; $('pause').setAttribute('aria-pressed', String(engine.paused));
    $('depart').disabled = engine.running && !engine.paused;
    $('signal-dot').style.background = engine.status().includes('红灯') ? '#dc6854' : engine.train.speed > .01 ? '#149f81' : '#e4a541';
  }
  function draw() {
    train.cars.forEach((car, i) => {
      const pos = engine.positionAt(i * 9.3);
      car.position.copy(point(pos.track, pos.u)); car.position.y += .35;
      car.quaternion.setFromRotationMatrix(basis(tangent(pos.track, pos.u)));
    });
    trainLabel.position.copy(train.cars[0].position).y += 8;
    trainRing.position.copy(train.cars[0].position).y += .1;
    switchViews.forEach((view, i) => {
      const s = engine.switches[i], attr = view.tongue.geometry.attributes.position;
      for (let j = 0; j <= 16; j++) { const p = view.straight[j].clone().lerp(view.cross[j], s.animation); attr.setXYZ(j, p.x, p.y, p.z); }
      attr.needsUpdate = true;
      view.selectedStraight.visible = !s.cross && s.moving === 0;
      view.selectedCross.visible = s.cross && s.moving === 0;
      view.lamp.material.color.setHex(engine.locked(i) || engine.aligned(i) ? 0x23a67c : 0xe7684f);
    });
    crossHighlights.forEach((mesh, i) => {
      const a = engine.switches[i * 2], b = engine.switches[i * 2 + 1];
      mesh.visible = a.cross && b.cross && a.moving === 0 && b.moving === 0;
    });
    updateCamera(); renderer.render(scene, camera);
  }
  $('depart').onclick = () => { engine.depart(); sync(); };
  $('stop').onclick = () => { engine.stop(); sync(); };
  $('pause').onclick = () => { engine.paused = !engine.paused; sync(); };
  $('demo').onclick = () => { engine.reset(true); sync(); };
  $('reset').onclick = () => { engine.reset(); sync(); };
  $('view').onclick = () => { pitch = pitch > 1.4 ? 1.08 : 1.52; yaw = 0; zoom = 1; follow = false; $('follow').setAttribute('aria-pressed', 'false'); $('view').textContent = pitch > 1.4 ? '立体图' : '俯视图'; };
  $('follow').onclick = () => { follow = !follow; zoom = 1; $('follow').setAttribute('aria-pressed', String(follow)); };
  $('zoom-in').onclick = () => { zoom = Math.max(.4, zoom - .16); };
  $('zoom-out').onclick = () => { zoom = Math.min(1.8, zoom + .16); };
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => { if (!drag) return; yaw = drag.yaw - (e.clientX - drag.x) * .005; pitch = Math.max(.45, Math.min(1.52, drag.pitch + (e.clientY - drag.y) * .005)); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, () => { drag = null; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom = Math.max(.4, Math.min(1.8, zoom + e.deltaY * .001)); }, { passive: false });
  document.addEventListener('keydown', e => {
    if (e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
    // Focused buttons/links keep native Space/Enter activation, without a second action.
    if (/^(BUTTON|A)$/.test(e.target.tagName) && ['Space', 'Enter'].includes(e.code)) return;
    const match = /^(?:Digit|Numpad)([1-4])$/.exec(e.code);
    if (match) { e.preventDefault(); engine.toggle(Number(match[1]) - 1); }
    else if (e.code === 'Space') { e.preventDefault(); engine.paused = !engine.paused; }
    else if (e.code === 'Enter') { e.preventDefault(); engine.depart(); }
    else if (e.code === 'KeyS') { e.preventDefault(); engine.stop(); }
    sync();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { engine.paused = true; sync(); } last = 0; });
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); engine.paused = true; $('graphics-error').hidden = false; $('graphics-error').textContent = '3D 画面已中断，列车已暂停。请重新打开页面。'; sync(); });
  // Read-only diagnostic snapshots for acceptance tests; no controls bypass interlocking.
  window.dispatchDebug = Object.freeze({ snapshot: () => ({
    train: { ...engine.train }, cars: [0, 1].map(i => ({ ...engine.positionAt(i * 9.3), position: train.cars[i].position.toArray() })),
    switches: engine.switches.map((s, i) => ({ ...s, locked: engine.locked(i) })), next: { ...engine.next },
    status: engine.status(), paused: engine.paused, auto: engine.auto, running: engine.running,
    crossings: engine.crossings, arrivals: engine.arrivals, visits: engine.visits.map(v => ({ ...v }))
  }) });
  new ResizeObserver(resize).observe(canvas); resize(); sync();
  function loop(now) {
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0; last = now;
    engine.step(dt); elapsed += dt;
    if (elapsed > .12) { sync(); elapsed = 0; }
    draw(); requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
