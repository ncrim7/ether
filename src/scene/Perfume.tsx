import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Shadow, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from '../animation/scroll';
import { variantById } from '../data/products';
import { useExperience } from '../store/useExperience';
import { qualitySettings, prefersReducedMotion } from '../hooks/useQuality';
import { createLiquidMaterial } from './liquidMaterial';
import { IDLE_SPIN, pose, pour } from './pose';
import { Pour } from './Pour';
import { expose } from '../debug';

export const MODEL_URL = '/models/perfume.glb';

/** Top of the collar in model units: the cap sits here. */
const COLLAR_TOP = 1.14;
/** Glass body is 1 unit tall; with the cap the bottle is ~1.38. Used to center the bottle. */
export const BOTTLE_HEIGHT = 1.38;
/** Sections where the bottle holds still so it can be read (notes) or taken apart (deconstruct). */
const STILL_SECTIONS = new Set(['notes', 'deconstruct']);
const TAU = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
/** Slosh spring: max surface tilt (slope), rocking frequency, and how fast it calms down. */
const SLOSH = { max: 0.14, hz: 1.3, recovery: 1.1 };

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

/** Tween a THREE.Color toward a hex value inside a timeline. */
function tweenColor(tl: gsap.core.Timeline, color: THREE.Color, hex: string, duration: number, at: number) {
  const to = new THREE.Color(hex);
  tl.to(color, { r: to.r, g: to.g, b: to.b, duration, ease: 'power2.inOut' }, at);
}

export function Perfume() {
  const { nodes } = useGLTF(MODEL_URL) as unknown as { nodes: PerfumeNodes };
  const variant = variantById(useExperience((s) => s.variant));
  const quality = useExperience((s) => s.quality);
  const loaded = useExperience((s) => s.loaded);
  const capOpen = useExperience((s) => s.capOpen);
  const activeNote = useExperience((s) => s.activeNote);

  const outer = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Group>(null);
  const neck = useRef<THREE.Group>(null);
  const glass = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null);

  const capGeometry = useMemo(createCapGeometry, []);

  const liquid = useMemo(() => createLiquidMaterial(nodes.Liquid), [nodes]);

  const materials = useMemo(
    () => ({
      glass: new THREE.MeshPhysicalMaterial({
        roughness: 0.04,
        ior: 1.5,
        thickness: 0.35,
        specularIntensity: 1,
        // the front face is a large flat mirror: strong reflections wash the liquid's color out
        envMapIntensity: 0.7,
        // a subtle tint: seen on its own during deconstruct, the glass must still read as clear
        attenuationDistance: 4,
      }),
      // transmission only renders opaque objects behind it, so the liquid is opaque and glossy
      liquid: liquid.material,
      metal: new THREE.MeshStandardMaterial({ metalness: 1, roughness: 0.28 }),
      cap: new THREE.MeshPhysicalMaterial({ metalness: 0.6, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      cord: new THREE.MeshStandardMaterial({ color: '#141214', roughness: 0.8 }),
    }),
    [liquid],
  );

  // Glass quality depends on the device tier.
  useEffect(() => {
    const g = materials.glass;
    if (qualitySettings[quality].transmission) {
      g.transmission = 1;
      g.transparent = false;
      g.opacity = 1;
      g.depthWrite = true;
    } else {
      // no transmission: a faint clear shell whose reflections carry the glass look
      g.transmission = 0;
      g.transparent = true;
      g.opacity = 0.12;
      g.depthWrite = false;
    }
    g.needsUpdate = true;
  }, [materials, quality]);

  // Variant change = a refill. The bottle turns its back, the cap unscrews and steps aside, the old
  // perfume drains, a stream of the new one falls through the neck and the level rises (rippling,
  // bubbling), the stream runs dry, the surface settles and the cap screws back on. ~4 s.
  const firstVariant = useRef(true);
  const variantTl = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => {
    const c = variant.colors;
    const u = liquid.uniforms;

    if (firstVariant.current) {
      firstVariant.current = false;
      u.uColor.value.set(c.liquid);
      materials.glass.attenuationColor.set(c.glassTint);
      materials.metal.color.set(c.metal);
      materials.cap.color.set(c.cap);
      return;
    }

    // finishing the previous refill first keeps a quick second change clean
    variantTl.current?.progress(1).kill();
    const tl = gsap.timeline();

    if (prefersReducedMotion()) {
      tl.call(() => void u.uColor.value.set(c.liquid));
      tweenColor(tl, materials.glass.attenuationColor, c.glassTint, 0.3, 0);
      tweenColor(tl, materials.metal.color, c.metal, 0.3, 0);
      tweenColor(tl, materials.cap.color, c.cap, 0.3, 0);
      variantTl.current = tl;
      return;
    }

    tl.to(pose, { variantSpin: pose.variantSpin + Math.PI, duration: 1.4, ease: 'power3.inOut' }, 0);
    tl.to(pour, { capAside: 1, duration: 0.9, ease: 'power2.inOut' }, 0.05);
    tl.to(pour, { fill: 0, duration: 0.75, ease: 'power2.in' }, 0.1);
    // the bottle is empty and facing away: the new perfume's color can be set unseen
    tl.call(() => void u.uColor.value.set(c.liquid), undefined, 0.86);
    tl.fromTo(pour, { head: 0, tail: 0 }, { head: 1, duration: 0.32, ease: 'power2.in', immediateRender: false }, 0.9);
    tl.to(pour, { agitation: 1, duration: 0.25 }, 1.15);
    tl.to(pour, { fill: 1, duration: 1.7, ease: 'sine.inOut' }, 1.2);
    tl.to(pour, { tail: 1, duration: 0.32, ease: 'power2.in' }, 2.75);
    tl.to(pour, { agitation: 0, duration: 1.3, ease: 'power2.out' }, 2.95);
    tl.to(pour, { capAside: 0, duration: 1.1, ease: 'power2.inOut' }, 3.0);
    tl.set(pour, { head: 0, tail: 0 }, 3.1);
    tweenColor(tl, materials.glass.attenuationColor, c.glassTint, 1.2, 0.6);
    tweenColor(tl, materials.metal.color, c.metal, 1.2, 0.6);
    tweenColor(tl, materials.cap.color, c.cap, 1.2, 0.6);
    variantTl.current = tl;
    expose('refill', tl);
  }, [variant, liquid, materials]);

  // Cap: unscrews (three turns) while rising, screws back down on close.
  useEffect(() => {
    const tween = gsap.to(pose, {
      capOpen: capOpen ? 1 : 0,
      duration: prefersReducedMotion() ? 0.2 : 1.6,
      ease: capOpen ? 'power2.inOut' : 'power3.inOut',
    });
    return () => void tween.kill();
  }, [capOpen]);

  // Note focus: turn the note's side toward the camera, tilt and zoom as the data says.
  useEffect(() => {
    const note = variant.notes.find((n) => n.id === activeNote);
    const tween = gsap.to(pose, {
      noteRot: note ? THREE.MathUtils.degToRad(-note.camera.azimuth) : 0,
      noteTilt: note ? THREE.MathUtils.degToRad(note.camera.elevation) * 0.35 : 0,
      noteZoom: note ? 2.4 / note.camera.distance : 1,
      duration: prefersReducedMotion() ? 0.2 : 1.1,
      ease: 'power3.inOut',
    });
    return () => void tween.kill();
  }, [activeNote, variant]);

  // Intro: the bottle rises out of the dark once the loader has finished.
  useEffect(() => {
    if (!loaded) return;
    const tween = gsap.to(pose, {
      intro: 1,
      duration: prefersReducedMotion() ? 0.3 : 2.8,
      delay: prefersReducedMotion() ? 0 : 0.6,
      ease: 'power3.out',
    });
    return () => void tween.kill();
  }, [loaded]);

  useEffect(() => () => {
    capGeometry.dispose();
    Object.values(materials).forEach((m) => m.dispose());
  }, [capGeometry, materials]);

  // Idle spin, applied on top of every animated value.
  const reduced = useMemo(prefersReducedMotion, []);
  const idle = useRef({ angle: 0, speed: reduced ? 0 : 1 });
  const wobble = useRef({ ready: false, x: 0, y: 0, angle: 0, addX: 0, addZ: 0 });
  const tmp = useMemo(
    () => ({
      qInv: new THREE.Quaternion(),
      qSpin: new THREE.Quaternion(),
      qTilt: new THREE.Quaternion(),
      right: new THREE.Vector3(),
      depth: new THREE.Vector3(),
      pos: new THREE.Vector3(),
    }),
    [],
  );
  useFrame(({ clock }, delta) => {
    if (!outer.current || !spin.current || !cap.current || !neck.current || !glass.current) return;
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const still = reduced || STILL_SECTIONS.has(useExperience.getState().section);

    // spin freely, or ease the idle angle back to a whole turn so the pose's angle is exact
    const i = idle.current;
    i.speed = THREE.MathUtils.damp(i.speed, still ? 0 : 1, 2, dt);
    i.angle += IDLE_SPIN * i.speed * dt;
    if (still) i.angle = THREE.MathUtils.damp(i.angle, Math.round(i.angle / TAU) * TAU, 2.5, dt);

    const breath = reduced ? 0 : Math.sin(t * 0.8) * 0.008;
    const rise = (1 - pose.intro) * -0.45;
    outer.current.position.set(pose.x, -BOTTLE_HEIGHT / 2 + pose.y + rise + breath, 0);
    outer.current.scale.setScalar(pose.scale * pose.noteZoom * (0.9 + 0.1 * pose.intro));

    spin.current.rotation.set(pose.noteTilt, i.angle + pose.scrollRot + pose.variantSpin + pose.noteRot, reduced ? 0 : Math.sin(t * 0.5) * 0.015);

    // bottle-space directions of the world's up, right and depth (the bottle spins; the world doesn't)
    spin.current.updateWorldMatrix(true, false);
    spin.current.getWorldQuaternion(tmp.qInv).invert();
    const right = tmp.right.set(1, 0, 0).applyQuaternion(tmp.qInv);
    const depth = tmp.depth.set(0, 0, 1).applyQuaternion(tmp.qInv);

    // --- the cap: unscrews and rises (button / deconstruct); during a refill it also steps aside,
    // always toward the viewer's right, tipping away from the neck ---
    const aside = pour.capAside;
    // lifted just clear of the neck and set down beside it, low enough to stay in frame
    const capY = COLLAR_TOP + pose.capOpen * 0.22 + pose.lift * 0.42 + Math.sin(aside * Math.PI) * 0.12 + aside * 0.1;
    cap.current.position.set(right.x * aside * 0.5, capY, right.z * aside * 0.5);
    tmp.qSpin.setFromAxisAngle(Y_AXIS, -(pose.capOpen * 3 + pose.lift * 1.5 + aside * 2) * Math.PI);
    tmp.qTilt.setFromAxisAngle(depth, -aside * 0.45);
    cap.current.quaternion.multiplyQuaternions(tmp.qTilt, tmp.qSpin);
    neck.current.position.y = pose.lift * 0.2;

    // --- liquid level and slosh ---
    const u = liquid.uniforms;
    const level = THREE.MathUtils.lerp(liquid.minY - 0.01, liquid.maxY - 0.004, pour.fill);
    pour.level = level;
    u.uLevel.value = level;
    u.uAgitation.value = pour.agitation;
    u.uTime.value = t;

    // A damped spring fed by the bottle's movement (MinionsArt-style wobble): moving sideways or
    // turning quickly tips the surface, which then rocks back and settles.
    const w = wobble.current;
    const pos = spin.current.getWorldPosition(tmp.pos);
    const angle = spin.current.rotation.y;
    if (w.ready && dt > 0) {
      const vx = (pos.x - w.x) / dt;
      const vy = (pos.y - w.y) / dt;
      // a slow spin about its own axis doesn't stir a liquid; only fast turns (a variant change) do
      const rawRate = (angle - w.angle) / dt;
      const spinRate = Math.sign(rawRate) * Math.max(0, Math.abs(rawRate) - 0.8);
      const k = dt * 60;
      w.addX = THREE.MathUtils.lerp(w.addX, 0, dt * SLOSH.recovery);
      w.addZ = THREE.MathUtils.lerp(w.addZ, 0, dt * SLOSH.recovery);
      w.addX = THREE.MathUtils.clamp(w.addX + (-vx * 0.02 + spinRate * 0.004) * k, -SLOSH.max, SLOSH.max);
      w.addZ = THREE.MathUtils.clamp(w.addZ + (vy * 0.01 + spinRate * 0.003) * k, -SLOSH.max, SLOSH.max);
      // a pouring stream keeps stirring the surface
      w.addX += Math.sin(t * 7.3) * 0.0025 * pour.agitation * k;
      w.addZ += Math.cos(t * 6.1) * 0.0025 * pour.agitation * k;
    }
    w.ready = true;
    w.x = pos.x;
    w.y = pos.y;
    w.angle = angle;
    const pulse = TAU * SLOSH.hz * t;
    const worldNormal = u.uPlaneNormalWorld.value.set(w.addX * Math.sin(pulse), 1, w.addZ * Math.sin(pulse + 0.9)).normalize();
    u.uPlaneNormal.value.copy(worldNormal).applyQuaternion(tmp.qInv);
    // the glass slides left, away from the labels on the right
    glass.current.position.x = -pose.split;

    // the shadow tightens as the bottle settles and fades while it hovers during the intro
    if (shadow.current) {
      shadow.current.material.opacity = 0.55 * pose.intro * pose.intro;
      shadow.current.position.y = -rise + 0.002;
    }
  });

  return (
    <group ref={outer} position={[0, -BOTTLE_HEIGHT / 2, 0]} dispose={null}>
      {/* soft floor shadow that travels with the bottle */}
      <Shadow ref={shadow} position={[0, 0.002, 0]} scale={[1.1, 0.55, 1]} color="#000000" opacity={0.55} colorStop={0} fog={false} />
      <group ref={spin}>
        <mesh {...part(nodes.Liquid)} material={materials.liquid} renderOrder={1} />
        <Pour color={liquid.uniforms.uColor.value} />
        <group ref={glass}>
          <mesh {...part(nodes.Glass)} material={materials.glass} renderOrder={2} />
        </group>
        <group ref={neck}>
          <mesh {...part(nodes.Collar)} material={materials.metal} />
          <mesh {...part(nodes.Cord)} material={materials.cord} />
          <mesh {...part(nodes.Seal)} material={materials.cord} />
        </group>
        <group ref={cap} position={[0, COLLAR_TOP, 0]}>
          <mesh name="Cap" geometry={capGeometry} material={materials.cap} />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_URL);
