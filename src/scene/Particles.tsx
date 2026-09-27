import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from '../animation/scroll';
import { variantById } from '../data/products';
import { useExperience } from '../store/useExperience';
import { prefersReducedMotion, qualitySettings } from '../hooks/useQuality';

/** The volume particles live in (world units), wrapping around at its faces. */
const BOX_MIN = new THREE.Vector3(-2.6, -1.8, -3);
const BOX_SIZE = new THREE.Vector3(5.2, 3.6, 4.2);
const MAX_COUNT = 1500;

/**
 * The variant's atmosphere: violet dust (NOIR), rising motes (AURA), flickering sparks (EMBER).
 * One Points object, one draw call. Drift is integrated here rather than in the shader
 * (position = start + drift * time) so a change of direction or speed never makes them jump.
 * Picking a note tints and re-paces them to that note.
 */
export function Particles() {
  const variant = variantById(useExperience((s) => s.variant));
  const quality = useExperience((s) => s.quality);
  const activeNote = useExperience((s) => s.activeNote);
  const dpr = useThree((s) => s.viewport.dpr);
  const points = useRef<THREE.Points>(null);
  const first = useRef(variant);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const start = new Float32Array(MAX_COUNT * 3);
    const seed = new Float32Array(MAX_COUNT);
    const scale = new Float32Array(MAX_COUNT);
    for (let i = 0; i < MAX_COUNT; i++) {
      start[i * 3] = BOX_MIN.x + Math.random() * BOX_SIZE.x;
      start[i * 3 + 1] = BOX_MIN.y + Math.random() * BOX_SIZE.y;
      start[i * 3 + 2] = BOX_MIN.z + Math.random() * BOX_SIZE.z;
      seed[i] = Math.random();
      // mostly fine dust, a few larger specks
      scale[i] = 0.4 + Math.pow(Math.random(), 3) * 1.8;
    }
    g.setAttribute('position', new THREE.BufferAttribute(start, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    return g;
  }, []);

  const state = useRef({
    offset: new THREE.Vector3(),
    drift: new THREE.Vector3(...first.current.atmosphere.drift),
    pace: 1,
  });

  const uniforms = useMemo(() => {
    const a = first.current.atmosphere;
    return {
      uTime: { value: 0 },
      uOffset: { value: new THREE.Vector3() },
      uBoxMin: { value: BOX_MIN.clone() },
      uBoxSize: { value: BOX_SIZE.clone() },
      uColor: { value: new THREE.Color(a.particleColor) },
      uSize: { value: a.size },
      uFlicker: { value: a.flicker },
      uOpacity: { value: a.opacity },
      uPixelRatio: { value: 1 },
      uScroll: { value: 0 },
    };
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          attribute float aSeed;
          attribute float aScale;
          uniform float uTime;
          uniform vec3 uOffset;
          uniform vec3 uBoxMin;
          uniform vec3 uBoxSize;
          uniform float uSize;
          uniform float uPixelRatio;
          uniform float uScroll;
          varying float vSeed;
          varying float vDepth;

          void main() {
            // nearer particles drift faster and scroll further: depth parallax
            float depth = (position.z - uBoxMin.z) / uBoxSize.z;
            vec3 p = position + uOffset * mix(0.6, 1.4, depth);
            p.y += uScroll * mix(0.3, 1.2, depth);
            // a lazy sway so no two particles move in lockstep
            p.x += sin(uTime * 0.35 + aSeed * 40.0) * 0.06;
            p.z += cos(uTime * 0.28 + aSeed * 23.0) * 0.05;
            p = mod(p - uBoxMin, uBoxSize) + uBoxMin;

            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uSize * aScale * uPixelRatio * 18.0 / -mv.z;
            vSeed = aSeed;
            vDepth = depth;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uFlicker;
          uniform float uOpacity;
          varying float vSeed;
          varying float vDepth;

          void main() {
            float d = length(gl_PointCoord - 0.5);
            // bright core, soft glow
            float core = smoothstep(0.5, 0.0, d);
            float alpha = pow(core, 1.8);
            // sparks flicker at their own rate
            float flick = 0.55 + 0.45 * sin(uTime * (7.0 + vSeed * 9.0) + vSeed * 50.0);
            alpha *= mix(1.0, flick, uFlicker);
            // sparks run from yellow-hot to the variant's color
            vec3 color = mix(uColor, vec3(1.0, 0.85, 0.45), uFlicker * vSeed * 0.6);
            // far particles are fainter, like dust out of focus
            alpha *= uOpacity * mix(0.35, 1.0, vDepth);
            if (alpha < 0.003) discard;
            gl_FragColor = vec4(color, alpha);
            #include <colorspace_fragment>
          }`,
        transparent: true,
        depthWrite: false,
        blending: first.current.tone === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending,
      }),
    [uniforms],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // How many particles this device draws.
  useEffect(() => {
    const { high, low } = variant.atmosphere.count;
    const share = qualitySettings[quality].particles;
    geometry.setDrawRange(0, Math.min(MAX_COUNT, Math.round(quality === 'low' ? low : high * share)));
  }, [geometry, quality, variant]);

  // Variant: glide to the new color, direction, size and character. Note: tint and re-pace.
  useEffect(() => {
    const a = variant.atmosphere;
    const note = variant.notes.find((n) => n.id === activeNote);
    const d = prefersReducedMotion() ? 0.3 : 1.2;
    const color = new THREE.Color(note ? note.particle.color : a.particleColor);
    const tl = gsap.timeline({ defaults: { duration: d, ease: 'power2.inOut' } });
    tl.to(uniforms.uColor.value, { r: color.r, g: color.g, b: color.b }, 0);
    tl.to(uniforms.uSize, { value: a.size * (note ? note.particle.size : 1) }, 0);
    tl.to(uniforms.uFlicker, { value: a.flicker }, 0);
    tl.to(uniforms.uOpacity, { value: a.opacity }, 0);
    tl.to(state.current.drift, { x: a.drift[0], y: a.drift[1], z: a.drift[2] }, 0);
    tl.to(state.current, { pace: note ? note.particle.speed * 1.6 : 1 }, 0);
    // blending can't be tweened: switch it at the midpoint, when the particles are faintest
    const blending = variant.tone === 'light' ? THREE.NormalBlending : THREE.AdditiveBlending;
    if (material.blending !== blending) {
      tl.to(uniforms.uOpacity, { value: 0, duration: d / 2 }, 0);
      tl.call(() => {
        material.blending = blending;
        material.needsUpdate = true;
      }, undefined, d / 2);
      tl.to(uniforms.uOpacity, { value: a.opacity, duration: d / 2 }, d / 2);
    }
    return () => void tl.kill();
  }, [variant, activeNote, uniforms, material]);

  const still = useMemo(prefersReducedMotion, []);
  useFrame(({ clock }, delta) => {
    const s = state.current;
    if (!still) s.offset.addScaledVector(s.drift, Math.min(delta, 0.05) * s.pace);
    uniforms.uOffset.value.copy(s.offset);
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uPixelRatio.value = dpr;
    uniforms.uScroll.value = window.scrollY / window.innerHeight * 0.35;
  });

  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} />;
}
