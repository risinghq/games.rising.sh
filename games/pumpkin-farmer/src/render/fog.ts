// Marlene, the custom fog (ported from aesthetics/prototype-1.html).
// Radial fog that swallows the tile edges, a drifting ground mist and a fade-out below the tile,
// plus ordinary depth fog in first person. Every material made by kit.M() gets this patch, so one
// set of uniforms drives the whole diorama. uFogAmt is literally the sim's daily fog value f
// (design §5): the gameplay number *is* the rendered fog.
import * as THREE from 'three';

export const fogU = {
  uFogTime: { value: 0 }, uFogAmt: { value: 0.35 },
  uFogR0: { value: 24 }, uFogR1: { value: 38 }, uFogFP: { value: 0 },
};

export function fogPatch(shader: THREE.WebGLProgramParametersWithUniforms) {
  Object.assign(shader.uniforms, fogU);
  shader.vertexShader = shader.vertexShader
    .replace('#include <fog_pars_vertex>', '#ifdef USE_FOG\nvarying float vFogDepth;\nvarying vec3 vFogWorld;\n#endif')
    .replace('#include <fog_vertex>', `#ifdef USE_FOG
      vec4 fogWP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fogWP = instanceMatrix * fogWP;
      #endif
      fogWP = modelMatrix * fogWP;
      vFogWorld = fogWP.xyz;
      vFogDepth = -mvPosition.z;
    #endif`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <fog_pars_fragment>', `#ifdef USE_FOG
      uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;
      uniform float uFogTime, uFogAmt, uFogR0, uFogR1, uFogFP;
      varying float vFogDepth; varying vec3 vFogWorld;
      float fH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float fN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(fH(i), fH(i + vec2(1, 0)), f.x), mix(fH(i + vec2(0, 1)), fH(i + vec2(1, 1)), f.x), f.y); }
    #endif`)
    .replace('#include <fog_fragment>', `#ifdef USE_FOG
      vec2 fq = vFogWorld.xz * 0.11 + vec2(uFogTime * 0.045, uFogTime * 0.025);
      float n = fN(fq) * 0.65 + fN(fq * 2.3 + 4.0) * 0.35;
      float r = length(vFogWorld.xz) + (n - 0.5) * 8.0;
      float edge = smoothstep(uFogR0, uFogR1, r);
      float under = smoothstep(-2.6, -8.0, vFogWorld.y) * (1.0 - uFogFP);
      float mist = uFogAmt * (1.0 - smoothstep(0.0, 0.8 + 4.5 * uFogAmt, vFogWorld.y)) * smoothstep(0.3, 0.8, n) * 0.9;
      float depthF = smoothstep(fogNear, fogFar, vFogDepth) * uFogFP;
      // Route 46's mouth: Marlene never quite lets go of the road where it leaves the tile, so on a clear heat-wave day
      // the line of cars waiting to come in still fades into her past the cliff (x < -20.5) instead of hanging in the air
      float mouth = smoothstep(-20.5, -27.0, vFogWorld.x) * (1.0 - smoothstep(2.0, 3.5, abs(vFogWorld.z + 4.2))) * (1.0 - uFogFP);
      float fogFactor = clamp(max(max(max(edge, under), max(mist, depthF)), mouth), 0.0, 1.0);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
    #endif`);
}

// The prototype's setFog(): one number moves the swallowing radius, the mist and first-person depth fog.
export function applyFog(scene: THREE.Scene, a: number) {
  const amt = THREE.MathUtils.clamp(a, 0, 1), lerp = THREE.MathUtils.lerp;
  fogU.uFogAmt.value = amt;
  fogU.uFogR0.value = lerp(27, 7, amt);
  fogU.uFogR1.value = fogU.uFogR0.value + lerp(14, 20, amt);
  if (scene.fog instanceof THREE.Fog) { scene.fog.near = lerp(30, 1.5, amt); scene.fog.far = lerp(120, 26, amt); }
  return amt;
}
