// Animal folk (architecture §4.3). The prototype's low-poly rig, extended to all 10 species,
// kids, townsfolk accessories, the Weighmaster and one quadruped builder for Biscuit and Pamela.
//
// Animal Crossing rule: every adult stands the same height (head top ~1.39-1.45 model units, a little
// more for tall ears), then FOLK_SCALE. Kids are 0.55 with a 1.18 head. The Weighmaster is twice that.
//
// Rigs are built from parts exactly like the prototype, but the groups are THREE.Bones and all the parts
// are baked into ONE vertex-coloured SkinnedMesh per character (skinRig). That makes a full hero rig
// cost one draw call (plus its shadow) instead of ~15, which is what keeps phones under budget.
// makeFolk(...) returns { root, body, legs, arms, head, tail, phase, animate(dt, speed, opts) }:
// root is a Group you position and turn (+z is the face); the rest are bones you may pose.
import * as THREE from 'three';
import {
  PI, lerp, rng, gait, M, C, VC, part, prepGeo, taperTube, mergeGeometries, disposeTree,
  ICO0, ICO1, CYL, CYL8, CONE, BOX,
} from './kit.js';
import { fogPatch } from './fog.js';

export const FOLK_SCALE = 1.25;
export const SPECIES_KEYS = ['possum', 'skunk', 'raccoon', 'beaver', 'coyote', 'fox', 'owl', 'pelican', 'otter', 'seal'];
const R = rng(1201);

// ---------------------------------------------------------------- species
// fur/belly/limb/foot/headC colours, skull scale, eye placement, and face/tail builders.
// Builders get (parent, c) where c(hex) is the (possibly greyed) cached material.
export const SPECIES = {
  possum: {
    fur: 0xa9a8ad, belly: 0xe9e5dc, headC: 0xf1ede4, limb: 0x4b4a4f, foot: 0xe9a3a7,
    face(h, c) {
      part(CONE, c(0xf1ede4), [0, -0.06, 0.36], [0.14, 0.28, 0.14], [PI / 2, 0, 0], h);
      part(ICO0, c(0xe9a3a7), [0, -0.06, 0.51], [0.055, 0.05, 0.05], [0, 0, 0], h);
      for (const sx of [-1, 1]) part(ICO1, c(0x2d2c30), [sx * 0.23, 0.24, -0.02], [0.11, 0.12, 0.045], [0, sx * 0.3, sx * -0.35], h);
    },
    tail(t, c) { taperTube([[0, 0, 0], [0, -0.14, -0.22], [0.06, -0.3, -0.45], [0.2, -0.36, -0.62], [0.33, -0.27, -0.68], [0.35, -0.12, -0.6]], 0.06, 0.018, c(0xe9a3a7), t); },
  },
  skunk: {
    fur: 0x2a2a30, limb: 0x232328,
    face(h, c) {
      part(CONE, c(0x2a2a30), [0, -0.07, 0.34], [0.12, 0.24, 0.12], [PI / 2, 0, 0], h);
      part(ICO0, c(0x5a4148), [0, -0.07, 0.47], [0.045, 0.04, 0.04], [0, 0, 0], h);
      part(ICO1, c(0xf3f0e8), [0, 0.12, 0.21], [0.055, 0.2, 0.13], [-0.75, 0, 0], h);
      for (const sx of [-1, 1]) part(ICO1, c(0x2a2a30), [sx * 0.2, 0.25, 0], [0.08, 0.08, 0.04], [0, 0, 0], h);
    },
    tail(t, c) {
      part(ICO1, c(0x2a2a30), [0, 0.2, -0.12], [0.2, 0.26, 0.19], [0, 0, 0], t);
      part(ICO1, c(0x2a2a30), [0, 0.52, -0.2], [0.23, 0.25, 0.21], [0, 0, 0], t);
      part(ICO1, c(0x2a2a30), [0, 0.8, -0.1], [0.19, 0.19, 0.18], [0, 0, 0], t);
      part(ICO1, c(0xf3f0e8), [0, 0.5, -0.36], [0.085, 0.42, 0.075], [-0.15, 0, 0], t);
    },
    back(b, c) { part(ICO1, c(0xf3f0e8), [0, 0.68, -0.17], [0.09, 0.3, 0.12], [0.2, 0, 0], b); },
  },
  raccoon: {
    fur: 0x8f8b86, belly: 0xc9c4bb, limb: 0x3c3836, eyeZ: 0.345,
    face(h, c) {
      const dark = c(0x2f2b29), light = c(0xe8e3da);
      part(ICO1, dark, [0, 0.04, 0.22], [0.31, 0.085, 0.13], [0, 0, 0], h);
      part(ICO1, light, [0, -0.09, 0.28], [0.14, 0.09, 0.13], [0, 0, 0], h);
      part(ICO0, dark, [0, -0.06, 0.41], [0.05, 0.04, 0.04], [0, 0, 0], h);
      for (const sx of [-1, 1]) {
        part(ICO1, light, [sx * 0.11, 0.14, 0.26], [0.07, 0.03, 0.03], [0, 0, 0], h);
        part(CONE, c(0x8f8b86), [sx * 0.2, 0.3, -0.02], [0.08, 0.15, 0.05], [0, 0, sx * -0.35], h);
        part(ICO0, light, [sx * 0.24, 0.37, -0.02], [0.03, 0.03, 0.02], [0, 0, 0], h);
      }
    },
    tail(t, c) {
      t.rotation.x = -0.9; // a ringed stack raked up and back
      for (let i = 0; i < 6; i++) part(CYL, c(i % 2 ? 0x2f2b29 : 0xa29d96), [0, 0.06 + i * 0.12, 0], [0.12 - i * 0.012, 0.12, 0.12 - i * 0.012], [0, 0, 0], t);
    },
  },
  // NEW: flat paddle tail, buck teeth, little round ears (Augustus Vance, Bea)
  beaver: {
    fur: 0x8a6446, belly: 0xc6a27c, limb: 0x5b4130, foot: 0x3f3128, webbed: true, skull: [0.35, 0.3, 0.32],
    face(h, c) {
      part(ICO1, c(0xc9a77f), [0, -0.08, 0.25], [0.17, 0.13, 0.14], [0, 0, 0], h);
      part(ICO0, c(0x2e2420), [0, -0.01, 0.38], [0.065, 0.045, 0.04], [0, 0, 0], h);
      for (const sx of [-1, 1]) {
        part(BOX, c(0xf4ead2), [sx * 0.026, -0.2, 0.33], [0.046, 0.085, 0.025], [0.15, 0, 0], h);
        part(ICO1, c(0x6e4e36), [sx * 0.24, 0.2, -0.04], [0.075, 0.075, 0.04], [0, sx * 0.3, 0], h);
      }
    },
    tail(t, c) { part(ICO1, c(0x4e3d33), [0, -0.3, -0.3], [0.19, 0.045, 0.34], [-0.5, 0, 0], t); },
  },
  // NEW: long snout, tall ears, bushy black-tipped tail (Howlin' Hal, Howie, Big Tom)
  coyote: {
    fur: 0xb39a78, belly: 0xebe0cb, headC: 0xb8a07e, limb: 0x8c7559, foot: 0x5d4b3b, skull: [0.32, 0.3, 0.31], eyeY: 0.07,
    face(h, c) {
      const tan = c(0xb39a78);
      part(CONE, tan, [0, -0.05, 0.38], [0.14, 0.34, 0.12], [PI / 2, 0, 0], h);
      part(CONE, c(0xeee4d0), [0, -0.1, 0.36], [0.1, 0.28, 0.07], [PI / 2, 0, 0], h);
      part(ICO0, c(0x2b2522), [0, -0.035, 0.55], [0.045, 0.04, 0.04], [0, 0, 0], h);
      for (const sx of [-1, 1]) {
        part(CONE, tan, [sx * 0.17, 0.33, -0.04], [0.09, 0.24, 0.05], [0, 0, sx * -0.25], h);
        part(CONE, c(0x7a6450), [sx * 0.165, 0.31, -0.005], [0.05, 0.16, 0.02], [0, 0, sx * -0.25], h);
      }
    },
    tail(t, c) {
      t.rotation.x = 0.5;
      part(ICO1, c(0xb39a78), [0, -0.12, -0.16], [0.11, 0.12, 0.2], [0.6, 0, 0], t);
      part(ICO1, c(0xa58b6a), [0, -0.27, -0.3], [0.1, 0.11, 0.17], [0.9, 0, 0], t);
      part(ICO1, c(0x3a302a), [0, -0.38, -0.38], [0.07, 0.08, 0.1], [1.1, 0, 0], t);
    },
  },
  // NEW: white cheeks, black socks, big ears, huge white-tipped tail (Sasha, Sienna Vale, Ladybug Lady)
  fox: {
    fur: 0xd2733a, belly: 0xf4efe6, headC: 0xd77a3e, limb: 0x3a2c26, foot: 0x2a211d, skull: [0.33, 0.3, 0.31], eyeY: 0.08,
    face(h, c) {
      const orange = c(0xd77a3e), white = c(0xf4efe6), dark = c(0x2a211d);
      part(CONE, orange, [0, -0.04, 0.37], [0.13, 0.3, 0.115], [PI / 2, 0, 0], h);
      part(CONE, white, [0, -0.085, 0.36], [0.1, 0.26, 0.07], [PI / 2, 0, 0], h);
      part(ICO0, dark, [0, -0.03, 0.52], [0.042, 0.038, 0.038], [0, 0, 0], h);
      for (const sx of [-1, 1]) {
        part(ICO1, white, [sx * 0.15, -0.08, 0.17], [0.13, 0.11, 0.12], [0, 0, 0], h);
        part(CONE, orange, [sx * 0.18, 0.33, -0.03], [0.12, 0.26, 0.05], [0, 0, sx * -0.3], h);
        part(CONE, c(0xf4efe6), [sx * 0.175, 0.31, 0.0], [0.065, 0.17, 0.02], [0, 0, sx * -0.3], h);
        part(CONE, dark, [sx * 0.205, 0.42, -0.03], [0.055, 0.09, 0.055], [0, 0, sx * -0.3], h);
      }
    },
    tail(t, c) {
      t.rotation.x = 0.35;
      part(ICO1, c(0xd2733a), [0, -0.06, -0.24], [0.17, 0.17, 0.3], [0.5, 0, 0], t);
      part(ICO1, c(0xd2733a), [0, -0.2, -0.5], [0.15, 0.15, 0.2], [0.8, 0, 0], t);
      part(ICO1, c(0xf4efe6), [0, -0.29, -0.64], [0.1, 0.1, 0.12], [0.9, 0, 0], t);
    },
  },
  // NEW: facial disc, big amber eyes, ear tufts, wings (Edna Hootley, Prof. Hoot)
  owl: {
    fur: 0x8a7558, belly: 0xdacdb3, headC: 0x8f7a5c, limb: 0xc9a24a, foot: 0xc9a24a, wing: 0x76624a, skull: [0.36, 0.32, 0.33],
    eyeZ: 0.32, eyeY: 0.06, eyeX: 0.125, eyeS: 1.15, iris: 0xf2b84b, waddle: 0.09,
    face(h, c) {
      part(ICO1, c(0xe4d7bd), [0, 0.03, 0.18], [0.31, 0.25, 0.17], [0, 0, 0], h);
      part(ICO1, c(0x6e5a42), [0, 0.13, 0.31], [0.05, 0.06, 0.03], [0, 0, 0], h);
      part(CONE, c(0x5a4a3a), [0, -0.05, 0.35], [0.05, 0.13, 0.05], [PI * 0.62, 0, 0], h);
      for (const sx of [-1, 1]) {
        part(CONE, c(0x6e5a42), [sx * 0.2, 0.33, -0.01], [0.075, 0.2, 0.05], [0, 0, sx * -0.4], h);
        part(ICO1, c(0x8f7a5c), [sx * 0.16, 0.12, 0.27], [0.1, 0.035, 0.04], [0, 0, sx * -0.35], h);
      }
    },
    tail(t, c) { part(ICO1, c(0x6e5a42), [0, -0.12, -0.08], [0.15, 0.05, 0.17], [-0.7, 0, 0], t); },
    back(b, c) { for (let i = 0; i < 3; i++) part(ICO1, c(0xc8b897), [(i - 1) * 0.07, 0.5 - (i % 2) * 0.06, 0.27], [0.025, 0.02, 0.01], [0, 0, 0], b); },
  },
  pelican: {
    fur: 0x8b7f70, belly: 0x6f6355, headC: 0xefe7cf, limb: 0x3c3c3c, wing: 0x6e6253, webbed: true, skull: [0.29, 0.28, 0.29], waddle: 0.12,
    face(h, c) {
      part(ICO1, c(0xe5c66b), [0, 0.21, 0.02], [0.17, 0.07, 0.17], [0, 0, 0], h);
      part(ICO1, c(0x5a4030), [0, -0.12, -0.19], [0.13, 0.22, 0.1], [0.3, 0, 0], h);
      part(BOX, c(0xc2a37e), [0, -0.05, 0.56], [0.1, 0.05, 0.62], [0.12, 0, 0], h);
      part(ICO0, c(0xc4553a), [0, -0.1, 0.87], [0.04, 0.04, 0.05], [0, 0, 0], h);
      part(ICO1, c(0x5e5a55), [0, -0.15, 0.48], [0.07, 0.07, 0.25], [0.12, 0, 0], h);
    },
    tail(t, c) { part(ICO1, c(0x5e5346), [0, 0.05, -0.08], [0.16, 0.05, 0.16], [0.3, 0, 0], t); },
  },
  // sea otter: dark brown with a pale, grizzled face, a broad whiskery muzzle, tiny ears, a flat tapering tail
  otter: {
    fur: 0x5e4535, belly: 0x6f5444, headC: 0xc9b9a0, limb: 0x47342a, foot: 0x3a2c24, webbed: true, skull: [0.35, 0.3, 0.32],
    eyeZ: 0.285, eyeY: 0.07, eyeX: 0.13, waddle: 0.07,
    face(h, c) {
      const pale = c(0xe2d6c1);
      for (const sx of [-1, 1]) {
        part(ICO1, pale, [sx * 0.075, -0.09, 0.27], [0.11, 0.09, 0.1], [0, 0, 0], h);          // whisker pads
        for (let k = 0; k < 3; k++) part(CYL, c(0xf4efe6), [sx * 0.2, -0.08 - k * 0.03, 0.3], [0.006, 0.18, 0.006], [0, 0, sx * (PI / 2 - 0.1 + k * 0.12)], h);
        part(ICO1, c(0x6e5444), [sx * 0.27, 0.12, -0.05], [0.055, 0.05, 0.035], [0, 0, 0], h); // little ears
      }
      part(ICO1, c(0x2a211c), [0, -0.03, 0.35], [0.07, 0.05, 0.045], [0, 0, 0], h);           // big nose
      part(BOX, c(0x3a2c24), [0, -0.16, 0.31], [0.06, 0.012, 0.02], [0, 0, 0], h);
    },
    tail(t, c) { part(ICO1, c(0x4e392c), [0, -0.22, -0.22], [0.12, 0.05, 0.3], [-0.55, 0, 0], t); },
  },
  // harbor seal: the one species that doesn't walk on its hind legs. A long body propped on its front flippers, head
  // up, hind flippers trailing; it flumps (makeFlumper). No outer ears, a short dog-like muzzle, huge dark eyes. Harbor
  // seals come in many coats (the owner's photos from the harbor): each family wears one of COATS, pups like their mom.
  seal: {
    flump: true, skull: [0.3, 0.28, 0.31], eyeZ: 0.255, eyeY: 0.06, eyeX: 0.12, eyeS: 1.45, waddle: 0,
    coats: [
      { name: 'silver', fur: 0xd9d5cc, belly: 0xe6e2da, headC: 0xd6d2c9, limb: 0xb8b3a9, spot: 0x2f2d2b, spots: 46 },
      { name: 'sandy', fur: 0xc9a77d, belly: 0xd8bc94, headC: 0xcdab81, limb: 0xa98a64, spot: 0, spots: 0 },
      { name: 'charcoal', fur: 0x4c4a47, belly: 0x6b6865, headC: 0x5a5855, limb: 0x3d3b39, spot: 0xcdc8bc, spots: 90, spotS: 0.6 },
      { name: 'grey', fur: 0xaeaba4, belly: 0xc8c5bd, headC: 0xb6b3ac, limb: 0x8b8883, spot: 0x585552, spots: 34 },
      { name: 'cocoa', fur: 0x7e6651, belly: 0x957d65, headC: 0x856d57, limb: 0x65513f, spot: 0x4e3e31, spots: 16 },
    ],
    face(h, c, sp) {
      part(ICO1, c(sp.belly), [0, -0.08, 0.24], [0.15, 0.11, 0.12], [0, 0, 0], h);            // muzzle
      part(ICO0, c(0x2b2a29), [0, -0.03, 0.35], [0.055, 0.032, 0.03], [0, 0, 0], h);          // V nostrils
      part(BOX, c(0x3a3634), [0, -0.15, 0.31], [0.05, 0.01, 0.02], [0, 0, 0], h);
      for (const sx of [-1, 1]) {
        for (let k = 0; k < 3; k++) part(CYL, c(0xf2efe6), [sx * 0.17, -0.08 - k * 0.025, 0.27], [0.005, 0.16, 0.005], [0, 0, sx * (PI / 2 - 0.12 + k * 0.12)], h);
        part(ICO0, c(0x3a3836), [sx * 0.27, 0.06, -0.05], [0.018, 0.018, 0.01], [0, 0, 0], h);  // ear holes
      }
    },
  },
};

// ---------------------------------------------------------------- accessories
// Each gets the rig under construction (f: { head, body, hips, shoulders, sp, top }) and options.
const ACC = {
  // straw sun hat: the farmer's, Grandpa's lucky hat, the Ladybug Lady's (red, spotted)
  hat(f, o, c) {
    const y = f.top - 0.04, straw = c(o.color ?? 0xd8bc72);
    part(CYL8, straw, [0, y, -0.02], [0.43, 0.03, 0.43], [-0.1, 0, 0], f.head);
    part(CYL8, straw, [0, y + 0.1, -0.03], [0.22, 0.17, 0.22], [-0.1, 0, 0], f.head);
    part(CYL8, c(o.band ?? 0xb5543f), [0, y + 0.045, -0.025], [0.228, 0.05, 0.228], [-0.1, 0, 0], f.head);
    if (o.spots) for (let i = 0; i < 7; i++) { const a = i / 7 * PI * 2 + 0.3; part(ICO0, c(0x2d2a28), [Math.cos(a) * 0.33, y + 0.02 + Math.sin(a) * 0.035, -0.02 + Math.sin(a) * 0.33], [0.045, 0.012, 0.045], [-0.1, 0, 0], f.head); }
  },
  // the player farmer's denim overalls
  overalls(f, o, c) {
    const d = c(o.color ?? 0x5b7499), btn = c(0xe5c66b);
    if (f.sp.flump) {                                               // a seal's overalls: a bib and straps over the chest
      part(ICO1, d, [0, 0.42, 0.12], [0.315, 0.26, 0.315], [-0.35, 0, 0], f.body);
      part(BOX, d, [0, 0.62, 0.36], [0.2, 0.17, 0.04], [-0.6, 0, 0], f.body);
      for (const sx of [-1, 1]) part(ICO0, btn, [sx * 0.07, 0.69, 0.33], [0.026, 0.026, 0.02], [0, 0, 0], f.body);
      return;
    }
    part(ICO1, d, [0, 0.45, 0.012], [0.322, 0.2, 0.283], [0, 0, 0], f.body);
    part(BOX, d, [0, 0.64, 0.262], [0.22, 0.19, 0.04], [-0.27, 0, 0], f.body);
    for (const sx of [-1, 1]) {
      part(new THREE.TorusGeometry(1, 0.11, 4, 10, PI).rotateY(PI / 2), d, [sx * 0.105, 0.69, 0.0], [0.2, 0.2, 0.25], [0, 0, 0], f.body);
      part(ICO0, btn, [sx * 0.08, 0.715, 0.262], [0.028, 0.028, 0.02], [0, 0, 0], f.body);
    }
    for (const hip of f.hips) part(CYL, d, [0, -0.09, 0], [0.105, 0.2, 0.105], [0, 0, 0], hip);
  },
  // Gran's reading glasses (and Edna's gold pair)
  glasses(f, o, c) {
    const m = c(o.color ?? 0x3a3330), ez = (f.sp.eyeZ ?? 0.29) + 0.035, ey = f.sp.eyeY ?? 0.05, ex = f.sp.eyeX ?? 0.12;
    const ring = new THREE.TorusGeometry(0.068, 0.013, 4, 12);
    for (const sx of [-1, 1]) {
      part(ring, m, [sx * ex, ey, ez], [1, 1, 1], [0, sx * 0.18, 0], f.head);
      part(BOX, m, [sx * (ex + 0.07), ey + 0.01, ez - 0.12], [0.012, 0.012, 0.22], [0, sx * -0.25, 0], f.head);
    }
    part(BOX, m, [0, ey + 0.01, ez + 0.01], [ex * 2 - 0.13, 0.012, 0.012], [0, 0, 0], f.head);
  },
  // Gran's knitted shawl (also Old Moss's mossy one)
  shawl(f, o, c) {
    const k = c(o.color ?? 0x9d86b8);
    part(new THREE.ConeGeometry(1, 1, 9), k, [0, 0.8, -0.01], [0.37, 0.27, 0.33], [0, 0, 0], f.body);
    part(ICO0, c(o.pin ?? 0xe5c66b), [0, 0.73, 0.29], [0.04, 0.04, 0.03], [0, 0, 0], f.body);
  },
  // a sash with a medal (the Mayor, judges)
  sash(f, o, c) {
    part(new THREE.TorusGeometry(1, 0.06, 4, 18).rotateX(PI / 2), c(o.color ?? 0xb5543f), [0, 0.6, 0.02], [0.318, 1, 0.29], [0, 0, 0.62], f.body);
    part(ICO1, c(0xe5c66b), [0.1, 0.62, 0.27], [0.055, 0.055, 0.025], [0, 0.2, 0], f.body);
  },
  // a torch in the right paw; the lens glows (its own small mesh so it can be emissive)
  flashlight(f, o, c) {
    const arm = f.shoulders[1];
    part(CYL8, c(0x3a3f43), [0, -0.3, 0.07], [0.045, 0.2, 0.045], [PI / 2, 0, 0], arm);
    const lens = part(CYL8, M(0xfff1b8, { emissive: 0xffe08a, emissiveIntensity: 1.4 }), [0, -0.3, 0.175], [0.05, 0.02, 0.05], [PI / 2, 0, 0], arm);
    lens.userData.keep = true; lens.castShadow = false;
  },
  cap(f, o, c) {
    const col = c(o.color ?? 0x34445a), y = f.top, style = o.style ?? 'baseball', fwd = o.back ? -1 : 1;
    if (style === 'beanie') {
      part(ICO1, col, [0, y - 0.07, -0.01], [0.3, 0.2, 0.3], [0, 0, 0], f.head);
      part(ICO0, c(0xefe5c8), [0, y + 0.12, -0.01], [0.07, 0.07, 0.07], [0, 0, 0], f.head);
    } else if (style === 'police') {
      part(CYL8, col, [0, y + 0.03, -0.01], [0.27, 0.12, 0.27], [-0.08, 0, 0], f.head);
      part(CYL8, col, [0, y + 0.1, 0.0], [0.31, 0.05, 0.31], [-0.12, 0, 0], f.head);
      part(BOX, c(0x1d2420), [0, y - 0.02, 0.27], [0.24, 0.02, 0.14], [0.25, 0, 0], f.head);
      part(ICO0, c(0xe5c66b), [0, y + 0.05, 0.27], [0.045, 0.05, 0.02], [0, 0, 0], f.head);
    } else {
      part(ICO1, col, [0, y - 0.05, 0], [0.3, 0.17, 0.3], [0, 0, 0], f.head);
      part(BOX, style === 'hard' ? col : c(o.bill ?? o.color ?? 0x34445a), [0, y - 0.08, fwd * 0.27], [style === 'hard' ? 0.36 : 0.22, 0.02, style === 'hard' ? 0.1 : 0.18], [fwd * 0.12, 0, 0], f.head);
      if (style === 'hard') part(CYL8, col, [0, y - 0.07, 0], [0.34, 0.02, 0.34], [0, 0, 0], f.head);
    }
  },
  tophat(f, o, c) {
    const col = c(o.color ?? 0x2d2c30), y = f.top - 0.01;
    part(CYL8, col, [0, y, 0], [0.27, 0.025, 0.27], [-0.06, 0, 0.08], f.head);
    part(CYL8, col, [0.01, y + 0.17, 0], [0.16, 0.32, 0.16], [-0.06, 0, 0.08], f.head);
    part(CYL8, c(o.band ?? 0xb5543f), [0.005, y + 0.05, 0], [0.165, 0.05, 0.165], [-0.06, 0, 0.08], f.head);
  },
  // Edna's editor's visor
  // Edna's editor's visor: a band hugging the head where it's widest, and a green brim in front
  visor(f, o, c) {
    const col = c(o.color ?? 0x5f8f6a), [sx, sy, sz] = f.sp.skull ?? [0.34, 0.31, 0.32], y = sy * 0.4, k = Math.sqrt(1 - 0.16) + 0.02;
    part(new THREE.TorusGeometry(1, 0.035, 4, 20).rotateX(PI / 2), c(0x3a4a40), [0, y, 0], [sx * k, 0.7, sz * k], [0, 0, 0], f.head);
    part(new THREE.CylinderGeometry(1, 1, 1, 12, 1, false, -0.85, 1.7), col, [0, y + 0.01, 0.05], [sx * 0.95, 0.018, sz * 1.15], [0.18, 0, 0], f.head);
  },
  apron(f, o, c) {
    const col = c(o.color ?? 0x6f8b7b);
    part(BOX, col, [0, 0.5, 0.29], [0.3, 0.34, 0.03], [-0.12, 0, 0], f.body);
    part(new THREE.TorusGeometry(1, 0.05, 4, 16).rotateX(PI / 2), col, [0, 0.62, 0.02], [0.3, 1, 0.27], [0, 0, 0], f.body);
  },
  headphones(f, o, c) {
    const band = c(0x2d2a28), cup = c(o.color ?? 0xd9782d), r = (f.sp.skull?.[0] ?? 0.34) + 0.03;
    part(new THREE.TorusGeometry(1, 0.08, 4, 14, PI), band, [0, 0.03, -0.03], [r, r * 0.95, r], [0, 0, 0], f.head);
    for (const sx of [-1, 1]) part(CYL8, cup, [sx * r, 0.0, -0.03], [0.1, 0.07, 0.1], [0, 0, PI / 2], f.head);
  },
  // hi-vis vest (Howie)
  vest(f, o, c) {
    part(ICO1, c(o.color ?? 0xf08a3c), [0, 0.6, -0.01], [0.318, 0.3, 0.272], [0, 0, 0], f.body);
    part(new THREE.TorusGeometry(1, 0.07, 4, 18).rotateX(PI / 2), c(0xf2e7a0), [0, 0.55, -0.01], [0.33, 1, 0.29], [0, 0, 0], f.body);
  },
  bandana(f, o, c) {
    const col = c(o.color ?? 0xb5543f);
    part(new THREE.TorusGeometry(1, 0.06, 4, 16).rotateX(PI / 2), col, [0, 0.86, 0.02], [0.2, 1, 0.19], [0.15, 0, 0], f.body);
    part(CONE, col, [0, 0.78, 0.2], [0.13, 0.16, 0.05], [PI - 0.35, 0, 0], f.body);
  },
  flatcap(f, o, c) {
    const col = c(o.color ?? 0x6b6a62), y = f.top - 0.03;
    part(ICO1, col, [0, y, 0.03], [0.31, 0.1, 0.34], [0.12, 0, 0], f.head);
    part(BOX, col, [0, y - 0.04, 0.3], [0.26, 0.02, 0.12], [0.3, 0, 0], f.head);
  },
};

// ---------------------------------------------------------------- skinning
// Bake every part under root into one vertex-coloured SkinnedMesh; each vertex follows its nearest
// ancestor bone. Parts flagged userData.keep (special materials) stay as they are.
function skinRig(root, bones) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), index = new Map(bones.map((b, i) => [b, i]));
  const geos = [], dead = [], m4 = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.userData.keep) return;
    let b = o.parent; while (b && !index.has(b)) b = b.parent;
    const bi = index.get(b) ?? 0, mat = o.material;
    const g = prepGeo(o.geometry, m4.multiplyMatrices(inv, o.matrixWorld), mat.userData.vc ? mat.color : new THREE.Color(0xffffff));
    const n = g.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geos.push(g); dead.push(o);
  });
  for (const d of dead) { d.parent.remove(d); if (![ICO0, ICO1, CYL, CYL8, CONE, BOX].includes(d.geometry)) d.geometry.dispose(); }
  const mesh = new THREE.SkinnedMesh(mergeGeometries(geos), VC);
  mesh.castShadow = true; mesh.receiveShadow = true;
  root.add(mesh);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.computeBoundingSphere(); mesh.boundingSphere.radius *= 1.6;
  return mesh;
}

function eyes(head, sp, c) {
  const eye = c(0x221f1d), shine = c(0xffffff), ez = sp.eyeZ ?? 0.29, ey = sp.eyeY ?? 0.05, ex = sp.eyeX ?? 0.12, es = sp.eyeS ?? 1;
  for (const sx of [-1, 1]) {
    if (sp.iris) part(ICO1, c(sp.iris), [sx * ex, ey, ez - 0.012], [0.075, 0.075, 0.03], [0, sx * 0.25, 0], head);
    part(ICO0, eye, [sx * ex, ey, ez], [0.045 * es, 0.055 * es, 0.03], [0, 0, 0], head);
    part(ICO0, shine, [sx * ex + 0.015 * es, ey + 0.025 * es, ez + 0.025], [0.014 * es, 0.014 * es, 0.01], [0, 0, 0], head);
  }
}
const greyed = (hex, k) => (k ? new THREE.Color(hex).lerp(new THREE.Color(0xc9c5bd), k).getHex() : hex);

// ---------------------------------------------------------------- the biped rig
export function makeFolk(species = 'possum', opts = {}) {
  const base0 = SPECIES[species] || SPECIES.possum;
  const sp = { ...base0, ...(base0.coats?.[opts.coat ?? 0] || {}), ...opts.colors };
  const { kid = false, nested = false, grey = 0 } = opts;
  const c = (hex) => C(greyed(hex, grey));
  if (sp.flump) return makeFlumper(species, sp, opts, c);
  const root = new THREE.Group(), body = new THREE.Bone(); root.add(body);
  root.name = species;
  const fur = c(sp.fur), belly = c(sp.belly ?? sp.fur), limbM = c(sp.limb ?? sp.fur), footM = c(sp.foot ?? sp.limb ?? sp.fur);
  const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const hip = new THREE.Bone(); hip.position.set(sx * 0.13, 0.34, 0); root.add(hip);
    part(CYL, limbM, [0, -0.15, 0], [0.085, 0.3, 0.085], [0, 0, 0], hip);
    part(ICO0, footM, [0, -0.31, 0.06], sp.webbed ? [0.15, 0.05, 0.2] : [0.1, 0.07, 0.15], [0, 0, 0], hip);
    legs.push(hip);
    const sh = new THREE.Bone(); sh.position.set(sx * 0.27, 0.76, 0); sh.rotation.z = sx * 0.25; body.add(sh);
    if (sp.wing) part(ICO1, c(sp.wing), [sx * 0.02, -0.17, -0.02], [0.07, 0.25, 0.17], [0, 0, 0], sh);
    else { part(CYL, limbM, [0, -0.14, 0], [0.065, 0.28, 0.065], [0, 0, 0], sh); part(ICO0, footM, [0, -0.3, 0], [0.075, 0.075, 0.075], [0, 0, 0], sh); }
    arms.push(sh);
  }
  part(ICO1, fur, [0, 0.58, 0], [0.3, 0.32, 0.26], [0, 0, 0], body);
  part(ICO1, belly, [0, 0.55, 0.1], [0.21, 0.24, 0.18], [0, 0, 0], body);
  const head = new THREE.Bone(); head.position.set(0, 1.08, 0.02); body.add(head);
  const skull = sp.skull ?? [0.34, 0.31, 0.32];
  part(ICO1, c(sp.headC ?? sp.fur), [0, 0, 0], skull, [0, 0, 0], head);
  sp.face(head, c, sp);
  eyes(head, sp, c);
  const tail = new THREE.Bone(); tail.position.set(0, 0.42, -0.22); body.add(tail);
  sp.tail?.(tail, c, sp);
  sp.back?.(body, c, sp);
  const f = { root, body, head, hips: legs, shoulders: arms, sp, top: skull[1] };
  // accessories keep their own colours (Gran is greyer; her shawl isn't)
  for (const a of opts.accessories || []) {
    const [name, o] = Array.isArray(a) ? a : [a, {}];
    ACC[name]?.(f, o || {}, C);
  }
  const mesh = skinRig(root, [body, head, tail, ...legs, ...arms]);
  if (kid) { head.scale.setScalar(1.18); head.position.y = 1.02; }
  root.scale.setScalar((opts.scale ?? sp.scale ?? (kid ? 0.55 : 1)) * (nested ? 1 : FOLK_SCALE));
  const base = { legY: 0.34 };
  const rig = {
    root, body, legs, arms, head, tail, mesh, species, kid, phase: R.rand() * 10, t: R.rand() * 10,
    // speed: ground speed in world units/s; the stride keeps the feet on the ground (kit.gait), and a run leans in,
    // swings wider and bounces. opts: waddle (amplitude), hop, look (head yaw), wave, cheer, armsFixed, pull (hauling a
    // loaded wagon: a shorter, heavier stride that never breaks into a run, leaning into it, a hand back on the handle)
    animate(dt, speed = 0, o = {}) {
      this.t += dt;
      const L = base.legY * root.scale.x, t = this.t, m = Math.min(1, speed * 2);
      // hauling: a long, deliberate walking stride (a wide swing, the reach of a lunge, no flight), so a 4.2 u/s haul
      // steps about as often as a family's stroll (~5 a second) and reads as a heavy walk, not a run or a shuffle
      const g = o.pull ? { A: 0.95, run: 0, rate: speed > 1e-3 ? (Math.PI * speed) / (2 * L * Math.sin(0.95) * 1.4) : 0 } : gait(speed, L);
      this.phase += dt * g.rate;
      const sw = Math.sin(this.phase) * m;
      legs[0].rotation.x = sw * g.A; legs[1].rotation.x = -sw * g.A;
      const arm = 0.6 + 0.5 * g.run;
      if (o.cheer) { arms[0].rotation.x = arms[1].rotation.x = -2.7 + Math.sin(t * 14) * 0.25; }
      else if (o.wave) { arms[0].rotation.x = -sw * arm; arms[1].rotation.x = -2.6; arms[1].rotation.z = 0.25 + Math.sin(t * 11) * 0.35; }
      else if (o.pull) { arms[0].rotation.x = -sw * 0.5; arms[1].rotation.x = 0.75; arms[1].rotation.z = 0.15; }
      else if (!o.armsFixed) { arms[0].rotation.x = -sw * arm; arms[1].rotation.x = sw * arm; arms[1].rotation.z = 0.25; }
      const hop = o.hop ? Math.abs(Math.sin(t * 9)) * 0.16 : 0;
      body.position.y = Math.abs(Math.sin(this.phase)) * (0.05 + 0.07 * g.run) * m + hop;
      legs[0].position.y = legs[1].position.y = base.legY + hop;
      body.rotation.x = o.pull ? 0.3 * m : 0.16 * g.run;
      body.rotation.z = Math.sin(this.phase) * (o.waddle ?? sp.waddle ?? 0.04) * m * (1 - 0.5 * g.run);
      head.rotation.y = o.look ?? Math.sin(t * 0.7 + this.phase * 0.05) * 0.3 * (1 - Math.min(1, speed));
      head.rotation.x = o.nod ? Math.sin(t * 8) * 0.15 : 0;
      tail.rotation.y = Math.sin(t * 2.1 + this.phase * 0.5) * 0.2;
      body.scale.y = 1 + Math.sin(t * 2.2) * 0.012 * (1 - m);
    },
    dispose() { root.parent?.remove(root); disposeTree(root); },
  };
  return rig;
}

// ---------------------------------------------------------------- the flumper (harbor seals)
// Not a biped: a long body (+z the nose) propped up on its front flippers with the head raised, hind flippers fanned out
// behind. Same bones and API as makeFolk (body, head, tail, legs = hind flippers, arms = front flippers), so
// accessories, portraits and the farmer's animations all work. It moves like a caterpillar: hunch (the back arches, the
// rear draws up), then lunge (the chest lifts and the body stretches forward onto the flippers), a flump a step.
// The body is dappled with the coat's spots, scattered over the ellipsoids by a fixed seed (every seal of a coat alike).
const FLUMP = {
  chest: [[0, 0.5, 0.14], [0.3, 0.36, 0.3], [-0.35, 0, 0]], neck: [[0, 0.8, 0.22], [0.23, 0.2, 0.22], [0, 0, 0]],
  torso: [[0, 0.3, -0.32], [0.33, 0.28, 0.5], [0.08, 0, 0]], rear: [[0, 0.19, -0.82], [0.2, 0.16, 0.32], [0.18, 0, 0]],
};
function makeFlumper(species, sp, opts, c) {
  const { kid = false, nested = false } = opts;
  const root = new THREE.Group(), body = new THREE.Bone(); root.add(body);
  root.name = species;
  const fur = c(sp.fur), belly = c(sp.belly ?? sp.fur), flip = c(sp.limb ?? sp.fur);
  for (const [p, sc, r] of Object.values(FLUMP)) part(ICO1, fur, p, sc, r, body);
  part(ICO1, belly, [0, 0.17, -0.12], [0.27, 0.14, 0.55], [0, 0, 0], body);
  part(ICO1, belly, [0, 0.42, 0.3], [0.2, 0.25, 0.14], [-0.35, 0, 0], body);
  const head = new THREE.Bone(); head.position.set(0, 1.02, 0.28); body.add(head);
  const skull = sp.skull;
  part(ICO1, c(sp.headC ?? sp.fur), [0, 0, 0], skull, [0, 0, 0], head);
  sp.face(head, c, sp);
  eyes(head, sp, c);
  // spots: on the body's upper half and the head's crown, never over the eyes
  if (sp.spots) {
    const r = rng(4242), spot = c(sp.spot), P = [FLUMP.chest, FLUMP.torso, FLUMP.torso, FLUMP.rear, FLUMP.neck];
    for (let i = 0; i < sp.spots; i++) {
      const [[cx, cy, cz], [rx, ry, rz]] = P[i % P.length], a = r.rand() * PI * 2, u = r.rand() * 0.95 - 0.25;
      const q = Math.sqrt(1 - u * u), k = 0.97, sz = (0.025 + r.rand() * 0.035) * (sp.spotS ?? 1);
      part(ICO0, spot, [cx + Math.cos(a) * q * rx * k, cy + u * ry * k, cz + Math.sin(a) * q * rz * k], [sz, sz * 0.7, sz], [r.rand(), r.rand(), 0], body);
    }
    for (let i = 0; i < Math.round(sp.spots / 8); i++) {
      const a = r.rand() * PI * 2, u = 0.35 + r.rand() * 0.6, q = Math.sqrt(1 - u * u), sz = 0.02 + r.rand() * 0.025;
      if (Math.sin(a) > 0.55 && u < 0.6) continue;                    // keep the face clear
      part(ICO0, spot, [Math.cos(a) * q * skull[0] * 0.97, u * skull[1] * 0.97, Math.sin(a) * q * skull[2] * 0.97], [sz, sz * 0.7, sz], [0, 0, 0], head);
    }
  }
  // front flippers (arms): planted forward of the chest; hind flippers (legs): fanned out behind, toes up a little
  const legs = [], arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Bone(); sh.position.set(sx * 0.25, 0.34, 0.22); sh.rotation.z = sx * 0.3; body.add(sh);
    part(ICO1, flip, [sx * 0.03, -0.16, 0.06], [0.06, 0.2, 0.12], [0.35, 0, 0], sh);
    arms.push(sh);
    const hip = new THREE.Bone(); hip.position.set(sx * 0.07, 0.15, -1.06); body.add(hip);
    part(ICO1, flip, [sx * 0.05, 0.02, -0.17], [0.1, 0.035, 0.2], [-0.25, sx * 0.4, 0], hip);
    legs.push(hip);
  }
  const tail = new THREE.Bone(); tail.position.set(0, 0.15, -1.05); body.add(tail);
  const f = { root, body, head, hips: legs, shoulders: arms, sp, top: skull[1] };
  for (const a of opts.accessories || []) {
    const [name, o] = Array.isArray(a) ? a : [a, {}];
    ACC[name]?.(f, o || {}, C);
  }
  const mesh = skinRig(root, [body, head, tail, ...legs, ...arms]);
  if (kid) head.scale.setScalar(1.18);
  root.scale.setScalar((opts.scale ?? (kid ? 0.55 : 1)) * (nested ? 1 : FOLK_SCALE));
  return {
    root, body, legs, arms, head, tail, mesh, species, kid, phase: R.rand() * 10, t: R.rand() * 10,
    // a flump every 0.6 model units walked (scaled): hunch then lunge; opts as makeFolk (wave lifts a front flipper,
    // cheer both, hop a little belly-bounce, pull leans into it, nod, look)
    animate(dt, speed = 0, o = {}) {
      this.t += dt;
      const t = this.t, m = Math.min(1, speed * 2), stride = 0.6 * root.scale.x;
      this.phase += speed > 1e-3 ? (dt * PI * speed) / stride : 0;
      const sw = Math.sin(this.phase) * m, lunge = Math.max(0, sw), hunch = Math.max(0, -sw);
      const hop = o.hop ? Math.abs(Math.sin(t * 9)) * 0.1 : 0;
      body.rotation.x = -lunge * 0.16 + hunch * 0.06 + (o.pull ? -0.12 * m : 0);
      body.position.y = lunge * 0.07 + hop;
      body.scale.set(1, 1 + hunch * 0.1, 1 - hunch * 0.1 + lunge * 0.04);
      body.position.z = hunch * 0.06;
      for (const [i, a] of arms.entries()) {
        a.rotation.x = -lunge * 0.7 + hunch * 0.25;
        a.rotation.z = (i ? 1 : -1) * -0.3;
      }
      if (o.cheer) { arms[0].rotation.x = arms[1].rotation.x = -1.6 + Math.sin(t * 14) * 0.3; }
      else if (o.wave) { arms[1].rotation.x = -1.5; arms[1].rotation.z = 0.5 + Math.sin(t * 11) * 0.4; }
      legs.forEach((l, i) => { l.rotation.x = hunch * 0.5 - lunge * 0.15; l.rotation.y = (i ? 1 : -1) * Math.sin(t * 1.4) * 0.12 * (1 - m); });
      head.rotation.x = lunge * 0.18 - hunch * 0.05 + (o.nod ? Math.sin(t * 8) * 0.15 : 0);
      head.rotation.y = o.look ?? Math.sin(t * 0.6 + this.phase * 0.05) * 0.35 * (1 - m);
      head.rotation.z = Math.sin(t * 0.9) * 0.06 * (1 - m);                      // the quizzical harbor-seal head tilt
    },
    dispose() { root.parent?.remove(root); disposeTree(root); },
  };
}

// The prototype's possum mom with two joeys riding on her back.
export function addJoeys(mom) {
  mom.joeys = [[-0.2, 0.5, -0.25, 0.35, 0.15], [0.21, 0.44, -0.27, -0.35, -0.15]].map(([x, y, z, ry, rz], i) => {
    const j = makeFolk('possum', { kid: true, scale: 0.5, nested: true });
    j.root.position.set(x, y, z); j.root.rotation.set(0.15, ry, rz);
    j.arms.forEach((a) => (a.rotation.x = -1.3));
    j.legs.forEach((l, k) => (l.rotation.x = -0.5 - k * 0.2));
    mom.body.add(j.root);
    j.base = y; j.i = i;
    return j;
  });
  const anim = mom.animate.bind(mom);
  mom.animate = (dt, speed, o) => {
    anim(dt, speed, o);
    for (const j of mom.joeys) {
      j.root.position.y = j.base + Math.abs(Math.sin(mom.phase + j.i * 1.3)) * 0.035;
      j.head.rotation.y = Math.sin(mom.t * 1.3 + j.i * 2) * 0.5;
      j.head.rotation.z = Math.sin(mom.t * 2.2 + j.i) * 0.12;
    }
  };
  return mom;
}

// A sea otter mom carries her one pup on her chest (SPEC: customer families), cradled in both arms, looking around.
export function addPup(mom) {
  const p = makeFolk('otter', { kid: true, scale: 0.46, nested: true });
  p.root.position.set(0, 0.42, 0.27); p.root.rotation.set(-0.35, 0, 0);
  p.arms.forEach((a) => (a.rotation.x = -1.6));
  p.legs.forEach((l) => (l.rotation.x = -1.2));
  mom.body.add(p.root);
  mom.pup = p;
  const anim = mom.animate.bind(mom);
  mom.animate = (dt, speed, o) => {
    anim(dt, speed, { ...o, armsFixed: true });
    for (const [i, a] of mom.arms.entries()) { a.rotation.x = -0.95; a.rotation.z = (i ? -1 : 1) * -0.55; }
    p.root.position.y = 0.42 + Math.abs(Math.sin(mom.phase)) * 0.02;
    p.head.rotation.y = Math.sin(mom.t * 1.1) * 0.45;
  };
  return mom;
}

// ---------------------------------------------------------------- townsfolk
// Portrait keys and their looks (design §11). Gran and the farmer take the player's species.
export const TOWNSFOLK = {
  farmer: (sp) => ({ species: sp, accessories: ['overalls', 'hat'] }),
  gran: (sp) => ({ species: sp, grey: 0.45, accessories: ['glasses', ['shawl', { color: 0x9d86b8 }]] }),
  moss: () => ({ species: 'possum', grey: 0.62, accessories: [['cap', { style: 'beanie', color: 0x6f8b5a }], ['shawl', { color: 0x7d9a6a, pin: 0xa8c6c0 }]] }),
  hal: () => ({ species: 'coyote', accessories: ['headphones', ['bandana', { color: 0xd9782d }]] }),
  mayor: () => ({ species: 'pelican', accessories: ['tophat', ['sash', { color: 0xb5543f }]] }),
  edna: () => ({ species: 'owl', accessories: ['visor', ['glasses', { color: 0xb8913a }]] }),
  sasha: () => ({ species: 'fox', accessories: [['apron', { color: 0x6f8b7b }]] }),
  vance: () => ({ species: 'beaver', grey: 0.3, accessories: ['flatcap', ['overalls', { color: 0x7a5f4a }]] }),
  dez: () => ({ species: 'raccoon', scale: 0.92, accessories: [['cap', { style: 'baseball', color: 0xb5543f, back: true }], ['apron', { color: 0x8fb9b1 }]] }),
  bea: () => ({ species: 'beaver', accessories: [['cap', { style: 'hard', color: 0xe5c66b }], ['bandana', { color: 0x6f8b7b }]] }),
  howie: () => ({ species: 'coyote', accessories: ['vest', ['cap', { style: 'baseball', color: 0x34445a }]] }),
  mavis: () => ({ species: 'possum', accessories: [['cap', { style: 'police', color: 0x34445a }], 'flashlight'] }),
  ladybug: () => ({ species: 'fox', accessories: [['hat', { color: 0xc4432f, band: 0x2d2a28, spots: true }]] }),
  vale: () => ({ species: 'fox', accessories: [['sash', { color: 0xd98aa0 }]] }),
  hoot: () => ({ species: 'owl', grey: 0.25, accessories: [['glasses', { color: 0xb8913a }], ['bandana', { color: 0x34445a }]] }),
  bigtom: () => ({ species: 'coyote', accessories: [['hat', { color: 0x7a5f4a, band: 0x3a302a }]] }),
  lindqvist: () => ({ species: 'skunk', accessories: [['shawl', { color: 0xa8c6c0 }], 'glasses'] }),
  possumMom: () => ({ species: 'possum' }),
};
export function makeTownsfolk(key, playerSpecies = 'possum') {
  const def = TOWNSFOLK[key]?.(playerSpecies) || { species: SPECIES[key] ? key : 'possum' };
  const f = makeFolk(def.species, def);
  f.key = key;
  return f;
}

// ---------------------------------------------------------------- the Weighmaster
// An elephant seal, twice everyone else's size, never impressed (from the prototype).
export function makeWeighmaster() {
  const root = new THREE.Group(), body = new THREE.Bone(); root.add(body);
  const fur = C(0x86776a), light = C(0xa59585), fold = C(0x74665a), flip = C(0x6b5f55), dark = C(0x26211e);
  const navy = C(0x34445a), gold = C(0xe5c66b), sashM = C(0xb5543f);
  part(ICO1, fur, [0, 0.7, -1.8], [1.0, 0.7, 1.4], [0.1, 0, 0], body);
  part(ICO1, fur, [0, 0.98, -0.55], [1.22, 0.98, 1.25], [0, 0, 0], body);
  part(ICO1, light, [0, 0.5, -0.45], [1.0, 0.45, 1.25], [0, 0, 0], body);
  for (const sx of [-1, 1]) part(ICO0, flip, [sx * 0.42, 0.16, -3.1], [0.45, 0.07, 0.58], [0, sx * 0.4, sx * 0.15], body);
  part(ICO1, C(0x7a6c60), [-0.82, 0.55, 0.62], [0.27, 0.6, 0.42], [0.3, 0, -0.3], body); // propping flipper
  const chest = new THREE.Bone(); chest.position.set(0, 0.95, 0.05); body.add(chest);
  part(ICO1, fur, [0, 0.95, 0.25], [1.02, 1.2, 0.92], [-0.32, 0, 0], chest);
  part(ICO1, C(0xb3968a), [0, 0.78, 0.66], [0.72, 0.85, 0.42], [-0.32, 0, 0], chest);
  for (let i = 0; i < 3; i++) part(ICO1, fold, [0, 1.62 + i * 0.16, 0.38 + i * 0.05], [0.8 - i * 0.07, 0.11, 0.7 - i * 0.06], [-0.3, 0, 0], chest);
  part(new THREE.TorusGeometry(1, 0.075, 4, 20).rotateX(PI / 2), sashM, [0, 0.95, 0.27], [1.03, 1, 0.95], [-0.32, 0, 0.62], chest);
  part(ICO1, gold, [0.38, 1.05, 1.0], [0.13, 0.13, 0.05], [-0.3, 0.25, 0], chest);
  part(ICO0, sashM, [0.38, 0.88, 1.0], [0.05, 0.12, 0.03], [0, 0, 0.3], chest);
  const head = new THREE.Bone(); head.position.set(0, 1.95, 0.5); chest.add(head);
  part(ICO1, fur, [0, 0, 0], [0.62, 0.55, 0.66], [0, 0, 0], head);
  part(ICO1, light, [0, -0.2, 0.48], [0.42, 0.3, 0.34], [0, 0, 0], head);
  part(BOX, dark, [0, -0.38, 0.66], [0.24, 0.025, 0.05], [0, 0, 0], head); // flat, unimpressed mouth
  for (const sx of [-1, 1]) {
    part(ICO0, dark, [sx * 0.3, 0.12, 0.52], [0.07, 0.07, 0.05], [0, 0, 0], head);
    part(ICO1, fur, [sx * 0.3, 0.19, 0.53], [0.13, 0.065, 0.09], [0.15, 0, sx * -0.28], head); // heavy lids
    for (let k = 0; k < 3; k++) part(CYL, C(0xe8e1d6), [sx * 0.62, -0.22 - k * 0.07, 0.62], [0.012, 0.52, 0.012], [0, sx * 0.25, sx * (PI / 2 - 0.12 + k * 0.14)], head);
  }
  part(CYL8, navy, [0.04, 0.56, -0.04], [0.27, 0.16, 0.27], [0, 0, 0.14], head);
  part(CYL8, gold, [0.04, 0.5, -0.04], [0.28, 0.045, 0.28], [0, 0, 0.14], head);
  part(CYL8, navy, [0.06, 0.47, 0.18], [0.27, 0.03, 0.2], [0.12, 0, 0.14], head);
  part(ICO0, gold, [0.07, 0.58, 0.24], [0.06, 0.06, 0.03], [0, 0, 0], head);
  const nose = new THREE.Bone(); nose.position.set(0, 0.06, 0.58); head.add(nose);
  taperTube([[0, 0, 0], [0, 0.08, 0.2], [0, -0.04, 0.38], [0, -0.28, 0.44], [0, -0.5, 0.37]], 0.21, 0.13, C(0x8c7b6f), nose);
  part(ICO0, dark, [0, -0.54, 0.35], [0.07, 0.05, 0.07], [0, 0, 0], nose);
  const arm = new THREE.Bone(); arm.position.set(0.88, 0.95, 0.45); chest.add(arm);
  part(ICO1, flip, [0.08, -0.25, 0.22], [0.22, 0.45, 0.34], [0.5, 0, 0.3], arm);
  const board = new THREE.Group(); board.position.set(0.16, -0.18, 0.62); board.rotation.set(-0.75, 0.55, 0); arm.add(board);
  part(BOX, C(0x8b6b4a), [0, 0, 0], [0.5, 0.66, 0.04], [0, 0, 0], board);
  part(BOX, C(0xf4efe4), [0, -0.03, 0.025], [0.42, 0.54, 0.01], [0, 0, 0], board);
  part(BOX, C(0x9aa1a5), [0, 0.31, 0.035], [0.18, 0.06, 0.04], [0, 0, 0], board);
  for (let k = 0; k < 4; k++) part(BOX, C(0x7d8a84), [-0.03, 0.14 - k * 0.1, 0.032], [0.3, 0.018, 0.005], [0, 0, 0], board);
  const mesh = skinRig(root, [body, chest, head, nose, arm]);
  let t0 = 0, hmph = 0;
  return {
    root, body, chest, head, nose, arm, mesh, kind: 'weighmaster',
    // idle: breathing, nose wiggle, an occasional slow look at the clipboard. hmph(): a toy reaction.
    update(dt) {
      const t = (t0 += dt);
      const br = Math.sin(t * 1.6);
      chest.scale.set(1 + br * 0.02, 1 + br * 0.03, 1 + br * 0.02);
      body.scale.y = 1 + br * 0.01;
      nose.rotation.x = Math.sin(t * 2.6) * 0.09 + Math.sin(t * 5.3) * 0.03 + (hmph > 0 ? Math.sin(hmph * 30) * 0.25 : 0);
      nose.rotation.z = Math.sin(t * 1.9) * 0.06;
      const g = (t % 9) / 9, w = THREE.MathUtils.smoothstep(g, 0.6, 0.68) * (1 - THREE.MathUtils.smoothstep(g, 0.86, 0.94));
      head.rotation.set(w * 0.4 - (hmph > 0 ? 0.15 * Math.sin(hmph * 5) : 0), w * 0.6 + Math.sin(t * 0.37) * 0.1 * (1 - w), 0);
      arm.rotation.x = -w * 0.25;
      hmph = Math.max(0, hmph - dt);
    },
    hmph() { hmph = 0.6; },
    dispose() { root.parent?.remove(root); disposeTree(root); },
  };
}

// ---------------------------------------------------------------- quadrupeds
// One builder for Biscuit (the farm dog) and Pamela (the neighbour's goat).
const QUADS = {
  biscuit: { fur: 0xd6a466, belly: 0xf3e6cf, ear: 0x8a5c38, nose: 0x2b2522, len: 0.4, legLen: 0.34, skull: [0.19, 0.18, 0.2], scale: 0.9, ears: 'flop', bandana: 0xb5543f },
  pamela: { fur: 0xeee8dc, belly: 0xe0d8c8, ear: 0xd9cfbf, nose: 0x8a7a72, hoof: 0x5a524a, len: 0.44, legLen: 0.46, skull: [0.17, 0.19, 0.22], scale: 1, ears: 'side', horns: 0xb8ab94, beard: 0xd9cfbf, goatEyes: true, bell: 0xe5c66b },
};
export function makeQuad(kind = 'biscuit') {
  const q = QUADS[kind] || QUADS.biscuit;
  const root = new THREE.Group(), body = new THREE.Bone(); root.add(body);
  const hipY = q.legLen + 0.06, legLen = q.legLen + 0.04, fur = C(q.fur);
  body.position.set(0, hipY, 0);
  part(ICO1, fur, [0, 0.06, 0], [0.22, 0.21, q.len], [0, 0, 0], body);
  part(ICO1, C(q.belly), [0, -0.01, q.len * 0.45], [0.16, 0.16, 0.2], [0, 0, 0], body);
  const legs = [];
  for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const hip = new THREE.Bone(); hip.position.set(sx * 0.12, -0.02, sz * q.len * 0.6); body.add(hip);
    part(CYL, fur, [0, -q.legLen / 2, 0], [0.062, q.legLen, 0.062], [0, 0, 0], hip);
    part(ICO0, C(q.hoof ?? q.belly), [0, -q.legLen - 0.02, 0.025], q.hoof ? [0.06, 0.05, 0.07] : [0.075, 0.05, 0.1], [0, 0, 0], hip);
    legs.push(hip);
  }
  const head = new THREE.Bone(); head.position.set(0, 0.24, q.len * 0.95); body.add(head);
  part(ICO1, fur, [0, -0.13, -0.12], [0.11, 0.17, 0.11], [0.5, 0, 0], head); // neck
  part(ICO1, fur, [0, 0, 0], q.skull, [0, 0, 0], head);
  if (kind === 'pamela') {
    part(ICO1, C(q.belly), [0, -0.09, 0.15], [0.1, 0.12, 0.17], [0.25, 0, 0], head);
    part(ICO0, C(q.nose), [0, -0.1, 0.31], [0.05, 0.035, 0.03], [0, 0, 0], head);
  } else {
    part(ICO1, C(q.belly), [0, -0.06, 0.17], [0.11, 0.09, 0.14], [0, 0, 0], head);
    part(ICO0, C(q.nose), [0, -0.02, 0.3], [0.05, 0.04, 0.04], [0, 0, 0], head);
    part(ICO0, C(0xd9828a), [0, -0.13, 0.25], [0.035, 0.015, 0.05], [0.3, 0, 0], head); // tongue
  }
  for (const sx of [-1, 1]) {
    if (q.goatEyes) {
      part(ICO1, C(0xd9a443), [sx * 0.1, 0.05, 0.15], [0.042, 0.042, 0.02], [0, sx * 0.5, 0], head);
      part(BOX, C(0x221f1d), [sx * 0.1, 0.05, 0.168], [0.045, 0.012, 0.01], [0, sx * 0.5, 0], head);
    } else {
      part(ICO0, C(0x221f1d), [sx * 0.09, 0.05, 0.16], [0.035, 0.042, 0.025], [0, 0, 0], head);
      part(ICO0, C(0xffffff), [sx * 0.09 + 0.012, 0.07, 0.18], [0.011, 0.011, 0.008], [0, 0, 0], head);
    }
    if (q.ears === 'flop') part(ICO1, C(q.ear), [sx * 0.16, 0.0, -0.03], [0.06, 0.14, 0.045], [0, 0, sx * 0.45], head);
    else part(ICO1, C(q.ear), [sx * 0.19, 0.04, -0.02], [0.12, 0.04, 0.06], [0, 0, sx * -0.2], head);
    if (q.horns) part(CONE, C(q.horns), [sx * 0.07, 0.2, -0.07], [0.035, 0.22, 0.035], [-0.75, 0, sx * -0.12], head);
  }
  if (q.beard) part(CONE, C(q.beard), [0, -0.2, 0.16], [0.04, 0.13, 0.04], [PI - 0.3, 0, 0], head);
  if (q.bell) part(ICO0, C(q.bell), [0, -0.24, 0.02], [0.04, 0.04, 0.04], [0, 0, 0], head);
  if (q.bandana) {
    part(new THREE.TorusGeometry(1, 0.08, 4, 14).rotateX(PI / 2), C(q.bandana), [0, -0.15, -0.08], [0.13, 1, 0.12], [0.5, 0, 0], head);
    part(CONE, C(q.bandana), [0, -0.21, 0.02], [0.1, 0.12, 0.04], [PI - 0.7, 0, 0], head);
  }
  const tail = new THREE.Bone(); tail.position.set(0, 0.1, -q.len * 0.95); body.add(tail);
  if (kind === 'pamela') part(CONE, fur, [0, 0.07, -0.02], [0.05, 0.14, 0.04], [-0.5, 0, 0], tail);
  else taperTube([[0, 0, 0], [0, 0.1, -0.1], [0, 0.24, -0.14], [0, 0.34, -0.1]], 0.05, 0.03, fur, tail);
  const mesh = skinRig(root, [body, head, tail, ...legs]);
  root.scale.setScalar(q.scale * FOLK_SCALE);
  let trick = null;
  return {
    root, body, legs, head, tail, mesh, kind, phase: 0, t: 0,
    // trot (diagonal pairs) at the ground speed (world units/s), stretching into a bounding run; tail wag.
    // o: { sit, happy, look, sniff }
    animate(dt, speed = 0, o = {}) {
      const t = (this.t += dt), m = Math.min(1, speed * 1.5), g = gait(speed, legLen * root.scale.x, 0.5, 0.9, 5, 10);
      this.phase += dt * g.rate;
      const sw = Math.sin(this.phase) * m, sit = (this.sit = lerp(this.sit || 0, o.sit && speed < 0.05 ? 1 : 0, Math.min(1, dt * 6)));
      legs[0].rotation.x = legs[3].rotation.x = sw * g.A;
      legs[1].rotation.x = legs[2].rotation.x = -sw * g.A;
      legs[2].rotation.x += sit * -1.3; legs[3].rotation.x += sit * -1.3;
      legs[0].rotation.x += sit * 0.25; legs[1].rotation.x += sit * 0.25;
      body.position.y = hipY + Math.abs(Math.sin(this.phase)) * (0.035 + 0.06 * g.run) * m - sit * 0.12;
      body.rotation.x = -sit * 0.45;
      head.rotation.x = sit * 0.4 + Math.sin(this.phase * 2) * 0.05 * m + (o.sniff ? 0.45 + Math.sin(t * 9) * 0.08 : 0);
      head.rotation.y = o.look ?? Math.sin(t * 0.6) * 0.35 * (1 - m);
      const wag = o.happy ? 0.7 : 0.25;
      tail.rotation.y = Math.sin(t * (o.happy ? 17 : 5)) * wag;
      body.rotation.z = 0;
      if (trick) {
        trick.t += dt;
        const k = Math.min(1, trick.t / trick.dur);
        if (trick.name === 'roll') { body.rotation.z = k * PI * 2; body.position.y -= Math.sin(k * PI) * 0.15; }
        if (trick.name === 'bark') { head.rotation.x = -Math.abs(Math.sin(k * PI * 3)) * 0.35; body.position.y += Math.abs(Math.sin(k * PI * 3)) * 0.04; }
        if (trick.name === 'hop') { body.position.y += Math.sin(k * PI) * 0.35; }
        if (k >= 1) trick = null;
      }
    },
    trick(name, dur = name === 'roll' ? 0.9 : 0.6) { trick = { name, t: 0, dur }; },
    dispose() { root.parent?.remove(root); disposeTree(root); },
  };
}

// ---------------------------------------------------------------- portraits
// folk.portrait(key) renders a head-and-shoulders portrait to a PNG data URL (transparent background)
// with a small offscreen renderer, cached per key. Keys: a species, a TOWNSFOLK key (gran, moss, hal,
// mayor, edna, sasha, vance, dez, bea, howie, mavis, ladybug, ...), 'farmer', 'weighmaster', 'biscuit',
// 'pamela'. opts.species sets the player's species for gran/farmer; opts.size the pixel size (192).
// The little renderer stays for the session: creating a WebGL context and forcing one lost each cost a visible
// hitch on phones (tens of ms), and it is only 192 px square. R.dispose() frees it (disposePortraits).
const cache = new Map();
let PR = null;
export function disposePortraits() { PR?.dispose(); }
function portraitRenderer(size) {
  if (PR && PR.size === size) return PR;
  PR?.dispose();
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(size, size, false);
  r.toneMapping = THREE.NeutralToneMapping; r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe3ecee, 0x8c8a6c, 1.45));
  const key = new THREE.DirectionalLight(0xfff4e2, 2.2); key.position.set(3, 5, 6); scene.add(key);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  PR = { r, scene, cam, size, dispose() { r.dispose(); r.forceContextLoss(); PR = null; } };
  return PR;
}
function buildFor(key, species) {
  if (key === 'weighmaster') return { rig: makeWeighmaster(), size: 2.6, dy: -0.2 };
  if (QUADS[key]) return { rig: makeQuad(key), size: 1.05, dy: -0.02 };
  const rig = SPECIES[key] ? makeFolk(key) : makeTownsfolk(key, species);
  // head a little above centre, with room for ears and hats inside the round crop the UI uses
  return { rig, size: 1.75 * (rig.root.scale.x / FOLK_SCALE), dy: -0.12 * (rig.root.scale.x / FOLK_SCALE) };
}
export function portrait(key, opts = {}) {
  const species = opts.species || 'possum', size = opts.size || 192;
  const ck = `${key}|${key === 'gran' || key === 'farmer' ? species : ''}|${size}`;
  if (cache.has(ck)) return cache.get(ck);
  const P = portraitRenderer(size);
  const { rig, size: frame, dy } = buildFor(key, species);
  rig.animate?.(0, 0, { look: 0 });
  rig.update?.(0);
  rig.root.rotation.y = -0.42;
  P.scene.add(rig.root);
  rig.root.updateMatrixWorld(true);
  const hp = rig.head.getWorldPosition(new THREE.Vector3()), look = hp.clone().add(new THREE.Vector3(0, dy, 0));
  const cam = P.cam;
  cam.left = cam.bottom = -frame / 2; cam.right = cam.top = frame / 2; cam.updateProjectionMatrix();
  cam.position.copy(look).add(new THREE.Vector3(0.1, 0.18, 1).normalize().multiplyScalar(20));
  cam.lookAt(look);
  P.r.render(P.scene, cam);
  const url = P.r.domElement.toDataURL('image/png');
  P.scene.remove(rig.root); rig.dispose();
  cache.set(ck, url);
  return url;
}

// ---------------------------------------------------------------- the crowd
// Families are drawn with merged, posed geometry per species (adult and kid: 20 InstancedMeshes),
// with the walk bob and waddle in the instance matrix and blob shadows instead of shadow casting.
// Possum adults carry their two joeys baked in (design §7: joeys ride on mom's back); sea otters their pup on the chest.
const crowdGeoCache = new Map();
export function crowdGeometry(species, kid = false, coat = 0) {
  const k = species + (coat ? `#${coat}` : '') + (kid ? ':kid' : '');
  if (crowdGeoCache.has(k)) return crowdGeoCache.get(k);
  const rig = makeFolk(species, { kid, coat });
  if (species === 'possum' && !kid) addJoeys(rig);
  if (species === 'otter' && !kid) addPup(rig);
  rig.animate(0, 0, { look: 0 });
  rig.root.updateMatrixWorld(true);
  const geos = [], v = new THREE.Vector3();
  rig.root.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    const src = o.geometry, n = src.attributes.position.count, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld); pos.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', src.attributes.color.clone());
    g.setAttribute('uv', src.attributes.uv.clone());
    g.computeVertexNormals();
    geos.push(g);
  });
  const geo = mergeGeometries(geos);
  geo.userData.shared = true;
  rig.dispose();
  crowdGeoCache.set(k, geo);
  return geo;
}
export function createCrowd(K, { adults = 24, kids = 48 } = {}) {
  const group = new THREE.Group(); group.name = 'crowd'; K.scene.add(group);
  const meshes = {}, counts = {};
  for (const sp of SPECIES_KEYS) for (let coat = 0; coat < (SPECIES[sp].coats?.length || 1); coat++) for (const kid of [false, true]) {
    const key = sp + (coat ? `#${coat}` : '') + (kid ? ':kid' : ''), im = new THREE.InstancedMesh(crowdGeometry(sp, kid, coat), VC, kid ? kids : adults);
    im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; im.count = 0; im.visible = false;
    meshes[key] = im; counts[key] = 0; group.add(im);
  }
  const blobGeo = new THREE.CircleGeometry(1, 12).rotateX(-PI / 2);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x2a2620, transparent: true, opacity: 0.2, depthWrite: false });
  blobMat.onBeforeCompile = fogPatch;   // Marlene's fog, not three's first-person depth fog (which washes them out from above)
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, adults + kids * 2);
  blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = 1; group.add(blobs);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  let nb = 0;
  return {
    group, meshes,
    begin() { for (const k in counts) counts[k] = 0; nb = 0; },
    // one family member. heading: radians (0 faces +z). phase: pi a step, advancing with the distance walked (the bob
    // and the side-to-side waddle keep time with the ground); with opts.hop each pi is a bounce instead. speed (u/s) sizes
    // the bob, so a figure standing still is still. A seal flumps instead (a hunch, then a lunge: pitch and stretch);
    // opts.coat picks her coat, opts.y sets the height outright (swimming), opts.noBlob drops the shadow.
    put(species, kid, x, z, heading = 0, phase = 0, speed = 0, opts = {}) {
      const key = species + (opts.coat ? `#${opts.coat}` : '') + (kid ? ':kid' : ''), im = meshes[key];
      if (!im || counts[key] >= im.instanceMatrix.count) return;
      const m = Math.min(1, speed * 2), b = Math.abs(Math.sin(phase)), k = opts.scale ?? 1, ground = K.world?.heightAt(x, z) ?? 0;
      const flump = SPECIES[species]?.flump;
      if (flump) {
        const sw = Math.sin(phase) * m, lunge = Math.max(0, sw), hunch = Math.max(0, -sw);
        const y = opts.y ?? ground + lunge * 0.06 + (opts.hop ? b * 0.1 : 0);
        e.set(-lunge * 0.14 + hunch * 0.05, heading, 0, 'YXZ');
        im.setMatrixAt(counts[key]++, m4.compose(p.set(x, y, z), q.setFromEuler(e), s.set(k, k * (1 + hunch * 0.1), k * (1 - hunch * 0.1 + lunge * 0.04))));
      } else {
        const y = opts.y ?? ground + (opts.hop ? b * 0.18 : b * (kid ? 0.08 : 0.06) * m);
        e.set(0, heading, Math.sin(phase) * (opts.waddle ?? SPECIES[species]?.waddle ?? 0.05) * m * (opts.hop ? 0.4 : 1), 'YXZ');
        im.setMatrixAt(counts[key]++, m4.compose(p.set(x, y, z), q.setFromEuler(e), s.setScalar(k)));
      }
      if (!opts.noBlob && nb < blobs.instanceMatrix.count) {
        const w = kid ? 0.26 : 0.42, back = flump ? (kid ? 0.25 : 0.45) : 0;   // a seal's shadow is long, under her body
        e.set(0, heading, 0);
        blobs.setMatrixAt(nb++, m4.compose(p.set(x - Math.sin(heading) * back, ground + 0.03, z - Math.cos(heading) * back), q.setFromEuler(e), s.set(w, 1, flump ? w * 2 : w)));
      }
      s.set(1, 1, 1);
    },
    end() {
      for (const k in meshes) { const im = meshes[k]; im.count = counts[k]; im.visible = counts[k] > 0; im.instanceMatrix.needsUpdate = true; }
      blobs.count = nb; blobs.visible = nb > 0; blobs.instanceMatrix.needsUpdate = true;
    },
    dispose() { K.scene.remove(group); blobGeo.dispose(); blobs.material.dispose(); for (const im of Object.values(meshes)) im.dispose(); },
  };
}
