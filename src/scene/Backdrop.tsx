import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from '../animation/scroll';
import { variantById } from '../data/products';
import { useExperience } from '../store/useExperience';
import { prefersReducedMotion } from '../hooks/useQuality';
import { fx, pose } from './pose';

/** Classic 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT). */
export const SIMPLEX_3D = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`;

/** How far behind the bottle the backdrop stands, and how large it is (covers any frame). */
const DEPTH = -4;
const SIZE = 30;

/**
 * The scene's background, drawn as an opaque plane so the transmissive glass refracts it:
 * the variant's color, a soft halo of its accent behind the bottle that breathes slowly, and a
 * noisy ring that sweeps outward on a variant change — our take on the Codrops radial noise
 * field (github.com/mohAmineBrs/codrops-noise-transition, MIT).
 */
export function Backdrop() {
  const variant = variantById(useExperience((s) => s.variant));
  const mesh = useRef<THREE.Mesh>(null);
  const first = useRef(variant);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBg: { value: new THREE.Color(first.current.colors.background) },
      uBgDeep: { value: new THREE.Color(first.current.colors.backgroundDeep) },
      uHalo: { value: new THREE.Color(first.current.colors.accent) },
      uHaloStrength: { value: first.current.tone === 'light' ? 0.35 : 0.22 },
      uRing: { value: 0 },
      uRingColor: { value: new THREE.Color(first.current.colors.accent) },
      uCenter: { value: new THREE.Vector2() },
      uIntro: { value: 0 },
    }),
    [],
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms,
        vertexShader: /* glsl */ `
          varying vec2 vWorld;
          void main() {
            vec4 world = modelMatrix * vec4(position, 1.0);
            vWorld = world.xy;
            gl_Position = projectionMatrix * viewMatrix * world;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uBg;
          uniform vec3 uBgDeep;
          uniform vec3 uHalo;
          uniform float uHaloStrength;
          uniform float uRing;
          uniform vec3 uRingColor;
          uniform vec2 uCenter;
          uniform float uIntro;
          varying vec2 vWorld;
          ${SIMPLEX_3D}

          float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

          void main() {
            vec2 p = vWorld - uCenter;
            float r = length(p);

            // vignette: the frame darkens toward its edges
            vec3 color = mix(uBg, uBgDeep, smoothstep(1.2, 5.5, r));

            // halo behind the bottle, slowly breathing, its edge softly broken by noise
            float n = snoise(vec3(p * 0.9, uTime * 0.08)) * 0.18;
            float breath = 0.85 + 0.15 * sin(uTime * 0.6);
            float halo = exp(-pow(r * (0.95 + n), 2.0) * 0.9) * uHaloStrength * breath * uIntro;
            color = mix(color, uHalo, halo);

            // the ring: an expanding band whose inner and outer edges are eaten by noise
            if (uRing > 0.0 && uRing < 1.0) {
              float radius = mix(0.3, 7.5, uRing);
              float width = mix(0.08, 0.6, uRing);
              float edge = snoise(vec3(p * 1.6, uTime * 0.5 + uRing * 2.0)) * 0.3 * width;
              float d = abs(r - radius + edge);
              float band = pow(1.0 - smoothstep(0.0, width, d), 2.0);
              // fine noise breaks the band into filaments instead of a solid smoke ring
              float fine = smoothstep(-0.2, 0.8, snoise(vec3(p * 7.0, uTime * 0.8)));
              float fade = sin(uRing * 3.14159) * (1.0 - uRing * 0.5);
              color = mix(color, uRingColor, band * fine * fade * 0.32);
            }

            // the faintest dither so gradients don't band (the visible film grain is a CSS layer)
            color += (grain(vWorld * 97.0) - 0.5) * 0.004;

            gl_FragColor = vec4(color, 1.0);
            #include <colorspace_fragment>
          }`,
        depthWrite: false,
        toneMapped: false,
      }),
    [uniforms],
  );

  useEffect(() => () => material.dispose(), [material]);

  // Variant colors glide over, in step with the refill. Only the very first run is skipped (the
  // uniforms already hold the first variant) — returning to that variant later must still tween.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const d = prefersReducedMotion() ? 0.3 : 1.2;
    const tl = gsap.timeline({ defaults: { duration: d, ease: 'power2.inOut' } });
    const to = (color: THREE.Color, hex: string) => {
      const c = new THREE.Color(hex);
      tl.to(color, { r: c.r, g: c.g, b: c.b }, 0);
    };
    to(uniforms.uBg.value, variant.colors.background);
    to(uniforms.uBgDeep.value, variant.colors.backgroundDeep);
    to(uniforms.uHalo.value, variant.colors.accent);
    tl.to(uniforms.uHaloStrength, { value: variant.tone === 'light' ? 0.35 : 0.22 }, 0);
    uniforms.uRingColor.value.set(variant.colors.accent);
    return () => void tl.kill();
  }, [variant, uniforms]);

  const ray = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock, camera }) => {
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uRing.value = fx.ring;
    uniforms.uIntro.value = pose.intro;
    // the halo sits exactly behind the bottle: cast the ray camera → bottle onto the backdrop
    ray.set(pose.x, pose.y + 0.05, 0).sub(camera.position);
    const t = (DEPTH - camera.position.z) / ray.z;
    uniforms.uCenter.value.set(camera.position.x + ray.x * t, camera.position.y + ray.y * t);
  });

  return (
    <mesh ref={mesh} position={[0, 0, DEPTH]} material={material} renderOrder={-1} frustumCulled={false}>
      <planeGeometry args={[SIZE, SIZE]} />
    </mesh>
  );
}
