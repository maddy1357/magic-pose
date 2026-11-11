/*
 * Device camera: start/stop, switch lenses, torch, hardware or digital zoom,
 * and capture a frame cropped exactly like the on-screen preview.
 */
import { colorMatrixFilter } from './stylize.js';

export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.track = null;
    this.facing = 'user';
    this.isFront = true;
    this.caps = {};
    this.zoom = 1;
    this.hwZoom = false;
    this.deviceCount = 0;
  }

  static supported() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  get active() {
    return Boolean(this.track && this.track.readyState === 'live');
  }

  /**
   * @param {{facing?: 'user'|'environment', resolution?: number}} opt
   */
  async start({ facing = this.facing, resolution = 1080 } = {}) {
    this.stop();
    this.facing = facing;
    const long = resolution >= 2160 ? 3840 : resolution >= 1080 ? 1920 : 1280;
    const short = Math.round((long * 9) / 16);
    const tries = [
      { video: { facingMode: { ideal: facing }, width: { ideal: long }, height: { ideal: short } }, audio: false },
      { video: { facingMode: { ideal: facing } }, audio: false },
      { video: true, audio: false },
    ];
    let lastErr;
    for (const constraints of tries) {
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastErr = err;
        // Permission problems will not be fixed by relaxing constraints.
        if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) throw err;
      }
    }
    if (!this.stream) throw lastErr || new Error('Could not open the camera');

    this.track = this.stream.getVideoTracks()[0];
    const settings = this.track.getSettings ? this.track.getSettings() : {};
    // Desktop webcams usually report no facingMode: treat them as front cameras.
    this.isFront = settings.facingMode ? settings.facingMode === 'user' : facing === 'user';
    this.caps = this.track.getCapabilities ? this.track.getCapabilities() : {};
    this.hwZoom = Boolean(this.caps.zoom && this.caps.zoom.max > this.caps.zoom.min);
    this.zoom = this.hwZoom ? settings.zoom || 1 : 1;

    this.video.srcObject = this.stream;
    await this.video.play().catch(() => {});
    if (!this.video.videoWidth) {
      await new Promise((r) => this.video.addEventListener('loadedmetadata', r, { once: true }));
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.deviceCount = devices.filter((d) => d.kind === 'videoinput').length;
    } catch {
      this.deviceCount = 1;
    }
    return this;
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.track = null;
    this.video.srcObject = null;
  }

  get hasTorch() {
    return Boolean(this.caps.torch);
  }

  async setTorch(on) {
    if (!this.hasTorch || !this.active) return false;
    try {
      await this.track.applyConstraints({ advanced: [{ torch: on }] });
      return true;
    } catch {
      return false;
    }
  }

  /** Zoom levels to offer as buttons. */
  zoomStops() {
    if (this.hwZoom) {
      const { min, max } = this.caps.zoom;
      const stops = [0.5, 1, 2, 3, 5, 10].filter((z) => z >= min - 0.01 && z <= max + 0.01);
      return stops.length ? stops : [min];
    }
    return [1, 2, 3];
  }

  /** Returns the CSS (digital) zoom factor to apply to the preview. */
  async setZoom(z) {
    this.zoom = z;
    if (this.hwZoom && this.active) {
      try {
        await this.track.applyConstraints({ advanced: [{ zoom: z }] });
        return 1;
      } catch {
        this.hwZoom = false;
      }
    }
    return z;
  }

  get digitalZoom() {
    return this.hwZoom ? 1 : this.zoom;
  }

  /**
   * Grab the current frame, cropped to `aspect` (width / height) the same way
   * the preview is (object-fit: cover), with digital zoom applied.
   * @returns {HTMLCanvasElement}
   */
  capture({ aspect, mirror = false, filter = '' }) {
    const v = this.video;
    const vw = v.videoWidth;
    const vh = v.videoHeight;
    if (!vw || !vh) throw new Error('Camera is not ready yet');
    let sw = vw;
    let sh = vh;
    if (vw / vh > aspect) sw = vh * aspect;
    else sh = vw / aspect;
    const z = this.digitalZoom;
    sw /= z;
    sh /= z;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sw);
    canvas.height = Math.round(sh);
    const ctx = canvas.getContext('2d');
    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (filter) colorMatrixFilter(canvas, filter);
    return canvas;
  }
}

/** Friendly explanation for getUserMedia errors. */
export function describeCameraError(err) {
  const name = err && err.name;
  if (!window.isSecureContext) {
    return {
      title: 'Camera needs a secure connection',
      text: 'Open Magic Pose over HTTPS (or on localhost) to use the camera. You can still edit a photo from your device.',
    };
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { title: 'Camera permission blocked', text: 'Allow camera access in your browser settings, then tap “Try again”.' };
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return { title: 'No camera found', text: 'This device doesn’t seem to have a camera. You can still edit a photo from your device.' };
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return { title: 'Camera is busy', text: 'Another app may be using the camera. Close it and tap “Try again”.' };
  }
  return { title: 'Camera unavailable', text: (err && err.message) || 'Something went wrong opening the camera.' };
}
