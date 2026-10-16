import {hedgehog} from './hedgehog-model.mjs';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {build} from 'esbuild';
import fs from 'node:fs/promises';
// Exporter использует браузерный FileReader только для упаковки Blob.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(r=>{this.result=r;this.onloadend?.();});}readAsDataURL(blob){blob.arrayBuffer().then(r=>{this.result='data:'+blob.type+';base64,'+Buffer.from(r).toString('base64');this.onloadend?.();});}};
const model=await new GLTFExporter().parseAsync(hedgehog(),{binary:true});
await fs.writeFile('src/Yunost.Web/SeedAssets/models/hedgehog.glb',Buffer.from(model));
await build({entryPoints:['src/Yunost.Web/Pet3D/viewer.js'],outfile:'src/Yunost.Web/wwwroot/js/pet3d.js',bundle:true,minify:true,format:'iife',target:'es2022',legalComments:'linked'});
console.log('GLB '+model.byteLength+' bytes; 3D viewer собран.');
