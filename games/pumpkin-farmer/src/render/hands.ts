// [E] The hands-on close-ups' world pieces (plan §3.14). Wave 1 has one close-up, the bug hunt, and it adds two draw calls
// (T.hands.maxExtraDraws allows 8), neither casting a shadow: the hunt's big leaves (a bug that runs under one hides there,
// and the leaf wiggles until it is flipped; a flipped leaf curls up out of the way) and the green splats where bugs were
// squished. The UI's hunt arrives with the out-event-style fx 'hunt/start' { row, hunt } and leaves with 'hunt/end';
// K.hunt hands it to render/patch.js's bug section, which draws the bugs themselves. Nothing here reads the sim state.
import * as THREE from 'three';
import { M, pool, hideAt, clamp } from './kit.js';
import { DEAD } from '../sim/hunt.js';
import type { FxEvent, Kit, View } from './types.js';

const SPLATS = 14, LEAVES = 3, Y_LEAF = 0.47, Y_SPLAT = 0.37, HAZE = 0.3;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();

export default function createHandsView(K: Kit): View {
  const root = new THREE.Group(); root.name = 'hands'; root.visible = false; K.scene.add(root);
  // a broad leaf, centred on its hiding spot: the patch's 6-point leaf, rounder and bigger
  const leafGeo = new THREE.CircleGeometry(1, 7);
  { const lp = leafGeo.getAttribute('position'); for (let i = 1; i < lp.count; i++) { const f = i % 2 ? 1 : 0.8; lp.setXY(i, lp.getX(i) * f, lp.getY(i) * f * 0.8); } }
  leafGeo.rotateX(-Math.PI / 2);
  const leaves = pool(leafGeo, M(0x86ad5e, { side: THREE.DoubleSide }), LEAVES, false, root);   // (a touch yellower than the row's)
  const splatGeo = new THREE.CircleGeometry(1, 9);
  { const sp = splatGeo.getAttribute('position'); for (let i = 1; i < sp.count; i++) { const f = i % 2 ? 1 : 0.55; sp.setXY(i, sp.getX(i) * f, sp.getY(i) * f); } }
  splatGeo.rotateX(-Math.PI / 2);
  const splats = pool(splatGeo, M(0x8fb04a, { emissive: 0x2a3a10, emissiveIntensity: 0.4 }), SPLATS, false, root);
  const flipT = new Float32Array(LEAVES);

  // up close Marlene is a thin haze (fun beats fidelity: you can't squish what you can't see); she rolls back in after
  let fogged = false;
  function sync(_s: unknown, dt: number, t: number) {
    const H = K.hunt?.H;
    root.visible = !!H;
    if (!!H !== fogged) { fogged = !!H; if (!H) K.sky?.setFogOverride?.(0); }
    if (H) K.sky?.setFogOverride?.(Math.min(0, HAZE - (K.sky.baseFog ?? 0)));
    if (!H) return;
    for (let k = H.leaves.length; k < LEAVES; k++) hideAt(leaves, k);     // (a fresh cluster has less cover)
    H.leaves.forEach((L, k) => {
      if (k >= LEAVES) return;
      flipT[k] = L.open ? Math.min(1, (flipT[k] ?? 0) + dt * 3) : 0;
      const f = flipT[k] ?? 0, wig = L.wig * Math.sin(t * 38 + k) * 0.22;
      if (f >= 1) { hideAt(leaves, k); return; }
      // flipped: it curls up and away (the bugs under it are in the open again)
      e.set(wig - f * 1.9, k * 1.3 + wig * 0.6, wig * 0.7);
      leaves.setMatrixAt(k, m4.compose(p.set(L.x, Y_LEAF + f * 0.5, L.z - f * 0.3), q.setFromEuler(e), sc.setScalar(0.48 * (1 - f * 0.6))));
    });
    let n = 0;
    for (const b of H.bugs) {
      if (b.st !== DEAD || n >= SPLATS) continue;
      const age = H.time - b.at, k = clamp(1 - (age - 1.4) / 0.8, 0, 1) * clamp(age / 0.08, 0.3, 1);   // splats, then fades
      e.set(0, b.h, 0);
      splats.setMatrixAt(n, k > 0 ? m4.compose(p.set(b.x, Y_SPLAT, b.z), q.setFromEuler(e), sc.set(0.2 * k, 1, 0.16 * k)) : m4.makeScale(0, 0, 0));
      n++;
    }
    for (let i = n; i < SPLATS; i++) hideAt(splats, i);
    leaves.instanceMatrix.needsUpdate = true; splats.instanceMatrix.needsUpdate = true;
  }
  function fx(ev: FxEvent) {
    if (ev.type === 'hunt/start') { K.hunt = { row: ev.row, H: ev.hunt }; flipT.fill(0); }
    else if (ev.type === 'hunt/end') K.hunt = null;
  }
  return {
    sync, fx,
    dispose() { K.hunt = null; K.scene.remove(root); leaves.dispose(); splats.dispose(); leafGeo.dispose(); splatGeo.dispose(); },
  };
}
