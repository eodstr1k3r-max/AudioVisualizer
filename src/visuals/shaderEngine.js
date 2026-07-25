import { state } from '../core/state.js';

let gl = null;
let shaderCanvas = null;
let program = null;
let positionBuffer = null;
let uTimeLocation, uResolutionLocation, uBassLocation, uMidLocation, uTrebleLocation, uEnergyLocation, uKickLocation, uMouseLocation;
let mouseX = 0, mouseY = 0;

export const shaderPresets = {
  cybergrid: {
    name: 'Cyber Grid (Realistic 3D)',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;
uniform vec2 u_mouse;
uniform sampler2D u_image;
uniform bool u_hasImage;

void main() {
    vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.02, 0.03, 0.08);

    if (u_hasImage) {
        vec2 warp = st + sin(st.yx * 8.0 + u_time) * (u_bass * 0.02);
        vec4 tex = texture2D(u_image, warp * 0.5 + 0.5);
        col = mix(col, tex.rgb, 0.65);
    }

    // Volumetric 3D Grid floor
    vec3 ro = vec3(0.0, 1.5, -u_time * 2.0);
    vec3 rd = normalize(vec3(st, -1.0));
    
    float t = (0.0 - ro.y) / rd.y;
    if (t > 0.0) {
        vec2 pos = ro.xz + rd.xz * t;
        vec2 grid = abs(fract(pos - 0.5) - 0.5) / (0.04 + abs(pos) * 0.02);
        float line = min(grid.x, grid.y);
        float lighting = 1.0 - min(line, 1.0);
        
        vec3 gridCol = mix(vec3(0.13, 0.82, 0.94), vec3(0.84, 0.26, 0.96), sin(pos.x * 0.1 + u_time));
        col += gridCol * lighting * (0.8 + u_bass * 2.5) / (t * 0.2 + 1.0);
    }

    // Kick flash
    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.5 - length(st));
    gl_FragColor = vec4(col, 1.0);
}`
  },
  plasma: {
    name: 'Fluid Plasma Energy',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;
uniform sampler2D u_image;
uniform bool u_hasImage;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.01, 0.02, 0.06);

    if (u_hasImage) {
        vec4 tex = texture2D(u_image, p * 0.5 + 0.5);
        col = mix(col, tex.rgb, 0.5);
    }

    float t = u_time * 0.4;
    for(float i = 1.0; i < 5.0; i++) {
        p.x += sin(p.y + t + i * 1.2) * (0.4 + u_bass * 0.4);
        p.y += cos(p.x + t + i * 1.2) * (0.4 + u_treble * 0.4);
    }

    vec3 plasmaCol = vec3(
        sin(p.x + p.y + u_time) * 0.5 + 0.5,
        cos(p.x * p.y - u_time) * 0.5 + 0.5,
        sin(p.x - p.y + u_kick * 3.0) * 0.5 + 0.5
    );

    col += plasmaCol * (0.6 + u_energy * 0.8);
    col += vec3(0.9, 0.3, 0.7) * u_kick;
    gl_FragColor = vec4(col, 1.0);
}`
  },
  neonpulse: {
    name: 'Neon Volumetric Pulse',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;
uniform sampler2D u_image;
uniform bool u_hasImage;

void main() {
    vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.02, 0.02, 0.05);

    if (u_hasImage) {
        vec4 tex = texture2D(u_image, st * 0.5 + 0.5);
        col = mix(col, tex.rgb, 0.55);
    }

    float angle = atan(st.y, st.x);
    float dist = length(st);

    float wave = sin(angle * 10.0 + u_time * 3.0 + u_bass * 8.0) * 0.15;
    float circ = smoothstep(0.4 + wave, 0.38 + wave, dist);

    col = mix(col, vec3(0.13, 0.82, 0.94), circ * (1.0 + u_energy));
    col += vec3(0.54, 0.36, 0.96) * (u_bass / (dist * 3.0 + 0.05));
    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.4 - dist);

    gl_FragColor = vec4(col, 1.0);
}`
  },
  matrix: {
    name: 'Matrix Photorealistic Rain',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;
uniform sampler2D u_image;
uniform bool u_hasImage;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    vec3 col = vec3(0.01, 0.05, 0.02);

    if (u_hasImage) {
        vec4 tex = texture2D(u_image, st);
        col = mix(col, tex.rgb * vec3(0.2, 1.0, 0.4), 0.4);
    }

    st.y += u_time * (0.3 + u_bass * 0.8);
    vec2 grid = floor(st * vec2(50.0, 100.0));
    float r = rand(grid);
    
    float character = step(0.65, sin(r * 120.0 + u_time * 6.0));
    vec3 matrixCol = vec3(0.1, 0.95, 0.3) * character * (0.4 + u_energy * 0.8);
    col += matrixCol;
    col += vec3(0.9, 0.2, 0.6) * u_kick * (1.2 - length(st - 0.5));

    gl_FragColor = vec4(col, 1.0);
}`
  },
  vortex: {
    name: 'Raymarched Audio Vortex',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float a = atan(p.y, p.x);
    float r = length(p);

    float f = sin(a * 12.0 + r * (6.0 + u_bass * 8.0) - u_time * 4.0);
    vec3 col = vec3(
        sin(f + u_time),
        cos(f + u_mid * 3.0),
        sin(r * 6.0 - u_time)
    ) * (0.6 + u_energy * 0.6);

    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.5 - r);
    gl_FragColor = vec4(col, 1.0);
}`
  },
  spectrumbars3d: {
    name: '3D Photorealistic Spectrum Towers',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.02, 0.03, 0.08);

    vec2 id = floor(p * 8.0 + vec2(u_time * 3.0, 0.0));
    vec2 f = fract(p * 8.0 + vec2(u_time * 3.0, 0.0)) - 0.5;

    float height = (sin(id.x * 1.8 + id.y * 2.5 + u_time) * 0.5 + 0.5) * (0.25 + u_bass * 2.2);
    float tower = max(abs(f.x), abs(f.y));

    if (tower < 0.4 && p.y < (height - 0.35)) {
        vec3 glow = mix(vec3(0.13, 0.82, 0.94), vec3(0.84, 0.26, 0.96), abs(p.x));
        col = glow * (1.0 + u_energy * 3.0 + height * 1.5);
    }

    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.6 - length(p));
    gl_FragColor = vec4(col, 1.0);
}`
  },
  hyperspace: {
    name: 'Photorealistic Hyperspace Warp',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.01, 0.02, 0.06);

    float d = length(p);
    float t = u_time * (3.0 + u_bass * 10.0);
    
    float a = atan(p.y, p.x);
    float stars = sin(a * 24.0 + t) * sin(d * 50.0 - t * 6.0);
    stars = smoothstep(0.75, 1.0, stars) * (1.0 - d);

    col += vec3(0.13, 0.82, 0.94) * stars * (1.2 + u_energy * 4.0);
    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.3 - d);

    gl_FragColor = vec4(col, 1.0);
}`
  },
  audiocity: {
    name: 'Cyber Audio City Skyline',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.02, 0.01, 0.07);

    float x = p.x * 12.0;
    float id = floor(x);
    float f = fract(x) - 0.5;

    float height = sin(id * 3.0 + u_time) * 0.5 + 0.5;
    height *= (0.4 + u_bass * 2.0 + abs(sin(id)) * u_treble);

    if (abs(f) < 0.45 && p.y < (height - 0.25)) {
        vec3 neon = mix(vec3(0.22, 0.78, 0.95), vec3(0.96, 0.26, 0.64), abs(p.x * 0.4));
        col = neon * (1.0 + u_energy * 2.5 + p.y * 1.5);
    }

    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.5 - length(p));
    gl_FragColor = vec4(col, 1.0);
}`
  },
  cybertunnel: {
    name: 'Cinematic Cyberpunk Tunnel',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.01, 0.02, 0.06);

    float r = length(p);
    float a = atan(p.y, p.x);

    float t = u_time * (4.0 + u_bass * 5.0);
    float rings = sin(1.0 / (r + 0.04) * 5.0 - t + a * 4.0);
    
    vec3 neon = mix(vec3(0.13, 0.82, 0.94), vec3(0.94, 0.26, 0.64), sin(a + u_time));
    col += neon * smoothstep(0.65, 1.0, abs(rings)) * (0.8 + u_energy * 2.5) / (r + 0.15);

    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.6 - r);
    gl_FragColor = vec4(col, 1.0);
}`
  },
  retrowave: {
    name: 'Synthwave Sun & Horizon Grid',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.03, 0.01, 0.1);

    vec2 sunPos = vec2(0.0, 0.25);
    float d = length(p - sunPos);
    if (d < 0.4) {
        float stripes = step(0.22, sin(p.y * 24.0 - u_time * 3.0));
        vec3 sunCol = mix(vec3(1.0, 0.2, 0.1), vec3(1.0, 0.8, 0.1), p.y + 0.5);
        col = mix(col, sunCol * (1.0 + u_bass * 0.8), stripes);
    }

    if (p.y < 0.0) {
        vec2 uv = p;
        uv.y = 1.0 / (abs(uv.y) + 0.08);
        uv.x *= uv.y;
        vec2 grid = fract(uv + vec2(0.0, u_time * 3.0));
        float line = step(0.82, max(grid.x, grid.y));
        col = mix(col, vec3(0.95, 0.1, 0.65), line * (0.6 + u_energy * 1.5));
    }

    float scanline = sin(gl_FragCoord.y * 4.0) * 0.04;
    col -= scanline;
    col += vec3(0.2, 0.8, 1.0) * u_kick * 1.2;

    gl_FragColor = vec4(col, 1.0);
}`
  },
  kaleidoscope: {
    name: 'Professional Audio Kaleidoscope',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    
    float a = atan(p.y, p.x);
    float r = length(p);
    float segments = 8.0 + floor(u_bass * 6.0);
    a = mod(a, 6.28318 / segments);
    a = abs(a - 3.14159 / segments);
    p = r * vec2(cos(a), sin(a));

    vec2 uv = p * (2.5 + sin(u_time * 0.5) * 0.5);
    vec3 col = vec3(
        sin(uv.x + u_time + u_bass),
        cos(uv.y - u_time + u_treble),
        sin(uv.x * uv.y + u_kick)
    ) * (0.6 + u_energy * 0.7);

    col.r += sin(gl_FragCoord.y * 3.0 + u_time) * 0.06;
    col += vec3(0.94, 0.27, 0.57) * u_kick * 1.4;

    gl_FragColor = vec4(col, 1.0);
}`
  },
  imagewarp: {
    name: 'Cinematic Audio Image Warp',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;
uniform sampler2D u_image;
uniform bool u_hasImage;

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 col = vec3(0.02, 0.03, 0.08);

    if (u_hasImage) {
        vec2 warpUV = uv + sin(uv.yx * 14.0 + u_time * 2.5) * (u_bass * 0.03 + u_kick * 0.06);
        vec4 texColor = texture2D(u_image, warpUV);
        
        float r = texture2D(u_image, warpUV + vec2(u_kick * 0.02, 0.0)).r;
        float g = texColor.g;
        float b = texture2D(u_image, warpUV - vec2(u_kick * 0.02, 0.0)).b;
        col = vec3(r, g, b);
        col *= (0.8 + u_energy * 0.4);
    } else {
        vec2 st = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
        col = vec3(0.12, 0.22, 0.45) * (1.2 - length(st));
    }

    col += vec3(0.94, 0.27, 0.57) * u_kick * 0.6;
    gl_FragColor = vec4(col, 1.0);
}`
  },
  sphered3: {
    name: '3D Audio Sphere',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.01, 0.02, 0.06);

    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(p, 1.0));

    float d = 0.0;
    for(int i = 0; i < 64; i++) {
        vec3 rp = ro + rd * d;
        float r = length(rp) - (0.8 + u_bass * 0.4 + sin(rp.x * 6.0 + u_time * 4.0) * 0.1);
        if (r < 0.001 || d > 10.0) break;
        d += r;
    }

    if (d < 10.0) {
        vec3 rp = ro + rd * d;
        vec3 n = normalize(rp);
        float diff = max(dot(n, vec3(0.5, 0.8, -0.5)), 0.2);
        vec3 sphereCol = mix(vec3(0.13, 0.82, 0.94), vec3(0.84, 0.26, 0.96), n.y * 0.5 + 0.5);
        col = sphereCol * diff * (1.2 + u_energy * 2.5);
    }

    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.5 - length(p));
    gl_FragColor = vec4(col, 1.0);
}`
  },
  ringbars3d: {
    name: '3D Circular Ring Bars',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.02, 0.01, 0.05);

    float r = length(p);
    float a = atan(p.y, p.x);

    float bars = sin(a * 24.0 + u_time * 2.0);
    float height = 0.5 + (bars * 0.5) * (0.2 + u_bass * 1.8 + u_mid * 1.2);

    float ring = smoothstep(height + 0.03, height, r) - smoothstep(height, height - 0.03, r);
    vec3 ringCol = mix(vec3(0.2, 0.9, 0.95), vec3(0.9, 0.2, 0.7), sin(a * 2.0 + u_time));

    col += ringCol * ring * (1.2 + u_energy * 3.5);
    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.4 - r);

    gl_FragColor = vec4(col, 1.0);
}`
  },
  spectrumwall: {
    name: '3D Spectrum Wall',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.01, 0.02, 0.05);

    vec2 id = floor(p * 12.0 + vec2(0.0, u_time * 2.0));
    vec2 f = fract(p * 12.0 + vec2(0.0, u_time * 2.0)) - 0.5;

    float barHeight = sin(id.x * 0.8 + u_time) * 0.5 + 0.5;
    barHeight *= (0.2 + u_bass * 2.0 + u_treble * 1.2);

    if (abs(f.x) < 0.35 && p.y < (barHeight - 0.5)) {
        vec3 barCol = mix(vec3(0.13, 0.82, 0.94), vec3(0.94, 0.26, 0.64), p.y + 0.5);
        col = barCol * (1.2 + u_energy * 3.0 + barHeight);
    }

    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.5 - length(p));
    gl_FragColor = vec4(col, 1.0);
}`
  },
  wormhole3d: {
    name: '3D Audio Wormhole',
    code: `precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_energy;
uniform float u_kick;

void main() {
    vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    vec3 col = vec3(0.01, 0.02, 0.05);

    float r = length(p);
    float a = atan(p.y, p.x);

    float t = u_time * (5.0 + u_bass * 6.0);
    float tunnel = sin(1.0 / (r + 0.02) * 6.0 - t + a * 6.0);

    vec3 tone = mix(vec3(0.2, 0.8, 1.0), vec3(0.9, 0.3, 0.7), sin(a + u_time));
    col += tone * smoothstep(0.6, 1.0, abs(tunnel)) * (1.2 + u_energy * 3.5) / (r + 0.1);

    col += vec3(0.94, 0.27, 0.57) * u_kick * (1.6 - r);
    gl_FragColor = vec4(col, 1.0);
}`
  }
};

let bgTexture = null;

function updateBackgroundTexture(gl, img) {
  if (!gl || !img) return;
  if (!bgTexture) {
    bgTexture = gl.createTexture();
  }
  gl.bindTexture(gl.TEXTURE_2D, bgTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

export function initShaderEngine() {
  shaderCanvas = document.getElementById('shaderCanvas');
  if (!shaderCanvas) return;

  gl = shaderCanvas.getContext('webgl', { preserveDrawingBuffer: true });
  if (!gl) {
    console.error('WebGL not supported');
    return;
  }

  window.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  const positionLocation = 0;
  positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,
     1, -1,
    -1,  1,
    -1,  1,
     1, -1,
     1,  1,
  ]), gl.STATIC_DRAW);

  compileShader(state.shaderCode);
}

export function compileShader(fragmentSource) {
  if (!gl) return { success: true };

  const vertexSource = `
    attribute vec2 a_position;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vertexSource);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fragmentSource);
  gl.compileShader(fs);

  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    const errorLog = gl.getShaderInfoLog(fs);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return { success: false, error: errorLog };
  }

  const newProgram = gl.createProgram();
  gl.attachShader(newProgram, vs);
  gl.attachShader(newProgram, fs);
  gl.linkProgram(newProgram);

  if (!gl.getProgramParameter(newProgram, gl.LINK_STATUS)) {
    const errorLog = gl.getProgramInfoLog(newProgram);
    gl.deleteProgram(newProgram);
    return { success: false, error: errorLog };
  }

  if (program) gl.deleteProgram(program);
  program = newProgram;

  uTimeLocation = gl.getUniformLocation(program, 'u_time');
  uResolutionLocation = gl.getUniformLocation(program, 'u_resolution');
  uBassLocation = gl.getUniformLocation(program, 'u_bass');
  uMidLocation = gl.getUniformLocation(program, 'u_mid');
  uTrebleLocation = gl.getUniformLocation(program, 'u_treble');
  uEnergyLocation = gl.getUniformLocation(program, 'u_energy');
  uKickLocation = gl.getUniformLocation(program, 'u_kick');
  uMouseLocation = gl.getUniformLocation(program, 'u_mouse');

  return { success: true };
}

export function renderShader(time, audioData, bgImage) {
  if (!gl || !program || (state.mode !== 'shader' && state.mode !== 'fusion')) {
    if (shaderCanvas) shaderCanvas.style.display = 'none';
    return;
  }

  if (shaderCanvas) shaderCanvas.style.display = 'block';

  const width = window.innerWidth;
  const height = window.innerHeight;
  if (shaderCanvas.width !== width || shaderCanvas.height !== height) {
    shaderCanvas.width = width;
    shaderCanvas.height = height;
    gl.viewport(0, 0, width, height);
  }

  gl.useProgram(program);

  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  gl.uniform1f(uTimeLocation, time * 0.001);
  gl.uniform2f(uResolutionLocation, width, height);
  gl.uniform1f(uBassLocation, audioData.bass);
  gl.uniform1f(uMidLocation, audioData.mid);
  gl.uniform1f(uTrebleLocation, audioData.treble);
  gl.uniform1f(uEnergyLocation, audioData.energy);
  gl.uniform1f(uKickLocation, audioData.kickVisualLevel);
  gl.uniform2f(uMouseLocation, mouseX, mouseY);

  const uImageLoc = gl.getUniformLocation(program, 'u_image');
  const uHasImageLoc = gl.getUniformLocation(program, 'u_hasImage');

  if (bgImage && bgImage.complete && bgImage.naturalWidth) {
    updateBackgroundTexture(gl, bgImage);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, bgTexture);
    if (uImageLoc) gl.uniform1i(uImageLoc, 0);
    if (uHasImageLoc) gl.uniform1i(uHasImageLoc, 1);
  } else {
    if (uHasImageLoc) gl.uniform1i(uHasImageLoc, 0);
  }

  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
