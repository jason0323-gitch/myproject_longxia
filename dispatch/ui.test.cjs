/* Headless wiring test using real Three geometry and a stub DOM/renderer.
 * This catches script/bootstrap/control regressions, NOT WebGL/browser visuals. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const THREE = require('./vendor/three.min');
const RailDispatch = require('./engine');
const DispatchLayout = require('./layout');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase(); this.style = {}; this.dataset = {}; this.children = [];
    this.listeners = {}; this.attributes = {}; this.parts = {}; this.hidden = false; this.clientWidth = 1000; this.clientHeight = 460;
    this.classList = { toggle() {} };
  }
  setAttribute(k, v) { this.attributes[k] = v; }
  appendChild(c) { this.children.push(c); }
  addEventListener(k, v) { this.listeners[k] = v; }
  querySelector(k) { return this.parts[k] ||= new Element(); }
  getContext() { return { beginPath() {}, roundRect() {}, fill() {}, fillText() {} }; }
  setPointerCapture() {}
  click() { if (!this.disabled) { this.onclick?.(); this.listeners.click?.(); } }
}
function boot(width = 1000) {
  const elements = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  elements.scene.tagName = 'CANVAS'; elements.scene.clientWidth = width;
  const handlers = {};
  const document = {
    hidden: false,
    getElementById: id => { assert.ok(elements[id], `Missing real HTML id: ${id}`); return elements[id]; },
    createElement: tag => new Element(tag),
    addEventListener: (k, v) => handlers[k] = v
  };
  let frame, renderCount = 0;
  class Renderer {
    setPixelRatio() {} setClearColor() {} setSize() {}
    render(scene, camera) {
      assert.ok(scene.children.length > 500); assert.ok(camera.position.toArray().every(Number.isFinite));
      renderCount++;
    }
  }
  const context = {
    window: {}, document, THREE: { ...THREE, WebGLRenderer: Renderer }, RailDispatch, DispatchLayout,
    devicePixelRatio: 2, ResizeObserver: class { observe() {} }, requestAnimationFrame: cb => frame = cb
  };
  vm.createContext(context);
  for (const file of ['train-model.js', 'app.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context, { filename: file });
    if (file === 'train-model.js') context.createDispatchTrain = context.window.createDispatchTrain;
  }
  let now = 1;
  const run = frames => { for (let n = 0; n < frames; n++) { now += 1000 / 60; frame(now); } };
  return { elements, handlers, context, run, get renders() { return renderCount; }, snapshot: context.window.dispatchDebug.snapshot };
}

test('desktop and narrow viewport initialization, scene geometry, and real controls execute', () => {
  for (const width of [1000, 366]) {
    const app = boot(width); app.run(2);
    const { elements: el } = app;
    assert.equal(el['switches-a'].children.length + el['switches-b'].children.length, 4);
    assert.equal(app.snapshot().train.speed, 0);
    el.depart.click(); app.run(240);
    assert.ok(app.snapshot().train.distance > 20);
    const cars = app.snapshot().cars;
    const tracks = DispatchLayout.createTracks();
    for (const car of cars) {
      const expected = tracks[car.track].curve.getPointAt(car.u); expected.y += .35;
      assert.ok(expected.distanceTo(new THREE.Vector3(...car.position)) < 1e-6);
    }
    el.pause.click(); const before = app.snapshot().train.distance;
    app.run(60); assert.equal(app.snapshot().train.distance, before);
    el.pause.click(); el.stop.click(); app.run(180); assert.equal(app.snapshot().train.speed, 0);
    el.demo.click(); assert.equal(app.snapshot().auto, true); app.run(20);
    el.reset.click(); assert.equal(app.snapshot().auto, false); assert.equal(app.snapshot().train.distance, 0);
    el.view.click(); el.follow.click(); el['zoom-in'].click(); app.run(1);
    assert.ok(app.renders > 500);
  }
});

test('keyboard switch keys work with a focused button and native activation is not duplicated', () => {
  const app = boot(); app.run(1);
  const event = code => ({ code, target: { tagName: 'BUTTON' }, preventDefault() {} });
  app.handlers.keydown(event('Digit2'));
  assert.equal(app.snapshot().switches[1].cross, false);
  app.handlers.keydown(event('Space')); assert.equal(app.snapshot().paused, false);
  app.handlers.keydown({ ...event('Space'), target: { tagName: 'BODY' } });
  assert.equal(app.snapshot().paused, true);
  app.context.document.hidden = true; app.handlers.visibilitychange();
  assert.equal(app.snapshot().paused, true);
});

test('every local script and stylesheet is present; page does not require a CDN', () => {
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (m[1].startsWith('../')) continue;
    assert.ok(!/^https?:/.test(m[1]));
    assert.ok(fs.existsSync(path.join(__dirname, m[1])), m[1]);
  }
});
