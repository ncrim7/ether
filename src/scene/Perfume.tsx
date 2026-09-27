import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { variantById } from '../data/products';
import { useExperience } from '../store/useExperience';
import { qualitySettings, prefersReducedMotion } from '../hooks/useQuality';

export const MODEL_URL = '/models/perfume.glb';

/** Top of the collar in model units: the cap sits here. */
const COLLAR_TOP = 1.14;
/** Glass body is 1 unit tall; with the cap the bottle is ~1.38. Used to center the bottle. */
export const BOTTLE_HEIGHT = 1.38;

type PerfumeNodes = Record<'Glass' | 'GlassTint' | 'Liquid' | 'Collar' | 'Cord' | 'Seal', THREE.Mesh>;

/**
 * Mesh props for a model part. The GLB is quantized, so each node carries the transform that
 * restores its real size and position: it must travel with the geometry.
 */
const part = (node: THREE.Mesh) => ({
  name: node.name,
  geometry: node.geometry,
  position: node.position,
  quaternion: node.quaternion,
  scale: node.scale,
});

/** ÉTHER's own cap, turned on a lathe: a slim cylinder with softened shoulders. */
function createCapGeometry() {
  const r = 0.165;
  const h = 0.24;
  const bevel = 0.025;
  const points: THREE.Vector2[] = [new THREE.Vector2(0, 0), new THREE.Vector2(r - 0.006, 0), new THREE.Vector2(r, 0.006)];
  points.push(new THREE.Vector2(r, h - bevel));
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    points.push(new THREE.Vector2(r - bevel + Math.cos(a) * bevel, h - bevel + Math.sin(a) * bevel));
  }
  points.push(new THREE.Vector2(0, h));
  return new THREE.LatheGeometry(points, 96);
}

export function Perfume() {
  const { nodes } = useGLTF(MODEL_URL) as unknown as { nodes: PerfumeNodes };
  const variantId = useExperience((s) => s.variant);
  const quality = useExperience((s) => s.quality);
  const variant = variantById(variantId);
  const group = useRef<THREE.Group>(null);

  const capGeometry = useMemo(createCapGeometry, []);

  const materials = useMemo(
    () => ({
      glass: new THREE.MeshPhysicalMaterial({
        roughness: 0.04,
        ior: 1.5,
        thickness: 0.35,
        specularIntensity: 1,
        envMapIntensity: 1.2,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
      // transmission only renders opaque objects behind it, so the liquid is opaque and glossy
      liquid: new THREE.MeshPhysicalMaterial({ roughness: 0.15, clearcoat: 1, envMapIntensity: 0.8 }),
      metal: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.28 }),
      cap: new THREE.MeshPhysicalMaterial({ metalness: 0.6, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      cord: new THREE.MeshStandardMaterial({ color: '#141214', roughness: 0.8 }),
    }),
    [],
  );

  // Glass quality depends on the device tier.
  useEffect(() => {
    const glass = materials.glass;
    if (qualitySettings[quality].transmission) {
      glass.transmission = 1;
      glass.transparent = false;
      glass.opacity = 1;
      glass.depthWrite = true;
    } else {
      // no transmission: a faint clear shell whose reflections carry the glass look
      glass.transmission = 0;
      glass.transparent = true;
      glass.opacity = 0.18;
      glass.depthWrite = false;
    }
    glass.needsUpdate = true;
  }, [materials, quality]);

  // Variant colors. Step 4 replaces this snap with the animated transition.
  useEffect(() => {
    const c = variant.colors;
    materials.glass.color.set('#ffffff');
    materials.glass.attenuationColor.set(c.glassTint);
    materials.glass.attenuationDistance = 1.5;
    materials.liquid.color.set(c.liquid);
    materials.metal.color.set(c.metal);
    materials.cap.color.set(c.cap);
  }, [materials, variant]);

  useEffect(() => () => {
    capGeometry.dispose();
    Object.values(materials).forEach((m) => m.dispose());
  }, [capGeometry, materials]);

  // Idle "breath": the only motion when nothing else is happening.
  const still = useMemo(prefersReducedMotion, []);
  useFrame(({ clock }) => {
    if (!group.current || still) return;
    const t = clock.elapsedTime;
    group.current.rotation.y = Math.sin(t * 0.25) * 0.12;
    group.current.position.y = -BOTTLE_HEIGHT / 2 + Math.sin(t * 0.8) * 0.008;
  });

  return (
    <group ref={group} position={[0, -BOTTLE_HEIGHT / 2, 0]} dispose={null}>
      <mesh {...part(nodes.Liquid)} material={materials.liquid} renderOrder={1} />
      <mesh {...part(nodes.Glass)} material={materials.glass} renderOrder={2} />
      <mesh {...part(nodes.Collar)} material={materials.metal} />
      <mesh {...part(nodes.Cord)} material={materials.cord} />
      <mesh {...part(nodes.Seal)} material={materials.cord} />
      <mesh name="Cap" geometry={capGeometry} material={materials.cap} position={[0, COLLAR_TOP, 0]} />
    </group>
  );
}

useGLTF.preload(MODEL_URL);
