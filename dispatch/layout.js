/* The two original figure-eight curves are retained. Two grade-separated links
 * replace the combat crossovers so each end has its own visible turnout. */
(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/three.min.js'), require('./engine.js'));
  else root.DispatchLayout = factory(root.THREE, root.RailDispatch);
})(typeof globalThis !== 'undefined' ? globalThis : this, function(THREE, Rail) {
  function createTracks() {
    const tracks = [];
    for (let n = 0; n < 2; n++) {
      const pts = [];
      for (let i = 0; i < 128; i++) {
        const a = i / 128 * Math.PI * 2;
        pts.push(new THREE.Vector3((n ? 54 : -54) + 42 * Math.sin(a), 11 + 9 * Math.cos(a), 34 * Math.sin(2 * a)));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
      curve.arcLengthDivisions = 2048; curve.updateArcLengths();
      tracks.push({ curve, length: curve.getLength() });
    }
    for (const [from, to, lift] of [[0, 1, 13], [2, 3, -5]]) {
      const a = Rail.SWITCHES[from], b = Rail.SWITCHES[to];
      const start = tracks[a.track].curve.getPointAt(a.u), end = tracks[b.track].curve.getPointAt(b.u);
      const handle = start.distanceTo(end) * .65;
      const c1 = start.clone().addScaledVector(tracks[a.track].curve.getTangentAt(a.u), handle);
      const c2 = end.clone().addScaledVector(tracks[b.track].curve.getTangentAt(b.u), -handle);
      const base = new THREE.CubicBezierCurve3(start, c1, c2, end), pts = [];
      for (let i = 0; i <= 200; i++) {
        const t = i / 200, p = base.getPoint(t);
        p.y += Math.sin(Math.PI * t) ** 2 * lift;
        pts.push(p);
      }
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      curve.arcLengthDivisions = 2048; curve.updateArcLengths();
      tracks.push({ curve, length: curve.getLength() });
    }
    return tracks;
  }
  return { createTracks };
});
