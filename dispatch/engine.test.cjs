const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { Dispatcher, SWITCHES, STATIONS, SIGNAL_DISTANCE, TAIL_CLEAR } = require('./engine');
const { createTracks } = require('./layout');
const THREE = require('./vendor/three.min');
const tracks = createTracks();
const lengths = tracks.map(t => t.length);
const make = () => new Dispatcher(lengths);
const advance = (e, seconds) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) e.step(1 / 60); };
function until(e, condition, max = 20000) {
  for (let i = 0; i < max; i++) { if (condition()) return; e.step(1 / 60); }
  assert.fail('Simulation condition timed out: ' + e.status());
}
function atStation(e, index) {
  e.train.track = index; e.train.u = STATIONS[index].u; e.station = index;
  e.next = e.nextEvent();
}

test('all four connection endpoints meet the existing rails with matching tangents', () => {
  for (const d of SWITCHES) {
    const u = d.role === 'exit' ? 0 : 1;
    assert.ok(tracks[d.track].curve.getPointAt(d.u).distanceTo(tracks[d.link].curve.getPointAt(u)) < 1e-8);
    assert.ok(tracks[d.track].curve.getTangentAt(d.u).dot(tracks[d.link].curve.getTangentAt(u)) > .99);
  }
});

test('16 switch combinations in both directions obey both end points', () => {
  for (let mask = 0; mask < 16; mask++) for (let start = 0; start < 2; start++) {
    const e = make(); atStation(e, start);
    e.switches.forEach((s, i) => { s.cross = !!(mask & (1 << i)); s.animation = s.cross ? 1 : 0; });
    e.depart(); advance(e, 10);
    const exit = start ? 2 : 0, receiver = exit + 1;
    if (e.switches[exit].cross && !e.switches[receiver].cross) {
      assert.equal(e.visits.length, 0, `mask ${mask}, start ${start}: red signal passed`);
      assert.equal(e.next.index, exit);
      assert.ok(Math.abs(e.next.remaining - SIGNAL_DISTANCE) < 1e-6);
      assert.equal(e.train.speed, 0);
    } else {
      assert.ok(e.visits.length > 0);
      assert.equal(e.visits[0].index, exit);
      assert.equal(e.visits[0].cross, e.switches[exit].cross);
      if (e.switches[exit].cross) assert.ok(e.crossings >= 1);
      else assert.equal(e.train.track, start);
    }
  }
});

test('an incorrectly aligned receiving turnout blocks a train arriving along its loop', () => {
  const e = make(); e.toggle(0); advance(e, 1); e.depart(); advance(e, 20);
  assert.equal(e.next.index, 3); assert.equal(e.train.speed, 0);
  assert.ok(Math.abs(e.next.remaining - SIGNAL_DISTANCE) < 1e-6);
  e.toggle(3); advance(e, .3); assert.equal(e.train.speed, 0);
  advance(e, 2); assert.ok(e.train.speed > 0);
});

test('red-signal waiting resumes only after receiving switch finishes moving', () => {
  const e = make(); e.toggle(1); advance(e, 1); e.depart(); advance(e, 8);
  const stopped = e.train.distance;
  assert.equal(e.train.speed, 0);
  assert.equal(e.toggle(1), true); advance(e, .3);
  assert.equal(e.train.distance, stopped); assert.equal(e.next.reserved, false);
  advance(e, .5); assert.ok(e.train.distance > stopped); assert.equal(e.next.reserved, true);
});

test('paired switches stay locked until the whole train clears the receiver', () => {
  const e = make(); e.depart(); until(e, () => e.locked(0));
  assert.equal(e.locked(1), true); assert.equal(e.toggle(0), false); assert.equal(e.toggle(1), false);
  until(e, () => e.crossings === 1);
  const atExit = e.train.distance;
  assert.equal(e.locked(0), true); assert.equal(e.locked(1), true);
  until(e, () => e.train.distance > atExit + TAIL_CLEAR - 2);
  assert.equal(e.toggle(1), false);
  until(e, () => !e.locked(1)); assert.equal(e.locked(0), false);
  assert.equal(e.toggle(1), true);
});

test('straight-through reservation locks only that turnout and cannot change under the train', () => {
  const e = make(); e.toggle(0); advance(e, 1); e.depart();
  until(e, () => e.locked(0)); assert.equal(e.locked(1), false);
  assert.equal(e.toggle(0), false); until(e, () => e.visits.length > 0);
  assert.equal(e.visits[0].cross, false); assert.equal(e.train.track, 0);
});

test('continuous demo follows all four turnouts; head and rear never jump routes', () => {
  const e = make().reset(true), previous = [null, null];
  let maxJump = 0, crossingWithSplitCars = false;
  for (let frame = 0; frame < 60 * 240; frame++) {
    e.step(1 / 60);
    for (let car = 0; car < 2; car++) {
      const pos = e.positionAt(car * 9.3), p = tracks[pos.track].curve.getPointAt(pos.u);
      assert.ok(p.toArray().every(Number.isFinite));
      if (previous[car]) maxJump = Math.max(maxJump, p.distanceTo(previous[car]));
      previous[car] = p;
    }
    if (e.positionAt(0).track !== e.positionAt(9.3).track) crossingWithSplitCars = true;
  }
  assert.ok(maxJump < .5, `unexpected position jump: ${maxJump}`);
  assert.ok(crossingWithSplitCars, 'rear must retain its old route until it reaches the junction');
  assert.ok(e.crossings >= 8); assert.ok(e.arrivals >= 8);
  assert.deepEqual([...new Set(e.visits.map(v => v.index))].sort(), [0, 1, 2, 3]);
  assert.ok(e.visits.every(v => v.cross && v.reserved));
});

test('manual stop brakes, pause freezes everything, station waits for departure', () => {
  const e = make(); e.depart(); advance(e, 2); e.stop(); advance(e, 3);
  assert.equal(e.train.speed, 0);
  const stopped = e.train.distance; advance(e, 2); assert.equal(e.train.distance, stopped);
  e.depart(); advance(e, 1); e.paused = true;
  const before = JSON.stringify(e); advance(e, 3); assert.equal(JSON.stringify(e), before);
  e.paused = false; until(e, () => e.arrivals === 1);
  assert.equal(e.station, 1); assert.equal(e.train.speed, 0); assert.equal(e.running, false);
  const arrived = e.train.distance; advance(e, 10); assert.equal(e.train.distance, arrived);
  e.depart(); advance(e, 1); assert.ok(e.train.distance > arrived);
});

test('reset clears locks/history and long frames cannot tunnel through a red signal', () => {
  const e = make(); e.toggle(1); advance(e, 1); e.depart();
  for (let n = 0; n < 100; n++) e.step(20);
  assert.equal(e.train.speed, 0); assert.equal(e.visits.length, 0);
  assert.ok(e.next.remaining >= SIGNAL_DISTANCE - 1e-8);
  e.reset(); assert.equal(e.crossings, 0); assert.equal(e.paused, false);
  assert.equal(e.train.distance, 0); assert.equal(e.visits.length, 0);
  assert.ok(e.switches.every((s, i) => s.moving === 0 && !e.locked(i)));
});

test('reused train model builds two finite meshes without combat attachments', () => {
  const context = { window: {} }; vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'train-model.js'), 'utf8'), context);
  const model = context.window.createDispatchTrain(THREE);
  assert.equal(model.cars.length, 2); let bodies = 0;
  model.group.traverse(o => { if (o.userData.trainBody) bodies++; assert.ok(!o.name.includes('hammer')); });
  assert.equal(bodies, 2);
});
