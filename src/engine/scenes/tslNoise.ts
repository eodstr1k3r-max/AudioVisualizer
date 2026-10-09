import * as THREE from 'three';
import { Fn, vec3, float, int, sin, dot, mix, floor, fract, Loop } from 'three/tsl';

/* ============================================================================
 * Prozedurales 3D-Noise (TSL) – von SolarSystemScene, EclipseScene und
 * SpaceEclipseScene gemeinsam genutzt. Wertrauschen mit trilinearer
 * Interpolation über ein Gitter aus 8 Eckpunkten, daher nahtlos auf der
 * gesamten Kugeloberfläche (kein Pol-/UV-Seam) – ganz ohne Texturdateien.
 * ========================================================================== */

export const hash3 = (p: any): any =>
  fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))).mul(43758.5453123));

const floor3 = (x: any): any => floor(x) as any;
const fract3 = (x: any): any => fract(x) as any;

export const noise3 = (p0: any): any => {
  const i = (floor3(p0) as any).toVar();
  const f: any = (fract3(p0) as any).toVar();
  const sm: any = f.mul(f).mul(float(3).sub(f.mul(2))).toVar();
  const c000 = hash3(i.add(vec3(0, 0, 0)));
  const c100 = hash3(i.add(vec3(1, 0, 0)));
  const c010 = hash3(i.add(vec3(0, 1, 0)));
  const c110 = hash3(i.add(vec3(1, 1, 0)));
  const c001 = hash3(i.add(vec3(0, 0, 1)));
  const c101 = hash3(i.add(vec3(1, 0, 1)));
  const c011 = hash3(i.add(vec3(0, 1, 1)));
  const c111 = hash3(i.add(vec3(1, 1, 1)));
  const x00 = mix(c000, c100, sm.x);
  const x10 = mix(c010, c110, sm.x);
  const x01 = mix(c001, c101, sm.x);
  const x11 = mix(c011, c111, sm.x);
  const y0 = mix(x00, x10, sm.y);
  const y1 = mix(x01, x11, sm.y);
  return mix(y0, y1, sm.z);
};

export const fbm3 = (p0: any, octaves = 4): any => {
  const p = p0.toVar();
  const v = float(0).toVar();
  const amp = float(0.5).toVar();
  Loop({ start: int(0), end: int(octaves), type: 'int', condition: '<' }, () => {
    v.addAssign(amp.mul(noise3(p)));
    p.mulAssign(2.02);
    amp.mulAssign(0.5);
  });
  return v;
};

/** Erzeugt ein Sternenfeld-Punktwolken-BufferGeometry-Attribut (Float32Array), gleichmäßig auf einer Kugelschale verteilt. */
export function generateStarSphere(count: number, innerRadius: number, spread: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = innerRadius + Math.random() * spread;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  return positions;
}

/**
 * Baut eine jagged Silhouette (Berg-/Hügel-/Skyline-Kamm) als flache
 * Dreiecksstreifen-Geometrie. uv.y: 0 = Basis, 1 = Kammlinie – nützlich, um
 * im Shader z. B. einen Rand-Glow nur auf der obersten Kante zu zeichnen.
 * Wird von EclipseScene (Hügel), AuroraScene (Berge), CyberpunkScene
 * (Skyline) u. a. gemeinsam genutzt.
 */
export function buildRidgeSilhouette(opts: {
  segments: number;
  width: number;
  baseY: number;
  minHeight: number;
  maxHeight: number;
  jaggedness: number;
  seed?: () => number;
}): THREE.BufferGeometry {
  const { segments, width, baseY, minHeight, maxHeight, jaggedness } = opts;
  const rnd = opts.seed ?? Math.random;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const heights: number[] = [];
  let h = (minHeight + maxHeight) * 0.5;
  for (let i = 0; i <= segments; i++) {
    h += (rnd() - 0.5) * jaggedness;
    h = Math.max(minHeight, Math.min(maxHeight, h));
    heights.push(h);
  }

  for (let i = 0; i <= segments; i++) {
    const x = (i / segments - 0.5) * width;
    positions.push(x, baseY, 0);
    uvs.push(i / segments, 0);
    positions.push(x, baseY + heights[i], 0);
    uvs.push(i / segments, 1);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Re-export für Konsumenten, die Fn direkt aus diesem Modul importieren möchten (Konsistenz).
export { Fn };
