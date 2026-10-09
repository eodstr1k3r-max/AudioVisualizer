import * as THREE from 'three';
import { useStore } from '../core/store';

const MAX_DIM = 512;

export class VideoOverlay {
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement | null = null;
  private ready = false;
  private fileName = '';
  private distance = 7;

  constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera) {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      toneMapped: false
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 5;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  setSource(file: File): void {
    this.fileName = file.name;
    this.ready = false;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.src = url;
    video.load();
    video.onloadedmetadata = () => {
      this.video = video;
      this.ready = true;
      video.play().catch(() => {});
      video.playbackRate = useStore.getState().settings.overlayVideoSpeed;
      useStore.getState().setUi({ sourceName: this.fileName });
    };
    video.onerror = () => {
      this.ready = false;
    };
  }

  clear(): void {
    this.video?.pause();
    this.video = null;
    this.ready = false;
    this.mesh.visible = false;
  }

  update(_dt: number, _time: number): void {
    const settings = useStore.getState().settings;

    if (!this.ready || !this.video || !this.video.videoWidth) {
      this.mesh.visible = false;
      return;
    }
    this.mesh.visible = true;

    if (this.video.playbackRate !== settings.overlayVideoSpeed) {
      this.video.playbackRate = settings.overlayVideoSpeed;
    }

    // Frame in reduzierter Auflösung verarbeiten (Chroma Key)
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;
    const scale = Math.min(1, MAX_DIM / Math.max(vw, vh));
    const pw = Math.max(2, Math.round(vw * scale));
    const ph = Math.max(2, Math.round(vh * scale));

    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }

    if (this.video.readyState >= 2) {
      this.ctx.clearRect(0, 0, pw, ph);
      this.ctx.drawImage(this.video, 0, 0, pw, ph);
      const frame = this.ctx.getImageData(0, 0, pw, ph);
      const data = frame.data;
      const thresh = settings.overlayKeyThreshold;
      const soft = settings.overlayKeySoftness;
      const startFade = Math.max(0, thresh - soft);

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const minChan = Math.min(r, g, b);
        if (Math.max(r, g, b) - minChan <= 20 && minChan >= thresh) {
          data[i + 3] = 0;
        } else if (minChan > startFade) {
          const mix = (minChan - startFade) / Math.max(1, thresh - startFade);
          data[i + 3] = Math.round(data[i + 3] * (1 - mix));
        }
      }
      this.ctx.putImageData(frame, 0, 0);
    }

    this.texture.needsUpdate = true;

    // Plane vor der Kamera positionieren (Billboard)
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    this.mesh.position.copy(this.camera.position).addScaledVector(fwd, this.distance);
    this.mesh.quaternion.copy(this.camera.quaternion);

    const halfH = Math.tan((this.camera.fov * Math.PI) / 360) * this.distance;
    const worldH = halfH * 2 * settings.overlayVideoScale;
    const aspect = vw / vh;
    this.mesh.scale.set(worldH * aspect, worldH, 1);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.texture.dispose();
    this.clear();
  }
}
