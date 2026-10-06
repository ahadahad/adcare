/**
 * Real-ESRGAN Configuration Service
 * Browser-side WebGPU/WASM Real-ESRGAN architecture:
 * Model inference executes entirely in the client browser with WebGPU & WASM fallback.
 * The backend does not process or infer Real-ESRGAN photos.
 */

export interface RealEsrganConfig {
  enabled: boolean;
  model: string;
  isConfigured: boolean;
  engine: string;
  device: string;
}

const DEFAULT_MODEL = 'realesr-general-x4v3';

/**
 * Returns configuration status indicating Real-ESRGAN is available for client-side browser execution.
 */
export function getRealEsrganConfig(): RealEsrganConfig {
  return {
    enabled: true,
    model: DEFAULT_MODEL,
    isConfigured: true,
    engine: 'Browser-Side WebGPU / WASM Inference',
    device: 'Client Browser (WebGPU / WASM)',
  };
}
