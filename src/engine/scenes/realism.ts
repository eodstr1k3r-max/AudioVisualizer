import * as THREE from 'three';

/**
 * Gemeinsame Bausteine für fotorealistische Szenen: Himmelskuppel mit
 * Vertex-Farb-Verlauf (Zenit → Horizont → Boden) und ein reflektierender
 * PBR-Boden. Beide funktionieren identisch in WebGPU & WebGL2 und kommen
 * ohne Canvas-Gradienten aus (kein DOM nötig → Tests bleiben grün).
 */

/** BackSide-Sphäre mit weichem Höhen-Verlauf als natürlicher Himmel. */
export function createSkyDome(
  topColor: number | string,
  horizonColor: number | string,
  bottomColor: number | string,
  radius = 260,
  segments = 32
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, segments, Math.max(12, segments >> 1));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(topColor);
  const horizon = new THREE.Color(horizonColor);
  const bottom = new THREE.Color(bottomColor);
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    // y in [-radius, radius] → 0 (unten) .. 1 (oben)
    const t = (pos.getY(i) / radius + 1) * 0.5;
    if (t < 0.5) {
      tmp.copy(bottom).lerp(horizon, t * 2);
    } else {
      tmp.copy(horizon).lerp(top, (t - 0.5) * 2);
    }
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    vertexColors: true,
    fog: false,
    depthWrite: false,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

/* ------------------- Prozedurales JS-Rauschen (CPU-Displacement) ------------------- */

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function hash3(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Glättet einen Wert zwischen zwei Kanten auf 0..1. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return smoothstep01(t);
}

/** Deterministisches 2D-Value-Noise (0..1). */
export function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(xi, yi);
  const b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1);
  const d = hash2(xi + 1, yi + 1);
  const u = smoothstep01(xf);
  const v = smoothstep01(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal Brownian Motion über mehrere Oktaven (≈0..1). */
export function fbm2(x: number, y: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise2(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return v;
}

/** Deterministisches 3D-Value-Noise (0..1). */
export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = smoothstep01(xf);
  const v = smoothstep01(yf);
  const w = smoothstep01(zf);

  const c000 = hash3(xi, yi, zi);
  const c100 = hash3(xi + 1, yi, zi);
  const c010 = hash3(xi, yi + 1, zi);
  const c110 = hash3(xi + 1, yi + 1, zi);
  const c001 = hash3(xi, yi, zi + 1);
  const c101 = hash3(xi + 1, yi, zi + 1);
  const c011 = hash3(xi, yi + 1, zi + 1);
  const c111 = hash3(xi + 1, yi + 1, zi + 1);

  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/** 3D-Fractal Brownian Motion über mehrere Oktaven (≈0..1). */
export function fbm3(x: number, y: number, z: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise3(x * freq, y * freq, z * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return v;
}

/**
 * Emissiv-Kompensation für gesättigte Neonfarben.
 *
 * Bloom triggert auf linearer Luminanz (0.299·R + 0.587·G + 0.114·B). Dadurch
 * blühen cyan/grün bei gleicher Emissiv-Intensität deutlich stärker als warme
 * Farbtöne (rot/orange) oder Blau. Dieser Faktor normiert die Emissiv-Luminanz
 * auf das Niveau von Grün, damit alle Neonfarben gleich stark blühen.
 *
 * - rot/orange: Faktor > 1 (Anhebung)
 * - grün:       ~1
 * - cyan:       ~0.8 (leicht abgesenkt)
 * - blau:       bis 2.2 (gedeckelt, damit dunkle Töne nicht aufreißen)
 */
export function neonEmissiveComp(color: THREE.Color, targetLuma = 0.58, maxBoost = 2.2): number {
  const luma = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
  if (luma <= 1e-4) return 1;
  const raw = targetLuma / luma;
  return Math.min(maxBoost, Math.max(0.7, raw));
}

/** Große, leicht raue PBR-Bodenfläche mit Environment-Reflexion. */
export function createGroundPlane(
  size = 400,
  color: number | string = 0x0b0e18,
  roughness = 0.85,
  metalness = 0.25,
  y = -14
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, 1, 1);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    envMapIntensity: 0.7
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;
  mesh.receiveShadow = false;
  return mesh;
}
