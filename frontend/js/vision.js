/*
 * Loads MediaPipe Tasks Vision once and shares it between the pose coach and
 * the scene analyser. Everything runs on the device; nothing is uploaded.
 */
const VERSION = '0.10.14';
const CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`;

export const MODELS = {
  pose: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  classifier: 'https://storage.googleapis.com/mediapipe-models/image_classifier/efficientnet_lite0/float32/1/efficientnet_lite0.tflite',
};

let base = null;

/** @returns {Promise<{vision: object, files: object}>} */
export function loadVision() {
  if (!base) {
    base = (async () => {
      const vision = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      return { vision, files };
    })();
    base.catch(() => { base = null; });
  }
  return base;
}

/** Create a task on the GPU, falling back to the CPU. */
export async function createTask(factory, options) {
  try {
    return await factory({ ...options, baseOptions: { ...options.baseOptions, delegate: 'GPU' } });
  } catch {
    return factory({ ...options, baseOptions: { ...options.baseOptions, delegate: 'CPU' } });
  }
}
