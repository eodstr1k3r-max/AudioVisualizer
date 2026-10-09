import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useStore } from '../core/store';
import type { AudioData, CameraMode, VisualMode } from '../core/types';

const UP = new THREE.Vector3(0, 1, 0);

export class CameraSystem {
  mode: CameraMode = 'auto';

  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private controls: OrbitControls;

  private angle = 0;
  private t = 0;
  private autoPos = new THREE.Vector3(0, 14, 34);

  private keys = new Set<string>();
  private yaw = -Math.PI / 4;
  private pitch = 0.25;
  private fpPos = new THREE.Vector3(0, 6, 24);
  private dragging = false;
  private px = 0;
  private py = 0;

  // v5.0 Kick-Shake: abklingender Impuls für physische Wucht auf jedem Kick
  private shakeAmp = 0;
  private lastKick = false;
  private shakeOffset = new THREE.Vector3();

  // v5.0 Weiche Modus-Wechsel: Kamera gleitet von der alten Position/Blickrichtung
  // in den neuen Modus statt hart zu snappen (nur Auto/First-Person, nicht Orbit).
  private blendT = 0; // 1 = frisch gewechselt → 0 = fertig
  private blendFrom = new THREE.Vector3();
  private blendQuatFrom = new THREE.Quaternion();
  private tmpQuat = new THREE.Quaternion();
  private tmpMat4 = new THREE.Matrix4();
  private lookTarget = new THREE.Vector3();
  private static readonly BLEND_DUR = 0.9;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;

    this.controls = new OrbitControls(camera, dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.controls.enabled = false;
    this.controls.target.set(0, 0, 0);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  setMode(mode: CameraMode, visualMode: VisualMode): void {
    const prevMode = this.mode;
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    if (mode === 'orbit') {
      this.controls.target.set(0, 0, 0);
      this.controls.update();
      return;
    }
    // Übergangs-Startzustand erfassen (von welchem Standort aus geglättet wird)
    const smoothInto = mode === 'auto' || mode === 'firstperson';
    if (smoothInto && (prevMode === 'orbit' || prevMode === 'auto' || prevMode === 'firstperson')) {
      this.blendFrom.copy(this.camera.position);
      this.blendQuatFrom.copy(this.camera.quaternion);
      this.blendT = 1;
    } else {
      this.blendT = 0;
    }
    if (mode === 'firstperson') {
      this.fpPos.copy(this.camera.position);
      void visualMode;
    } else if (mode === 'auto') {
      this.autoPos.copy(this.camera.position);
      void visualMode;
    }
  }

  /** easeOutCubic für das sanfte Ausrollen des Übergangs */
  private static ease(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  update(dt: number, audio: AudioData, visualMode: VisualMode): void {
    // Live-Parameter (FOV, Orbit-Speed) aus Settings übernehmen
    const s = useStore.getState().settings;
    // Kick-Punch: FOV-Impuls auf jedem Kick/Beat für mehr Wucht
    const punch = audio.kickLevel * 3.2 + audio.beatPulse * 1.6;
    const targetFov = s.cameraFov + punch;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }

    // Kick-Shake: steigende Flanke zündet den Impuls, danach exponentielles Abklingen
    if (audio.isKick && !this.lastKick) {
      this.shakeAmp = Math.min(0.5, 0.22 + audio.kickLevel * 0.3);
    }
    this.lastKick = audio.isKick;
    this.shakeAmp *= Math.pow(0.0008, dt); // ~exp-Fall auf 0 innerhalb ~0.4s

    if (this.mode === 'orbit') {
      this.controls.rotateSpeed = 0.65 * s.orbitSpeed;
      this.controls.zoomSpeed = 0.9 * s.orbitSpeed;
      this.controls.update();
      return;
    }
    if (this.mode === 'firstperson') {
      this.updateFirstPerson(dt);
      this.applyShake();
      return;
    }
    this.updateAuto(dt, audio, visualMode);
    this.applyShake(audio);
  }

  /** Übergangs-Timer pro Frame abarbeiten. */
  private tickBlend(dt: number): number {
    if (this.blendT > 0) {
      this.blendT = Math.max(0, this.blendT - dt / CameraSystem.BLEND_DUR);
      return CameraSystem.ease(1 - this.blendT);
    }
    return 1;
  }

  /** Kleiner positions- und roll-basierter Shake direkt nach der Positionierung. */
  private applyShake(audio?: AudioData): void {
    if (this.shakeAmp < 0.001) return;
    const t = performance.now() / 1000;
    this.shakeOffset.set(
      Math.sin(t * 47.3) * this.shakeAmp,
      Math.sin(t * 39.1 + 1.7) * this.shakeAmp * 0.7,
      Math.cos(t * 43.7 + 0.6) * this.shakeAmp
    );
    this.camera.position.add(this.shakeOffset);
    // Subtiler Roll nur im Auto-Modus (First-Person: Nutzer steuert Quaternion selbst)
    if (audio && this.mode === 'auto') {
      this.camera.rotateZ(Math.sin(t * 31.0) * this.shakeAmp * 0.02 + audio.beatPulse * 0.006);
    }
  }

  private updateAuto(dt: number, audio: AudioData, visualMode: VisualMode): void {
    const s = useStore.getState().settings;
    const speedMul = s.autoSpeed;
    const baseDist = s.cameraDistance;
    const baseHeight = s.cameraHeight;

    if (visualMode === 'tunnel') {
      // Tunnel hat feste Kamera-Transform – ebenfalls weich einblenden
      this.autoPos.set(0, 2.5, 16);
      const ease = this.tickBlend(dt);
      if (ease < 1) {
        this.camera.position.lerpVectors(this.blendFrom, this.autoPos, ease);
        this.lookTarget.set(0, 2.5, -40);
        this.tmpMat4.lookAt(this.camera.position, this.lookTarget, UP);
        this.tmpQuat.setFromRotationMatrix(this.tmpMat4);
        this.camera.quaternion.slerpQuaternions(this.blendQuatFrom, this.tmpQuat, ease);
      } else {
        this.camera.position.set(0, 2.5, 16);
        this.camera.lookAt(0, 2.5, -40);
      }
      return;
    }

    this.t += dt;
    const speed = (0.35 + audio.energy * 0.9 + audio.bass * 0.7) * speedMul;
    this.angle += dt * speed;
    // Beat-Sync: dezenter vertikaler Impuls auf jedem Beat (beatPhase 0..1)
    const beatBob = Math.sin(audio.beatPhase * Math.PI) * audio.beatPulse * 2.5;
    const radius = baseDist + Math.sin(this.angle * 0.7) * 7 + audio.bass * 6 + audio.kickLevel * 3;
    const height = baseHeight + Math.sin(this.angle * 1.3) * 4 + audio.treble * 9 + audio.kickLevel * 5 + beatBob;

    this.autoPos.set(Math.sin(this.angle) * radius, height, Math.cos(this.angle) * radius);

    // Weicher Übergang: von der alten Position/Blickrichtung aus einrollen
    const ease = this.tickBlend(dt);
    if (ease < 1) {
      this.camera.position.lerpVectors(this.blendFrom, this.autoPos, ease);
      this.lookTarget.set(0, 1.5 + audio.bass * 2.5, 0);
      this.tmpMat4.lookAt(this.camera.position, this.lookTarget, UP);
      this.tmpQuat.setFromRotationMatrix(this.tmpMat4);
      this.camera.quaternion.slerpQuaternions(this.blendQuatFrom, this.tmpQuat, ease);
    } else {
      this.camera.position.copy(this.autoPos);
      this.camera.lookAt(0, 1.5 + audio.bass * 2.5, 0);
    }
  }

  private updateFirstPerson(dt: number): void {
    const speed = dt * 16;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3().crossVectors(forward, UP).normalize();

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.fpPos.addScaledVector(forward, speed);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.fpPos.addScaledVector(forward, -speed);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.fpPos.addScaledVector(right, -speed);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.fpPos.addScaledVector(right, speed);
    if (this.keys.has('Space')) this.fpPos.y += speed * 0.8;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) this.fpPos.y -= speed * 0.8;

    // Weicher Übergang inkl. Blickrichtungs-Slerp
    const ease = this.tickBlend(dt);
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.tmpQuat.setFromEuler(e);
    if (ease < 1) {
      this.camera.position.lerpVectors(this.blendFrom, this.fpPos, ease);
      this.camera.quaternion.slerpQuaternions(this.blendQuatFrom, this.tmpQuat, ease);
    } else {
      this.camera.position.copy(this.fpPos);
      this.camera.quaternion.copy(this.tmpQuat);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase() ?? '';
    if (['input', 'textarea', 'select'].includes(tag)) return;
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.mode !== 'firstperson') return;
    this.dragging = true;
    this.px = e.clientX;
    this.py = e.clientY;
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || this.mode !== 'firstperson') return;
    const dx = e.clientX - this.px;
    const dy = e.clientY - this.py;
    this.px = e.clientX;
    this.py = e.clientY;
    this.yaw -= dx * 0.004;
    this.pitch -= dy * 0.004;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
  };

  private onPointerUp = (): void => {
    this.dragging = false;
  };

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.controls.dispose();
  }
}
