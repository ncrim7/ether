import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { pour, STREAM_TOP } from './pose';

const STREAM_RADIUS = 0.034;
const BUBBLES = 48;
/** Bubbles are spawned inside this footprint (bottle units), the liquid's inner width and depth. */
const SPREAD = { x: 0.34, z: 0.13 };
const WHITE = new THREE.Color('#ffffff');

interface Bubble {
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
  phase: number;
  alive: boolean;
}

/**
 * The refill: a stream of perfume falling through the neck, and bubbles rising through the
 * liquid while it pours. Lives in bottle space (inside the spinning group); the stream runs along
 * the bottle's axis, so the spin doesn't move it.
 */
export function Pour({ color }: { color: THREE.Color }) {
  const stream = useRef<THREE.Mesh>(null);
  const bubbles = useRef<THREE.InstancedMesh>(null);

  const streamGeometry = useMemo(() => {
    // a unit cylinder standing on y = 0, scaled every frame to span the stream
    const g = new THREE.CylinderGeometry(1, 1, 1, 20, 48, true);
    g.translate(0, 0.5, 0);
    return g;
  }, []);

  const streamUniforms = useMemo(() => ({ uTime: { value: 0 }, uLength: { value: 1 } }), []);

  const streamMaterial = useMemo(() => {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.4 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, streamUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uLength;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          // bulges travelling down the stream, as a real pour pulses and necks
          float along = position.y * uLength;
          float pulse = sin(along * 38.0 + uTime * 42.0) * 0.07 + sin(along * 91.0 + uTime * 71.0) * 0.035;
          // slightly thicker at the top, thinning as it accelerates
          float taper = mix(0.8, 1.15, position.y);
          transformed.xz *= taper * (1.0 + pulse);`,
        );
    };
    m.customProgramCacheKey = () => 'ether-pour-stream';
    return m;
  }, [color, streamUniforms]);

  const bubbleGeometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const bubbleMaterial = useMemo(
    // opaque on purpose: transparent objects don't show through transmissive glass
    () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, metalness: 0, emissive: '#ffffff', emissiveIntensity: 0.15 }),
    [],
  );

  const pool = useMemo<Bubble[]>(
    () => Array.from({ length: BUBBLES }, () => ({ x: 0, y: 0, z: 0, speed: 0, size: 0, phase: 0, alive: false })),
    [],
  );

  useEffect(
    () => () => {
      streamGeometry.dispose();
      streamMaterial.dispose();
      bubbleGeometry.dispose();
      bubbleMaterial.dispose();
    },
    [streamGeometry, streamMaterial, bubbleGeometry, bubbleMaterial],
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const spawnClock = useRef(0);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const level = pour.level;

    // --- stream ---
    if (stream.current) {
      const bottom = THREE.MathUtils.lerp(STREAM_TOP, level, pour.head);
      const top = THREE.MathUtils.lerp(STREAM_TOP, level, pour.tail);
      const length = top - bottom;
      const visible = pour.head > 0 && length > 0.002;
      stream.current.visible = visible;
      if (visible) {
        stream.current.position.set(0, bottom, 0);
        stream.current.scale.set(STREAM_RADIUS, length, STREAM_RADIUS);
        streamUniforms.uLength.value = length;
        streamUniforms.uTime.value = t;
      }
    }

    // --- bubbles: born near the bottom while pouring, rise, pop at the surface ---
    const pouring = pour.head >= 1 && pour.tail < 1;
    spawnClock.current += dt * (pouring ? 60 * pour.agitation : 0);
    while (spawnClock.current >= 1) {
      spawnClock.current -= 1;
      const b = pool.find((p) => !p.alive);
      if (!b) break;
      // most rise from under the stream, some from anywhere in the liquid
      const near = Math.random() < 0.65;
      b.x = (Math.random() - 0.5) * (near ? 0.08 : SPREAD.x * 2);
      b.z = (Math.random() - 0.5) * (near ? 0.05 : SPREAD.z * 2);
      b.y = 0.04 + Math.random() * Math.max(0.02, level * 0.5);
      b.speed = 0.25 + Math.random() * 0.35;
      b.size = 0.004 + Math.random() * 0.009;
      b.phase = Math.random() * Math.PI * 2;
      b.alive = true;
    }

    const mesh = bubbles.current;
    if (!mesh) return;
    for (let i = 0; i < pool.length; i++) {
      const b = pool[i];
      if (b.alive) {
        b.y += b.speed * dt;
        // pop just below the surface
        if (b.y > level - b.size) b.alive = false;
      }
      const s = b.alive ? b.size : 0;
      dummy.position.set(b.x + Math.sin(t * 6 + b.phase) * 0.006, b.y, b.z + Math.cos(t * 5 + b.phase) * 0.004);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    // the liquid's color is a live object that changes per variant: follow it
    streamMaterial.color.copy(color);
    bubbleMaterial.color.copy(tint.copy(color).lerp(WHITE, 0.7));
  });

  return (
    <>
      <mesh ref={stream} geometry={streamGeometry} material={streamMaterial} visible={false} renderOrder={1} />
      <instancedMesh ref={bubbles} args={[bubbleGeometry, bubbleMaterial, BUBBLES]} frustumCulled={false} renderOrder={1} />
    </>
  );
}
