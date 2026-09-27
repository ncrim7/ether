import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { gsap } from '../animation/scroll';
import { variantById } from '../data/products';
import { useExperience } from '../store/useExperience';
import { prefersReducedMotion } from '../hooks/useQuality';
import { pose } from './pose';

const KEY = 1.6;
const RIM_LEFT = 25;
const RIM_RIGHT = 20;

/**
 * A procedural studio: soft boxes baked into an environment map (reflections on glass and metal)
 * plus a key light and two colored rim lights. No HDR download needed. Colors glide between
 * variants; brightness follows the intro so the bottle is lit out of the dark.
 */
export function Lights() {
  const variant = variantById(useExperience((s) => s.variant));
  const scene = useThree((s) => s.scene);
  const key = useRef<THREE.DirectionalLight>(null);
  const rimL = useRef<THREE.SpotLight>(null);
  const rimR = useRef<THREE.SpotLight>(null);
  const level = useRef({ strength: variant.lights.intensity });
  const background = useRef(new THREE.Color(variant.colors.background));
  // colors are set once from the first variant, then only tweened (a color prop would snap them)
  const initial = useRef(variant.lights).current;

  useEffect(() => {
    scene.background = background.current;
  }, [scene]);

  useEffect(() => {
    if (!key.current || !rimL.current || !rimR.current) return;
    const d = prefersReducedMotion() ? 0.3 : 1.1;
    const tl = gsap.timeline({ defaults: { duration: d, ease: 'power2.inOut' } });
    const to = (color: THREE.Color, hex: string) => {
      const c = new THREE.Color(hex);
      tl.to(color, { r: c.r, g: c.g, b: c.b }, 0);
    };
    to(key.current.color, variant.lights.key);
    to(rimL.current.color, variant.lights.rim);
    to(rimR.current.color, variant.lights.rim);
    to(background.current, variant.colors.background);
    tl.to(level.current, { strength: variant.lights.intensity }, 0);
    return () => void tl.kill();
  }, [variant]);

  useFrame(() => {
    if (!key.current || !rimL.current || !rimR.current) return;
    // the rims come up a little after the key light, which reads as a light being switched on
    const intro = pose.intro;
    const s = level.current.strength;
    scene.environmentIntensity = 0.1 + 0.9 * intro;
    key.current.intensity = KEY * s * intro;
    rimL.current.intensity = RIM_LEFT * s * Math.max(0, intro * 1.4 - 0.4);
    rimR.current.intensity = RIM_RIGHT * s * Math.max(0, intro * 1.4 - 0.4);
  });

  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={1.6} color="#ffffff" position={[0, 4, 2]} rotation-x={Math.PI / 2} scale={[4, 2, 1]} />
        {/* tall, narrow strips give the glass thin vertical highlights instead of a flat sheen */}
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[-3, 1, 1]} rotation-y={Math.PI / 2} scale={[0.4, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#ffffff" position={[3, 1, 1]} rotation-y={-Math.PI / 2} scale={[0.4, 4, 1]} />
        <Lightformer form="ring" intensity={1} color="#ffffff" position={[0, 1, -4]} scale={2} />
      </Environment>
      <ambientLight intensity={0.15} />
      <directionalLight ref={key} position={[1.5, 3, 3]} intensity={0} color={initial.key} />
      <spotLight ref={rimL} position={[-2.5, 1.5, -2]} angle={0.5} penumbra={1} intensity={0} color={initial.rim} />
      <spotLight ref={rimR} position={[2.5, 1.2, -2]} angle={0.5} penumbra={1} intensity={0} color={initial.rim} />
    </>
  );
}
