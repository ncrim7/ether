// Converts the raw Sketchfab "05 Parfum" GLB into the web-ready public/models/perfume.glb.
//
// - bakes every node transform into its geometry (Sketchfab exports are Z-up with a rotated root)
// - deletes the original crystal stopper (the silhouette read too close to a well-known brand);
//   ÉTHER's cap is generated in code instead
// - renames nodes and materials to the names the app expects (see the design doc)
// - puts the base of the bottle at the origin, centered, with the glass body 1 unit tall
// - welds, prunes, quantizes and meshopt-compresses the result
//
// Usage: node scripts/prepare-model.mjs [input.glb] [output.glb]

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, weld, quantize, reorder, transformPrimitive } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';

const input = process.argv[2] ?? 'models-raw/model-5/05_parfum.glb';
const output = process.argv[3] ?? 'public/models/perfume.glb';

// Raw node name -> [app node name, app material name]
const PARTS = {
  Object_3: ['Glass', 'M_Glass'],
  Object_7: ['GlassTint', 'M_GlassTint'],
  Object_6: ['Liquid', 'M_Liquid'],
  Object_2: ['Collar', 'M_Metal'],
  Object_4: ['Cord', 'M_Cord'],
  Object_5: ['Seal', 'M_Seal'],
};

// Glass is the only part that is 1 unit tall after scaling.
const GLASS_HEIGHT = 1;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const doc = await io.read(input);
const root = doc.getRoot();
const scene = root.getDefaultScene() ?? root.listScenes()[0];

// 1. Bake world transforms into the geometry and gather the parts under one root.
const perfume = doc.createNode('Perfume');
const parts = new Map();
for (const node of root.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh || !PARTS[node.getName()]) continue;
  const [name, materialName] = PARTS[node.getName()];
  const world = node.getWorldMatrix();
  for (const prim of mesh.listPrimitives()) {
    transformPrimitive(prim, world);
    prim.getMaterial()?.setName(materialName);
  }
  mesh.setName(name);
  const part = doc.createNode(name).setMesh(mesh);
  parts.set(name, part);
  node.setMesh(null);
}
for (const child of scene.listChildren()) scene.removeChild(child);
for (const name of Object.values(PARTS).map(([n]) => n)) perfume.addChild(parts.get(name));
scene.addChild(perfume);

// 2. Delete the stopper: the glass triangles above the top of the tinted glass layer.
const tintTop = getBounds(parts.get('GlassTint')).max[1];
for (const prim of parts.get('Glass').getMesh().listPrimitives()) {
  const pos = prim.getAttribute('POSITION');
  const idx = prim.getIndices();
  const keep = [];
  const v = [0, 0, 0];
  for (let t = 0; t < idx.getCount(); t += 3) {
    const tri = [idx.getScalar(t), idx.getScalar(t + 1), idx.getScalar(t + 2)];
    const above = tri.every((i) => pos.getElement(i, v)[1] > tintTop + 0.05);
    if (!above) keep.push(...tri);
  }
  const removed = idx.getCount() / 3 - keep.length / 3;
  idx.setArray(new Uint32Array(keep));
  console.log(`stopper: removed ${removed} triangles from Glass`);
}

// 3. Base at the origin, centered on X/Z, glass body GLASS_HEIGHT tall.
const glass = getBounds(parts.get('Glass'));
const scale = GLASS_HEIGHT / (glass.max[1] - glass.min[1]);
const cx = (glass.min[0] + glass.max[0]) / 2;
const cz = (glass.min[2] + glass.max[2]) / 2;
const normalize = [
  scale, 0, 0, 0,
  0, scale, 0, 0,
  0, 0, scale, 0,
  -cx * scale, -glass.min[1] * scale, -cz * scale, 1,
];
for (const part of parts.values()) {
  for (const prim of part.getMesh().listPrimitives()) transformPrimitive(prim, normalize);
}

// 4. Clean up and compress.
await doc.transform(
  prune(),
  dedup(),
  weld(),
  reorder({ encoder: MeshoptEncoder }),
  quantize(),
);
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

await io.write(output, doc);

// 5. Report what the app will see.
const report = await io.read(output);
for (const node of report.getRoot().listNodes()) {
  if (!node.getMesh()) continue;
  const b = getBounds(node);
  const f = (a) => a.map((x) => x.toFixed(3)).join(', ');
  const tris = node.getMesh().listPrimitives().reduce((s, p) => s + p.getIndices().getCount() / 3, 0);
  console.log(`${node.getName().padEnd(10)} tris=${String(tris).padStart(6)}  min=[${f(b.min)}]  max=[${f(b.max)}]`);
}
