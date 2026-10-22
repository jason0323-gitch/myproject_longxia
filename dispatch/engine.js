/* Independent educational dispatcher; no combat state or rendering dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RailDispatch = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SWITCHES = [
    { id: 0, track: 0, u: .18, role: 'exit', pair: 1, link: 2, name: '1 · 左线出岔' },
    { id: 1, track: 1, u: .82, role: 'entry', pair: 0, link: 2, name: '2 · 右线入岔' },
    { id: 2, track: 1, u: .68, role: 'exit', pair: 3, link: 3, name: '3 · 右线出岔' },
    { id: 3, track: 0, u: .32, role: 'entry', pair: 2, link: 3, name: '4 · 左线入岔' }
  ];
  const STATIONS = [{ track: 0, u: .08, name: '开心站' }, { track: 1, u: .58, name: '海边站' }];
  const SIGNAL_DISTANCE = 12, TAIL_CLEAR = 24, THROW_SECONDS = .65;
  const wrap = u => ((u % 1) + 1) % 1;

  class Dispatcher {
    constructor(lengths) {
      if (lengths.length !== 4 || lengths.some(n => !Number.isFinite(n) || n <= 0)) throw Error('Four positive track lengths required');
      this.lengths = lengths;
      this.reset();
    }
    reset(demo = false) {
      this.switches = SWITCHES.map(() => ({ cross: true, animation: 1, moving: 0, unlockAt: 0 }));
      this.train = { track: 0, u: STATIONS[0].u, speed: 0, distance: 0 };
      this.history = [{ start: -80, end: 0, track: 0, from: wrap(STATIONS[0].u - 80 / this.lengths[0]), length: 80 }];
      this.running = demo;
      this.paused = false;
      this.auto = demo;
      this.station = demo ? null : 0;
      this.dwell = 0;
      this.crossings = 0;
      this.arrivals = 0;
      this.visits = [];
      this.message = demo ? '自动演示：两组道岔已对齐，出发去海边！' : '先看橙色路线，再按「发车」。';
      this.next = this.nextEvent();
      return this;
    }
    nextEvent() {
      const t = this.train;
      if (t.track >= 2) {
        const receiver = SWITCHES[t.track === 2 ? 1 : 3];
        return { kind: 'merge', index: receiver.id, u: 1, remaining: (1 - t.u) * this.lengths[t.track], reserved: true };
      }
      const nodes = SWITCHES.filter(s => s.track === t.track).map(s => ({ kind: 'switch', index: s.id, u: s.u }));
      nodes.push({ kind: 'station', index: t.track, u: STATIONS[t.track].u });
      for (const e of nodes) {
        let gap = wrap(e.u - t.u);
        if (gap < 1e-7) gap = 1;
        e.remaining = gap * this.lengths[t.track];
        e.reserved = false;
      }
      return nodes.sort((a, b) => a.remaining - b.remaining)[0];
    }
    locked(i) { return this.train.distance < this.switches[i].unlockAt - 1e-7; }
    toggle(i) {
      const s = this.switches[i];
      if (!s || this.auto || this.locked(i) || s.moving > 0) return false;
      s.cross = !s.cross;
      s.moving = THROW_SECONDS;
      this.message = `${i + 1} 号道岔正在转换，转换完成前保持红灯。`;
      return true;
    }
    aligned(i) {
      const def = SWITCHES[i], s = this.switches[i];
      if (s.moving > 0) return false;
      if (def.role === 'entry') return !s.cross;
      return !s.cross || (this.switches[def.pair].cross && this.switches[def.pair].moving === 0);
    }
    reserve(e) {
      if (e.reserved || e.kind !== 'switch') return true;
      if (!this.aligned(e.index)) return false;
      const def = SWITCHES[e.index], s = this.switches[e.index];
      e.cross = def.role === 'exit' && s.cross;
      e.reserved = true;
      const clearAt = this.train.distance + e.remaining + TAIL_CLEAR + (e.cross ? this.lengths[def.link] : 0);
      s.unlockAt = Math.max(s.unlockAt, clearAt);
      if (e.cross) this.switches[def.pair].unlockAt = Math.max(this.switches[def.pair].unlockAt, clearAt);
      return true;
    }
    depart() {
      this.running = true;
      this.paused = false;
      if (this.station !== null) {
        this.station = null;
        this.dwell = 0;
      }
      this.message = '发车指令已收到；绿灯通行，红灯会自动停车。';
    }
    stop() { this.running = false; this.auto = false; this.message = '停车指令已收到，列车正在减速。'; }
    status() {
      if (this.paused) return '画面已暂停';
      if (this.station !== null && !this.running) return `${STATIONS[this.station].name} · 停站中`;
      if (!this.running) return this.train.speed > .01 ? '正在减速停车' : '已停车 · 可以发车';
      if (this.next.kind === 'switch' && !this.next.reserved && !this.aligned(this.next.index) && this.next.remaining <= SIGNAL_DISTANCE + .1) return `${this.next.index + 1} 号红灯 · 等待道岔对齐`;
      return this.train.track >= 2 ? '正在跨线 · 道岔已锁定' : '绿灯通行 · 沿轨道行驶';
    }
    move(distance) {
      const t = this.train, e = this.next;
      this.history.push({ start: t.distance, end: t.distance + distance, track: t.track, from: t.u, length: distance });
      t.distance += distance;
      t.u = t.track < 2 ? wrap(t.u + distance / this.lengths[t.track]) : Math.min(1, t.u + distance / this.lengths[t.track]);
      e.remaining = Math.max(0, e.remaining - distance);
      while (this.history.length > 1 && this.history[0].end < t.distance - 80) this.history.shift();
    }
    passEvent() {
      const t = this.train, e = this.next;
      if (e.kind === 'station') {
        t.u = e.u;
        t.speed = 0;
        this.running = false;
        this.station = e.index;
        this.dwell = 3;
        this.arrivals++;
        this.message = `到达${STATIONS[e.index].name}！${this.auto ? '停留 3 秒后再出发。' : '准备好后再按「发车」。'}`;
      } else {
        const def = SWITCHES[e.index];
        this.visits.push({ index: e.index, cross: this.switches[e.index].cross, via: e.kind, distance: t.distance, reserved: e.reserved });
        if (this.visits.length > 200) this.visits.shift();
        if (e.kind === 'merge') {
          t.track = def.track; t.u = def.u; this.crossings++;
          this.message = '跨线完成！车尾离开后，道岔会自动解锁。';
        } else if (e.cross) { t.track = def.link; t.u = 0; }
        else t.u = def.u;
      }
      this.next = this.nextEvent();
    }
    positionAt(back = 0) {
      const wanted = this.train.distance - back;
      if (back === 0) return { track: this.train.track, u: this.train.u };
      for (let i = this.history.length - 1; i >= 0; i--) {
        const h = this.history[i];
        if (wanted >= h.start - 1e-7) {
          const u = h.from + Math.max(0, Math.min(h.length, wanted - h.start)) / this.lengths[h.track];
          return { track: h.track, u: h.track < 2 ? wrap(u) : Math.min(1, u) };
        }
      }
      return { track: this.history[0].track, u: this.history[0].from };
    }
    step(dt) {
      if (this.paused || !Number.isFinite(dt) || dt <= 0) return;
      // Bound work after tab suspension; never leap through a signal on a long frame.
      let left = Math.min(dt, .25);
      while (left > 1e-9) {
        const h = Math.min(left, 1 / 60); left -= h;
        for (const s of this.switches) {
          s.moving = Math.max(0, s.moving - h);
          const target = s.cross ? 1 : 0;
          s.animation += Math.sign(target - s.animation) * Math.min(Math.abs(target - s.animation), h / THROW_SECONDS);
        }
        if (this.station !== null && !this.running && this.auto) {
          this.dwell = Math.max(0, this.dwell - h);
          if (this.dwell === 0) this.depart();
        }
        const t = this.train, e = this.next;
        const braking = t.speed * t.speed / 24;
        if (e.kind === 'switch' && (this.running || t.speed > 0) && e.remaining <= SIGNAL_DISTANCE + braking + 8) this.reserve(e);
        const blocked = e.kind === 'switch' && !e.reserved;
        const limit = blocked ? Math.max(0, e.remaining - SIGNAL_DISTANCE) : e.remaining;
        const mustStop = blocked || e.kind === 'station';
        let target = this.running ? (t.track >= 2 ? 13 : 23) : 0;
        if (mustStop) target = Math.min(target, Math.sqrt(24 * limit));
        const before = t.speed;
        t.speed += Math.sign(target - t.speed) * Math.min(Math.abs(target - t.speed), (target > t.speed ? 7 : 12) * h);
        const distance = Math.min(limit, (before + t.speed) * h / 2);
        if (distance > 1e-9) this.move(distance);
        if (blocked && e.remaining <= SIGNAL_DISTANCE + 1e-7) t.speed = 0;
        if (e.remaining <= 1e-7) this.passEvent();
      }
    }
  }
  return { Dispatcher, SWITCHES, STATIONS, SIGNAL_DISTANCE, TAIL_CLEAR, THROW_SECONDS };
});
