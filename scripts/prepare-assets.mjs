import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const assets = path.join(dist, 'assets');
const emittedFiles = await readdir(assets);
const matches = emittedFiles.filter((file) => /^ort-wasm-simd-threaded\.jsep-[\w-]+\.wasm$/.test(file));

if (matches.length === 0) {
  throw new Error('Vite did not emit ONNX Runtime JSEP WASM; confirm the onnxruntime-web package output before deploying.');
}
if (matches.length > 1) {
  throw new Error(`Expected one JSEP WASM output; found ${matches.length}.`);
}

const source = path.join(assets, matches[0]);
const wasm = await readFile(source);
const chunkBytes = 20 * 1024 * 1024;
const part0 = wasm.subarray(0, chunkBytes);
const part1 = wasm.subarray(chunkBytes);
await writeFile(path.join(dist, 'ort-wasm-simd-threaded.jsep.part-0'), part0);
await writeFile(path.join(dist, 'ort-wasm-simd-threaded.jsep.part-1'), part1);
await rm(source);

console.log(`Split ${matches[0]} (${wasm.byteLength.toLocaleString()} bytes) into ` +
  `${part0.byteLength.toLocaleString()} and ${part1.byteLength.toLocaleString()} byte assets; ` +
  'the Cloudflare Worker streams them at the original WASM URL.');
