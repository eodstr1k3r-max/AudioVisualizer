import {
  Fn, vec2, vec3, vec4, float, int, sin, cos, atan, length, normalize,
  mix, abs, mod, pow, smoothstep, step, floor, fract, exp, saturate,
  uv, Loop, If, min, max, glslFn
} from 'three/tsl';

export interface ShaderUniforms {
  // bewusst lose typisiert – TSL-Nodes mit Method-Chaining
  resolution: any;
  time: any;
  bass: any;
  mid: any;
  treble: any;
  energy: any;
  kick: any;
  /** Beat-Sync-Puls 0..1 (genau auf dem Beat = 1) */
  beat: any;
  /** Klick-Impuls 0..1 (Maus-Interaktion) */
  click: any;
  image: any;
  hasImage: any;
  opacity: any;
}

export type PresetBuilder = (u: ShaderUniforms) => any;

/** Vollbild-UV mit Seitenverhältnis-Korrektur: x in [-aspect, aspect], y in [-1, 1] */
function aspectUV(u: ShaderUniforms): any {
  const st: any = uv();
  return vec2(st.x.mul(u.resolution.x.div(u.resolution.y)), st.y) as any;
}

/* --------------------------- Hash / Noise (TSL) --------------------------- */

const hash2 = (p0: any): any => {
  const p = p0.mul(vec2(123.34, 456.21)).fract().toVar();
  p.addAssign(p.dot(p.add(vec2(45.32, 45.32))));
  return p.x.mul(p.y).fract();
};

const fractA = (x: any): any => fract(x) as any;
const floorA = (x: any): any => floor(x) as any;

const noise2 = (p0: any): any => {
  const i = (floorA(p0) as any).toVar();
  const f = (fractA(p0) as any).mul(fractA(p0)).mul(float(3).sub(float(2).mul(fractA(p0)))).toVar();
  const a = hash2(i);
  const b = hash2(i.add(vec2(1, 0)));
  const c = hash2(i.add(vec2(0, 1)));
  const d = hash2(i.add(vec2(1, 1)));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) as any;
};

const fbm5 = (p0: any): any => {
  const p = p0.toVar();
  const v = float(0).toVar();
  const amp = float(0.5).toVar();
  Loop({ start: int(0), end: int(5), type: 'int', condition: '<' }, () => {
    v.addAssign(amp.mul(noise2(p)));
    const x = p.x.mul(0.8).add(p.y.mul(0.6));
    const y = p.x.mul(-0.6).add(p.y.mul(0.8));
    p.assign(vec2(x, y).mul(2));
    amp.mulAssign(0.5);
  });
  return v;
};

/* ------------------------------- Presets ---------------------------------- */

const cybergrid: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.02, 0.03, 0.08).toVar();
  const ro = vec3(0, 1.5, u.time.mul(-2));
  const rd = normalize(vec3(st, -1));
  const t = float(0).sub(ro.y).div(rd.y);

  If(t.greaterThan(0), () => {
    const pos = ro.xz.add(rd.xz.mul(t));
    const grid = abs(fract(pos.sub(vec2(0.5, 0.5))).sub(vec2(0.5, 0.5))).div(float(0.04).add(abs(pos).mul(0.02)));
    const line = min(grid.x, grid.y);
    const lighting = float(1).sub(min(line, float(1)));
    const gridCol = mix(vec3(0.13, 0.82, 0.94), vec3(0.84, 0.26, 0.96), sin(pos.x.mul(0.1).add(u.time)));
    col.addAssign(gridCol.mul(lighting).mul(float(0.8).add(u.bass.mul(2.5))).div(t.mul(0.2).add(1)));
  });

  col.addAssign(vec3(0.94, 0.27, 0.57).mul(u.kick).mul(float(1.5).sub(length(st))));
  col.addAssign(vec3(1.0, 1.0, 1.0).mul(u.click.mul(0.55)));
  return vec4(col, 1);
})();

const plasma: PresetBuilder = (u) => Fn(() => {
  const p0: any = aspectUV(u);
  const col = vec3(0.01, 0.02, 0.06).toVar();
  const t = u.time.mul(0.4).toVar();
  const p = p0.toVar();
  const beatGlow: any = beatFlash(u, 0.18);

  Loop({ start: int(1), end: int(5), type: 'int', condition: '<' }, ({ i }) => {
    const fi = float(i);
    p.assign(vec2(
      p.x.add(sin(p.y.add(t).add(fi.mul(1.2))).mul(float(0.4).add(u.bass.mul(0.4)))),
      p.y.add(cos(p.x.add(t).add(fi.mul(1.2))).mul(float(0.4).add(u.treble.mul(0.4))))
    ));
  });

  const plasmaCol = vec3(
    sin(p.x.add(p.y).add(u.time)).mul(0.5).add(0.5),
    cos(p.x.mul(p.y).sub(u.time)).mul(0.5).add(0.5),
    sin(p.x.sub(p.y).add(u.kick.mul(3))).mul(0.5).add(0.5)
  );
  col.addAssign(plasmaCol.mul(float(0.6).add(u.energy.mul(0.8))));
  col.addAssign(vec3(0.9, 0.3, 0.7).mul(u.kick));
  col.addAssign(vec3(1.0, 0.5, 0.9).mul(beatGlow));
  return vec4(col, 1);
})();

const neonpulse: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.02, 0.02, 0.05).toVar();
  const angle = atan(st.y, st.x);
  const dist = length(st);
  const wave = sin(angle.mul(10).add(u.time.mul(3)).add(u.bass.mul(8))).mul(0.15);
  const circ = smoothstep(float(0.38).add(wave), float(0.4).add(wave), dist).oneMinus();
  col.addAssign(mix(col, vec3(0.13, 0.82, 0.94), circ.mul(float(1).add(u.energy))));
  col.addAssign(vec3(0.54, 0.36, 0.96).mul(u.bass.div(dist.mul(3).add(0.05))));
  col.addAssign(vec3(0.94, 0.27, 0.57).mul(u.kick).mul(float(1.4).sub(dist)));
  return vec4(col, 1);
})();

const hyperspace: PresetBuilder = (u) => Fn(() => {
  const p: any = aspectUV(u);
  const col = vec3(0.01, 0.02, 0.06).toVar();
  const d = length(p);
  const t = u.time.mul(float(3).add(u.bass.mul(10)));
  const a = atan(p.y, p.x);
  const stars = sin(a.mul(24).add(t)).mul(sin(d.mul(50).sub(t.mul(6))));
  const s = smoothstep(0.75, 1.0, stars).mul(float(1).sub(d));
  col.addAssign(vec3(0.13, 0.82, 0.94).mul(s).mul(float(1.2).add(u.energy.mul(4))));
  col.addAssign(vec3(0.94, 0.27, 0.57).mul(u.kick).mul(float(1.3).sub(d)));
  return vec4(col, 1);
})();

const kaleidoscope: PresetBuilder = (u) => Fn(() => {
  const p0: any = aspectUV(u);
  const a0 = atan(p0.y, p0.x);
  const r = length(p0);
  const segments = float(8).add(floor(u.bass.mul(6)));
  const a = abs(mod(a0, float(6.28318).div(segments)).sub(float(3.14159).div(segments)));
  const p: any = r.mul(vec2(cos(a), sin(a)));
  const uv2: any = p.mul(float(2.5).add(sin(u.time.mul(0.5)).mul(0.5)));
  const col: any = vec3(
    sin(uv2.x.add(u.time).add(u.bass)),
    cos(uv2.y.sub(u.time).add(u.treble)),
    sin(uv2.x.mul(uv2.y).add(u.kick))
  ).mul(float(0.6).add(u.energy.mul(0.7)));
  const outCol = col.toVar();
  outCol.r.addAssign(sin((uv() as any).y.mul(800).add(u.time)).mul(0.06));
  outCol.addAssign(vec3(0.94, 0.27, 0.57).mul(u.kick.mul(1.4)));
  return vec4(outCol, 1);
})();

const cybertunnel: PresetBuilder = (u) => Fn(() => {
  const p: any = aspectUV(u);
  const col = vec3(0.01, 0.02, 0.06).toVar();
  const r = length(p);
  const a = atan(p.y, p.x);
  const t = u.time.mul(float(4).add(u.bass.mul(5)));
  const rings = sin(float(1).div(r.add(0.04)).mul(5).sub(t).add(a.mul(4)));
  const neon = mix(vec3(0.13, 0.82, 0.94), vec3(0.94, 0.26, 0.64), sin(a.add(u.time)));
  col.addAssign(neon.mul(smoothstep(0.65, 1.0, abs(rings))).mul(float(0.8).add(u.energy.mul(2.5))).div(r.add(0.15)));
  col.addAssign(vec3(0.94, 0.27, 0.57).mul(u.kick).mul(float(1.6).sub(r)));
  col.addAssign(vec3(0.8, 0.9, 1.0).mul(beatFlash(u, 0.22)));
  return vec4(col, 1);
})();

const retrowave: PresetBuilder = (u) => Fn(() => {
  const p: any = aspectUV(u);
  const col = vec3(0.03, 0.01, 0.1).toVar();
  const sunPos = vec2(0, 0.25);
  const d = length(p.sub(sunPos));

  If(d.lessThan(0.4), () => {
    const stripes = step(0.22, sin(p.y.mul(24).sub(u.time.mul(3))));
    const sunCol = mix(vec3(1, 0.2, 0.1), vec3(1, 0.8, 0.1), p.y.add(0.5));
    col.assign(mix(col, sunCol.mul(float(1).add(u.bass.mul(0.8))), stripes));
  });

  If(p.y.lessThan(0), () => {
    const uv2 = p.toVar();
    uv2.assign(vec2(uv2.x, float(1).div(abs(uv2.y).add(0.08))));
    uv2.assign(vec2(uv2.x.mul(uv2.y), uv2.y));
    const grid: any = fract(uv2.add(vec2(0, u.time.mul(3))));
    const line = step(0.82, max(grid.x, grid.y));
    col.assign(mix(col, vec3(0.95, 0.1, 0.65), line.mul(float(0.6).add(u.energy.mul(1.5)))));
  });

  const scanline = sin((uv() as any).y.mul(1600)).mul(0.04);
  col.subAssign(scanline);
  col.addAssign(vec3(0.2, 0.8, 1.0).mul(u.kick.mul(1.2)));
  return vec4(col, 1);
})();

const audiocity: PresetBuilder = (u) => Fn(() => {
  const p: any = aspectUV(u);
  const col = vec3(0.02, 0.01, 0.07).toVar();
  const x = p.x.mul(12);
  const id = floor(x);
  const f = fract(x).sub(0.5);
  const height = sin(id.mul(3).add(u.time)).mul(0.5).add(0.5);
  const h2 = height.mul(float(0.4).add(u.bass.mul(2)).add(abs(sin(id)).mul(u.treble)));

  If(abs(f).lessThan(0.45).and(p.y.lessThan(h2.sub(0.25))), () => {
    const neon = mix(vec3(0.22, 0.78, 0.95), vec3(0.96, 0.26, 0.64), abs(p.x.mul(0.4)));
    col.assign(neon.mul(float(1).add(u.energy.mul(2.5)).add(p.y.mul(1.5))));
  });

  col.addAssign(vec3(0.94, 0.27, 0.57).mul(u.kick).mul(float(1.5).sub(length(p))));
  return vec4(col, 1);
})();

const wormhole3d: PresetBuilder = (u) => Fn(() => {
  const p: any = aspectUV(u);
  const col = vec3(0.01, 0.02, 0.05).toVar();
  const r = length(p);
  const a = atan(p.y, p.x);
  const t = u.time.mul(float(5).add(u.bass.mul(6)));
  const tunnel = sin(float(1).div(r.add(0.02)).mul(6).sub(t).add(a.mul(6)));
  const tone = mix(vec3(0.2, 0.8, 1.0), vec3(0.9, 0.3, 0.7), sin(a.add(u.time)));
  col.addAssign(tone.mul(smoothstep(0.6, 1.0, abs(tunnel))).mul(float(1.2).add(u.energy.mul(3.5))).div(r.add(0.1)));
  col.addAssign(vec3(0.94, 0.27, 0.57).mul(u.kick).mul(float(1.6).sub(r)));
  return vec4(col, 1);
})();

const matrix: PresetBuilder = (u) => Fn(() => {
  const st: any = uv().toVar();
  const col = vec3(0.01, 0.05, 0.02).toVar();
  st.assign(vec2(st.x, st.y.add(u.time.mul(float(0.3).add(u.bass.mul(0.8))))));
  const grid = floor(st.mul(vec2(50, 100)));
  const r = hash2(grid);
  const character = step(0.65, sin(r.mul(120).add(u.time.mul(6))));
  col.addAssign(vec3(0.1, 0.95, 0.3).mul(character).mul(float(0.4).add(u.energy.mul(0.8))));
  col.addAssign(vec3(0.9, 0.2, 0.6).mul(u.kick).mul(float(1.2).sub(length(st.sub(vec2(0.5, 0.5))))));
  return vec4(col, 1);
})();

const imagewarp: PresetBuilder = (u) => Fn(() => {
  const col = vec3(0.12, 0.22, 0.45).toVar();
  If(u.hasImage.equal(1), () => {
    const img = u.image as unknown as import('three/webgpu').TextureNode;
    const uvN = uv();
    const warpUV = uvN.add(sin(uvN.yx.mul(14).add(u.time.mul(2.5))).mul(u.bass.mul(0.03).add(u.kick.mul(0.06))));
    const texColor = img.sample(warpUV);
    const r = img.sample(warpUV.add(vec2(u.kick.mul(0.02), 0))).r;
    const b = img.sample(warpUV.sub(vec2(u.kick.mul(0.02), 0))).b;
    col.assign(vec3(r, texColor.g, b).mul(float(0.8).add(u.energy.mul(0.4))));
  });
  col.addAssign(vec3(0.94, 0.27, 0.57).mul(u.kick.mul(0.6)));
  return vec4(col, 1);
})();

const infinitegalaxies: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const r = length(st);
  const angle = atan(st.y, st.x);
  const col = vec3(0.005, 0.008, 0.02).toVar();

  const nebulaUv = st.mul(float(1.2).add(sin(u.time.mul(0.1)).mul(0.2)));
  const n1 = fbm5(nebulaUv.add(vec2(u.time.mul(0.08), u.time.mul(0.05))).add(u.bass.mul(0.2)));
  const n2 = fbm5(nebulaUv.mul(2).sub(vec2(u.time.mul(0.06), u.time.mul(0.09))).add(u.mid.mul(0.3)));

  col.addAssign(vec3(0.35, 0.08, 0.65).mul(n1).mul(float(0.8).add(u.bass.mul(1.5))));
  col.addAssign(vec3(0.05, 0.65, 0.85).mul(n2).mul(float(0.7).add(u.treble.mul(1.2))));
  col.addAssign(vec3(0.85, 0.65, 0.2).mul(pow(n1.mul(n2), 2)).mul(float(0.5).add(u.energy.mul(2))));

  const spiralAngle = angle.add(r.mul(float(3).add(u.bass.mul(4)))).sub(u.time.mul(float(0.4).add(u.energy.mul(0.5))));
  const spiralArms = pow(abs(sin(spiralAngle.mul(2))), 8).mul(exp(r.mul(-1.8)));
  const galaxyCore = mix(vec3(0.2, 0.7, 1.0), vec3(0.9, 0.4, 0.95), r);
  col.addAssign(galaxyCore.mul(spiralArms).mul(float(1.5).add(u.bass.mul(3))));

  const blackHoleRadius = float(0.22).add(u.bass.mul(0.08));
  const accretionDisk = smoothstep(blackHoleRadius, blackHoleRadius.add(0.12), r).oneMinus().sub(smoothstep(blackHoleRadius.sub(0.04), blackHoleRadius, r).oneMinus());
  col.addAssign(vec3(0.95, 0.4, 0.15).mul(accretionDisk).mul(float(2).add(u.kick.mul(4))));

  const supernovaWave = smoothstep(0.0, 0.05, abs(r.sub(fract(u.time.mul(0.8).add(u.kick.mul(0.2))).mul(2.5)))).oneMinus();
  col.addAssign(vec3(0.2, 0.8, 1.0).mul(supernovaWave).mul(u.kick.mul(2)));

  col.addAssign(vec3(0.8, 0.9, 1.0).mul(float(0.015).div(r.add(0.005))).mul(float(0.6).add(u.energy.mul(1.2))));
  col.mulAssign(smoothstep(0.4, 1.8, r).oneMinus());
  return vec4(col, 1);
})();

const aurora: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.005, 0.01, 0.03).toVar();
  const uv1: any = vec2(st.x.mul(1.6), st.y.mul(1.2).add(u.time.mul(0.06)));

  Loop({ start: int(0), end: int(4), type: 'int', condition: '<' }, ({ i }) => {
    const fi = float(i);
    const band: any = smoothstep(0.0, 0.35, abs(st.y.sub(-0.1).add(fi.mul(0.18)))).oneMinus();
    const warp: any = fbm5(uv1.add(fi.mul(1.7)).add(u.bass.mul(0.25)));
    const streak: any = pow(abs(sin(uv1.x.mul(1.5).add(warp.mul(4)).add(fi))), 14);
    const mixVal = fi.div(3.0);
    const bandCol = mix(vec3(0.1, 0.9, 0.5), vec3(0.35, 0.4, 1.0), mixVal);
    col.addAssign(bandCol.mul(streak).mul(band).mul(float(0.5).add(u.energy.mul(1.2))));
  });

  col.addAssign(vec3(1.0, 1.0, 1.0).mul(smoothstep(0.0, 0.4, abs(st.y.sub(0.15))).oneMinus()).mul(float(0.04).add(u.kick.mul(0.5))));
  return vec4(col, 1);
})();

const starfield: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.0, 0.0, 0.02).toVar();

  Loop({ start: int(0), end: int(3), type: 'int', condition: '<' }, ({ i }) => {
    const fi = float(i);
    const layer = st.mul(float(8).add(fi.mul(6)));
    const id = floor(layer);
    const f = fract(layer).sub(0.5);
    const r = hash2(id);
    const star = step(0.9, r).mul(smoothstep(0.0, 0.5, length(f)).oneMinus());
    const tw = sin(u.time.mul(3).add(r.mul(40))).mul(0.5).add(0.5);
    const depth = float(1).div(float(1).add(fi.mul(0.35)));
    col.addAssign(vec3(1.0, 1.0, 1.0).mul(star).mul(tw).mul(depth).mul(u.energy.add(0.4)));
  });

  col.addAssign(vec3(0.6, 0.2, 1.0).mul(u.kick.mul(0.4)));
  return vec4(col, 1);
})();

const nebula3d: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.01, 0.01, 0.04).toVar();
  const uvN: any = vec2(st.x.mul(0.9), st.y.add(u.time.mul(0.03)));

  Loop({ start: int(0), end: int(3), type: 'int', condition: '<' }, ({ i }) => {
    const fi = float(i);
    const scale = pow(2.0, fi);
    const n = fbm5(uvN.mul(scale).add(fi.mul(3.1)).add(u.bass.mul(0.3)));
    const bandCol = mix(vec3(0.2, 0.05, 0.5), vec3(0.05, 0.5, 0.9), fi.div(3));
    col.addAssign(bandCol.mul(n).mul(float(0.35).div(scale)).mul(float(1).add(u.energy.mul(1.5))));
  });

  const core = exp(length(st).mul(-3));
  col.addAssign(vec3(0.9, 0.7, 1.0).mul(core).mul(float(0.6).add(u.bass.mul(2.2))).add(vec3(1.0, 0.4, 0.7).mul(u.kick).mul(core)));
  col.mulAssign(smoothstep(0.3, 2.2, length(st)).oneMinus());
  return vec4(col, 1);
})();

const firevortex: PresetBuilder = (u) => Fn(() => {
  const p: any = aspectUV(u);
  const col = vec3(0.01, 0.01, 0.03).toVar();
  const r = length(p);
  const a = atan(p.y, p.x);
  const swirl = a.add(r.mul(6)).sub(u.time.mul(float(1.5).add(u.energy.mul(2.2)))).add(u.bass.mul(2));
  const flame = pow(smoothstep(float(0.0), float(1.0), sin(swirl.mul(3)).mul(0.5).add(0.5)), 3);
  const heat = exp(r.mul(-2.2));
  const fireCol = mix(vec3(0.2, 0.02, 0.6), vec3(1.0, 0.35, 0.05), flame);
  col.addAssign(fireCol.mul(heat).mul(float(0.8).add(u.bass.mul(2.5))));
  col.addAssign(vec3(1.0, 0.9, 0.5).mul(pow(flame, 6)).mul(heat).mul(float(0.5).add(u.energy.mul(2))));
  col.addAssign(vec3(1.0, 0.3, 0.1).mul(u.kick).mul(float(1.5).sub(r)));
  return vec4(col, 1);
})();

const galaxycore: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.0, 0.0, 0.02).toVar();
  const a = atan(st.y, st.x);
  const r = length(st);
  const dust = fbm5(vec2(a.div(6.28318).mul(3), r.mul(2)).add(u.time.mul(0.05)));
  const arms = pow(abs(sin(a.mul(3).add(r.mul(5)).sub(u.time.mul(float(0.3).add(u.energy.mul(0.4)))))), 6).mul(exp(r.mul(-1.5)));
  const core = exp(r.mul(-4));
  const galaxyCol = mix(vec3(0.4, 0.1, 0.8), vec3(0.1, 0.6, 1.0), sin(a).mul(0.5).add(0.5));
  col.addAssign(galaxyCol.mul(arms).mul(float(1.2).add(u.bass.mul(3))));
  col.addAssign(vec3(0.95, 0.75, 0.3).mul(core).mul(float(1.5).add(u.bass.mul(4)).add(u.kick.mul(3))));
  col.addAssign(vec3(0.5, 0.3, 1.0).mul(dust).mul(0.35));
  const shock = smoothstep(0.0, 0.06, abs(r.sub(fract(u.time.mul(0.5).add(u.kick.mul(0.3))).mul(2.2)))).oneMinus();
  col.addAssign(vec3(0.2, 0.9, 1.0).mul(shock).mul(u.kick.mul(2.5)));
  col.mulAssign(smoothstep(0.4, 2.0, r).oneMinus());
  return vec4(col, 1);
})();

const liquidmetal: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.01, 0.01, 0.02).toVar();
  const uvN = st.mul(2.2);
  const n1 = fbm5(uvN.add(u.time.mul(0.1).add(u.bass.mul(0.25))));
  const n2 = fbm5(uvN.mul(2).sub(u.time.mul(0.08)).add(n1.mul(1.5)));
  const flow = n1.add(n2.mul(0.6));
  const iridR = sin(flow.mul(8)).mul(0.5).add(0.5);
  const iridG = sin(flow.mul(8).add(2.1)).mul(0.5).add(0.5);
  const iridB = sin(flow.mul(8).add(4.2)).mul(0.5).add(0.5);
  const chrome = vec3(
    mix(float(0.1), float(0.7), iridR),
    mix(float(0.15), float(0.75), iridG),
    mix(float(0.35), float(0.9), iridB)
  );
  const highlight = pow(smoothstep(0.6, 1.0, n2), 3);
  col.addAssign(chrome.mul(float(0.7).add(u.energy.mul(0.9))));
  col.addAssign(vec3(1.0, 1.0, 1.0).mul(highlight).mul(float(0.4).add(u.treble.mul(1.5))));
  col.addAssign(vec3(0.3, 0.7, 1.0).mul(u.kick.mul(0.5)));
  return vec4(col, 1);
})();

const neonwaves: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.0, 0.01, 0.04).toVar();

  Loop({ start: int(0), end: int(4), type: 'int', condition: '<' }, ({ i }) => {
    const fi = float(i);
    const y = st.y.add(fi.mul(0.12)).sub(0.5);
    const w = sin(st.x.mul(4).add(fi).add(u.time.mul(float(1.5).add(u.mid.mul(2)))).add(u.bass.mul(4))).mul(0.08);
    const band = smoothstep(float(0.0), float(0.05), abs(y.sub(w))).oneMinus();
    const hue = mix(vec3(0.1, 0.9, 1.0), vec3(0.95, 0.3, 0.8), fi.div(3));
    col.addAssign(hue.mul(band).mul(float(0.8).add(u.energy.mul(1.4))));
  });

  col.addAssign(vec3(1.0, 1.0, 1.0).mul(u.kick.mul(0.6)));
  col.addAssign(vec3(0.2, 0.9, 1.0).mul(beatFlash(u, 0.3)));
  return vec4(col, 1);
})();

const campfire: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.0, 0.0, 0.015).toVar();

  const skyT = smoothstep(-0.2, 1.0, st.y);
  const skyCol = mix(vec3(0.05, 0.03, 0.1), vec3(0.005, 0.01, 0.04), skyT);
  col.addAssign(skyCol);

  const horizon = float(-0.05);
  Loop({ start: int(0), end: int(3), type: 'int', condition: '<' }, ({ i }) => {
    const fi = float(i);
    const layer = st.mul(float(10).add(fi.mul(9)));
    const id = floor(layer);
    const f = fract(layer).sub(0.5);
    const r = hash2(id);
    const star = step(0.92, r).mul(smoothstep(0.0, 0.5, length(f)).oneMinus());
    const tw = sin(u.time.mul(float(1.5).add(r.mul(2))).add(r.mul(60))).mul(0.5).add(0.5);
    const depth = float(1).div(float(1).add(fi.mul(0.4)));
    const aboveHorizon = smoothstep(horizon, horizon.add(0.05), st.y);
    col.addAssign(vec3(1.0, 0.97, 0.9).mul(star).mul(tw).mul(depth).mul(aboveHorizon).mul(float(0.6).add(u.treble.mul(0.8))));
  });

  const moonPos = vec2(0.75, 0.55);
  const moonDist = length(st.sub(moonPos));
  col.addAssign(vec3(0.85, 0.88, 0.95).mul(smoothstep(0.09, 0.0, moonDist)));
  col.addAssign(vec3(0.4, 0.45, 0.6).mul(smoothstep(0.35, 0.0, moonDist)).mul(0.15));

  const groundLine = float(-0.35);
  const ground = smoothstep(groundLine.sub(0.02), groundLine, st.y).oneMinus();
  col.assign(mix(col, vec3(0.03, 0.015, 0.01), ground.mul(smoothstep(groundLine.sub(0.5), groundLine, st.y))));

  const fp: any = vec2(st.x, st.y.sub(groundLine).mul(1.6)).toVar();
  const flicker = u.bass.mul(0.5).add(u.energy.mul(0.3));
  const swirl = fp.x.add(sin(fp.y.mul(6).add(u.time.mul(5)).add(fp.x.mul(3))).mul(0.05).mul(float(1).add(flicker)));
  const flameShape = length(vec2(swirl.mul(float(3.2).sub(flicker)), fp.y.mul(1.6).sub(0.28)));
  const flameNoise = fbm5(vec2(fp.x.mul(4), fp.y.mul(3).sub(u.time.mul(3.2))).add(u.bass.mul(1.5)));
  const flame = smoothstep(float(0.55).add(flameNoise.mul(0.25)), float(0.0), flameShape).mul(step(0.0, fp.y)).mul(smoothstep(1.05, 0.0, fp.y));
  const flameCol = mix(vec3(0.6, 0.05, 0.0), mix(vec3(1.0, 0.35, 0.02), vec3(1.0, 0.9, 0.4), smoothstep(0.15, 0.65, fp.y)), smoothstep(0.0, 0.5, fp.y));
  col.addAssign(flameCol.mul(flame).mul(float(1.2).add(u.bass.mul(2.5)).add(u.kick.mul(1.5))));

  const sparkUv: any = vec2(fp.x.mul(5), fp.y.sub(u.time.mul(1.6)).mul(2.5));
  const sparkId = floor(sparkUv);
  const sparkF = fract(sparkUv).sub(0.5);
  const sparkR = hash2(sparkId);
  const spark = step(0.94, sparkR).mul(smoothstep(0.0, 0.5, length(sparkF)).oneMinus());
  const sparkFade = smoothstep(1.6, 0.0, fp.y).mul(smoothstep(0.0, 0.3, fp.y));
  col.addAssign(vec3(1.0, 0.6, 0.15).mul(spark).mul(sparkFade).mul(float(0.5).add(u.treble.mul(1.5))));

  const emberGlow = exp(length(vec2(fp.x.mul(1.4), max(fp.y, float(0)))).mul(-4));
  col.addAssign(vec3(1.0, 0.35, 0.05).mul(emberGlow).mul(float(0.8).add(u.bass.mul(2)).add(u.kick.mul(2))));

  const warmGlow = exp(length(st.sub(vec2(0, groundLine))).mul(-1.3));
  col.addAssign(vec3(1.0, 0.45, 0.15).mul(warmGlow).mul(float(0.25).add(u.energy.mul(0.5))));

  return vec4(col, 1);
})();

const energygrid: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.0, 0.02, 0.06).toVar();
  const gridUV = st.mul(6);
  const id: any = floor(gridUV);
  const f: any = fract(gridUV).sub(0.5);
  const pulse = sin(id.x.mul(id.y).add(u.time.mul(2))).mul(0.5).add(0.5);
  const cell = step(0.28, length(f)).mul(0.25);
  const energy = saturate(pulse.mul(u.energy).add(u.kick.mul(0.8)));
  col.addAssign(vec3(0.1, 0.8, 1.0).mul(cell).mul(float(0.4).add(energy.mul(1.6))));
  col.addAssign(vec3(1.0, 0.3, 0.8).mul(u.kick).mul(smoothstep(0.2, 1.2, length(st)).oneMinus()));
  col.addAssign(vec3(0.6, 0.95, 1.0).mul(beatFlash(u, 0.28)));
  return vec4(col, 1);
})();

/* --------------------- v5 Presets --------------------- */

const supernova: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.01, 0.01, 0.03).toVar();
  const dist = length(st);
  const ang = atan(st.y, st.x);

  // Expandierende Schockwellen-Schalen: jeder Kick startet eine neue Front
  const waveT: any = fract(u.time.mul(0.45)).toVar();
  const front = float(0.12).add(waveT.mul(float(1.15).add(u.bass.mul(0.5))));
  const shell = exp(dist.sub(front).abs().mul(-14)).mul(waveT.oneMinus());
  const shellCol = mix(vec3(0.35, 0.55, 1.0), vec3(1.0, 0.5, 0.85), waveT);
  col.addAssign(shellCol.mul(shell).mul(float(0.7).add(u.energy.mul(1.4))));

  // Sekundär-Front mit Phasenversatz
  const wave2 = fract(u.time.mul(0.45).add(0.5));
  const front2 = float(0.12).add(wave2.mul(float(1.15).add(u.bass.mul(0.5))));
  const shell2 = exp(dist.sub(front2).abs().mul(-16)).mul(wave2.oneMinus());
  col.addAssign(vec3(0.2, 0.9, 1.0).mul(shell2).mul(float(0.4).add(u.mid)));

  // Funken-Kranz: strahlenförmige Flares, drehen mit der Zeit
  const rays = sin(ang.mul(18).add(u.time.mul(0.7))).mul(0.5).add(0.5);
  const rayMask = pow(rays, 3).mul(smoothstep(0.15, 0.75, dist)).mul(smoothstep(1.25, 0.55, dist));
  col.addAssign(mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.65, 0.3), sin(ang.mul(3).sub(u.time.mul(0.4))).mul(0.5).add(0.5))
    .mul(rayMask).mul(float(0.35).add(u.treble.mul(1.6))));

  // Heißer Kern mit Kick-Flash
  const core = exp(dist.mul(-7)).mul(float(1.1).add(u.bass.mul(2.2)).add(u.kick.mul(2.5)));
  col.addAssign(vec3(1.0, 0.92, 0.78).mul(core));
  col.addAssign(vec3(1.0, 1.0, 1.0).mul(beatFlash(u, 0.22)));
  return vec4(col, 1);
})();

const deepocean: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.0, 0.015, 0.04).toVar();

  // Tiefen-Gradient: dunkle Tiefe → helles Licht von oben
  const depthFade = smoothstep(float(-1.0), float(1.0), st.y);
  col.assign(mix(vec3(0.0, 0.02, 0.05), vec3(0.02, 0.14, 0.22), depthFade));

  // Caustics: zwei verzerrte Noise-Schichten wandern gegeneinander
  const swell = u.bass.mul(0.6).add(0.2);
  const c1 = fbm5(st.mul(3.2).add(vec2(u.time.mul(0.22), u.time.mul(-0.13))).add(swell));
  const c2 = fbm5(st.mul(5.1).add(vec2(u.time.mul(-0.17), u.time.mul(0.26))));
  const caustic = pow(min(c1, c2), 2).mul(3.2);
  col.addAssign(vec3(0.25, 0.85, 0.9).mul(caustic).mul(depthFade).mul(float(0.35).add(u.energy.mul(1.1))));

  // Godrays: schräge Lichtbänder von oben, tanzen mit Mid
  const rayAngle = st.x.mul(1.4).add(st.y.mul(0.5)).add(sin(u.time.mul(0.4)).mul(0.3));
  const rays = sin(rayAngle.mul(9).add(u.time.mul(0.8))).mul(0.5).add(0.5);
  const rayMask = smoothstep(float(-0.2), float(1.1), st.y).mul(pow(rays, 2.4));
  col.addAssign(vec3(0.5, 0.95, 1.0).mul(rayMask).mul(float(0.12).add(u.mid.mul(0.5))));

  // Blasen steigen auf; Kick erzeugt eine Blasen-Welle
  const bub: any = vec2(st.x.mul(7), st.y.mul(3.5).sub(u.time.mul(float(0.5).add(hash2(floor(vec2(st.x.mul(7), 0))).mul(1.2))))).toVar();
  const bubble = step(0.93, hash2(floor(bub)))
    .mul(smoothstep(0.0, 0.28, length(fract(bub).sub(0.5))).oneMinus())
    .mul(step(0.0, st.y));
  col.addAssign(vec3(0.8, 1.0, 1.0).mul(bubble).mul(float(0.25).add(u.treble.mul(1.1)).add(u.kick.mul(0.8))));

  col.addAssign(vec3(0.4, 0.95, 1.0).mul(beatFlash(u, 0.14)));
  return vec4(col, 1);
})();

const crystalshards: PresetBuilder = (u) => {
  return Fn(() => {
    const stRaw: any = aspectUV(u);
    const col = vec3(0.01, 0.02, 0.05).toVar();
    const zoom = u.time.mul(0.06);
    const rot = u.time.mul(0.1).add(u.energy.mul(0.4));

    // Kaleido-Faltung in 8 Segmente
    const s0 = stRaw.sub(vec2(zoom.sin().mul(0.1), zoom.cos().mul(0.08)));
    const a = atan(s0.y, s0.x).add(rot);
    const r = length(s0);
    const seg = Math.PI / 4;
    const af = mod(a, seg).sub(seg / 2);
    const folded: any = vec2(af.cos(), af.sin()).mul(r).toVar();

    // Facetten: harte Kanten im gefalteten Raum
    const facetN = fbm5(folded.mul(4.5));
    const facets = floor(facetN.mul(6));
    const edgeDist = length(fract(folded.mul(3.5).add(facets.mul(0.37))).sub(0.5));
    const edge = smoothstep(0.32, 0.02, edgeDist).mul(exp(r.mul(-1.1)).add(0.25));

    // Glasfarbe über Brechungs-artigen Kanalversatz, Kick verstärkt den Versatz
    const shift = u.kick.mul(0.12).add(0.03);
    const rr = hash2(folded.mul(40).floor().add(facets)).add(shift);
    const gg = hash2(folded.mul(41).floor().add(facets));
    const bb = hash2(folded.mul(42).floor().add(facets)).sub(shift);
    const facetCol = vec3(rr, gg, bb).mul(0.7).add(vec3(0.15, 0.3, 0.55));

    col.addAssign(facetCol.mul(edge).mul(float(0.5).add(u.bass.mul(1.6))));

    // Innerer Glanz + Reflexions-Blitz auf dem Beat
    const innerGlow = exp(r.mul(-3.4)).mul(float(0.5).add(u.energy.mul(0.9)));
    col.addAssign(mix(vec3(0.4, 0.75, 1.0), vec3(0.9, 0.5, 1.0), sin(rot).mul(0.5).add(0.5)).mul(innerGlow));
    col.addAssign(vec3(0.9, 0.97, 1.0).mul(beatFlash(u, 0.2)).mul(smoothstep(1.1, 0.1, r)));
    return vec4(col, 1);
  })();
};

const electricstorm: PresetBuilder = (u) => Fn(() => {
  const st: any = aspectUV(u);
  const col = vec3(0.01, 0.012, 0.03).toVar();

  // Gewitterhimmel: wabernde Dunkelwolken
  const clouds = fbm5(st.mul(2.4).add(vec2(u.time.mul(0.07), 0)));
  col.assign(mix(vec3(0.008, 0.01, 0.024), vec3(0.05, 0.055, 0.09), clouds.mul(0.9)));

  // Blitz-Bögen: noise-gesteuerte Verästelungen, flackern mit Kick/Treble
  const boltSeed = floor(u.time.mul(2.2));
  const jitter = u.treble.mul(1.4);
  for (let k = 0; k < 2; k++) {
    const fi = float(k * 2.7);
    const pathX = mix(float(-0.9), float(0.9), hash2(vec2(boltSeed.add(fi), fi)))
      .add(sin(st.y.mul(float(9).add(fi))).mul(0.16))
      .add(sin(st.y.mul(23).add(boltSeed.mul(7))).mul(0.05).mul(float(1).add(jitter)));
    const branch = sin(st.y.mul(17).add(boltSeed.mul(3).add(fi))).mul(0.06).mul(step(0.55, hash2(vec2(boltSeed, st.y.floor()))));
    const boltDist = abs(st.x.sub(pathX.add(branch)));
    const flicker = step(0.35, hash2(vec2(boltSeed, fi))).mul(u.energy.add(u.kick.mul(1.6)));
    const bolt = smoothstep(float(0.028).add(jitter.mul(0.01)), 0.0, boltDist).mul(flicker)
      .mul(smoothstep(float(-0.2), float(0.5), st.y).mul(smoothstep(float(1.2), float(0.2), st.y)));
    col.addAssign(mix(vec3(0.55, 0.75, 1.0), vec3(1.0), smoothstep(0.03, 0.0, boltDist)).mul(bolt).mul(2.1));
    // Aufhellung des Himmels um jeden Blitz
    col.addAssign(vec3(0.2, 0.32, 0.6).mul(exp(boltDist.mul(-4))).mul(flicker).mul(0.35));
  }

  // Boden-Silhouette unten
  const groundLine = float(-0.62);
  const cityNoise = fbm5(vec2(st.x.mul(2.2), 0)).mul(0.22);
  const skyline = smoothstep(groundLine.add(cityNoise).sub(0.015), groundLine.add(cityNoise), st.y).oneMinus();
  col.assign(mix(col, vec3(0.004, 0.006, 0.012), skyline));

  // Regen-Streifen
  const rain: any = vec2(st.x.mul(30).add(u.time.mul(3)), st.y.mul(22).sub(u.time.mul(11))).toVar();
  const drop = step(0.985, hash2(floor(rain))) .mul(0.5);
  col.addAssign(vec3(0.4, 0.55, 0.8).mul(drop).mul(0.35));

  col.addAssign(vec3(0.7, 0.85, 1.0).mul(beatFlash(u, 0.16)));
  return vec4(col, 1);
})();

/* ------------------------------- Registry -------------------------------- */

export interface ShaderPreset {
  name: string;
  build: PresetBuilder;
}

export const shaderPresets: Record<string, ShaderPreset> = {
  cybergrid: { name: '🌌 Cyber Grid (3D Floor)', build: cybergrid },
  plasma: { name: '🌌 Fluid Plasma Energy', build: plasma },
  neonpulse: { name: '🌌 Neon Volumetric Pulse', build: neonpulse },
  hyperspace: { name: '🌌 Hyperspace Warp', build: hyperspace },
  kaleidoscope: { name: '🌌 Audio Kaleidoscope', build: kaleidoscope },
  cybertunnel: { name: '🌌 Cyberpunk Tunnel', build: cybertunnel },
  retrowave: { name: '🌌 Synthwave Sun & Grid', build: retrowave },
  audiocity: { name: '🌌 Cyber Audio City', build: audiocity },
  wormhole3d: { name: '🌌 3D Audio Wormhole', build: wormhole3d },
  matrix: { name: '🌌 Digital Matrix Rain', build: matrix },
  imagewarp: { name: '🌌 Cinematic Image Warp', build: imagewarp },
  infinitegalaxies: { name: '🌌 Infinite Galaxies', build: infinitegalaxies },
  aurora: { name: '🌌 Aurora Borealis', build: aurora },
  starfield: { name: '🌌 Starfield Warp', build: starfield },
  nebula3d: { name: '🌌 Volumetric Nebula', build: nebula3d },
  energygrid: { name: '🌌 Energy Grid Pulse', build: energygrid },
  firevortex: { name: '🔥 Fire Vortex', build: firevortex },
  galaxycore: { name: '🌌 Galaxy Core', build: galaxycore },
  liquidmetal: { name: '💧 Liquid Metal', build: liquidmetal },
  neonwaves: { name: '〰️ Neon Waves', build: neonwaves },
  campfire: { name: '🔥 Lagerfeuer bei Nacht', build: campfire },
  supernova: { name: '💥 Supernova Shockwaves', build: supernova },
  deepocean: { name: '🌊 Deep Ocean Caustics', build: deepocean },
  crystalshards: { name: '💎 Crystal Shards', build: crystalshards },
  electricstorm: { name: '⛈️ Electric Storm', build: electricstorm }
};

export const CUSTOM_GLSL_HEADER =
  'vec4 mainImage(vec2 uv, float u_time, float u_bass, float u_mid, float u_treble, float u_energy, float u_kick, vec2 u_resolution)';

/**
 * Baut aus benutzerdefiniertem GLSL (Format: vec4 mainImage(vec2 uv, float u_time, ...))
 * einen TSL-Preset-Builder. Fehler werden beim Aufruf geworfen und im Shader-Studio angezeigt.
 */
export function buildCustomGlsl(code: string): PresetBuilder {
  const fn = glslFn(code);
  return (u: ShaderUniforms): any => {
    return fn(uv(), u.time, u.bass, u.mid, u.treble, u.energy, u.kick, u.resolution);
  };
}

/**
 * Nutzt den Beat-Puls in einem Preset: Blitz-Intensität (0..1) auf dem Beat.
 * ```ts
 * const flash = beatFlash(u, 0.5); // 0.5 = Stärke
 * ```
 */
export function beatFlash(u: ShaderUniforms, strength = 0.4): any {
  const beat: any = u.beat;
  return beat ? beat.mul(strength) : 0;
}
