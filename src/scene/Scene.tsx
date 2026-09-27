import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, PerformanceMonitor } from '@react-three/drei';
import { variantById } from '../data/products';
import { useExperience } from '../store/useExperience';
import { qualitySettings } from '../hooks/useQuality';
import { Perfume } from './Perfume';
import { Lights } from './Lights';
import { CameraRig } from './CameraRig';

const stepDown = { high: 'medium', medium: 'low', low: 'low' } as const;

export function Scene() {
  const quality = useExperience((s) => s.quality);
  const setQuality = useExperience((s) => s.setQuality);
  const variant = variantById(useExperience((s) => s.variant));
  const settings = qualitySettings[quality];

  return (
    <div className="scene" aria-hidden="true">
      <Canvas
        dpr={settings.dpr}
        gl={{ antialias: settings.antialias, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.15, 3.2], fov: 30, near: 0.1, far: 50 }}
        onCreated={({ gl }) => {
          gl.transmissionResolutionScale = settings.transmissionResolution;
        }}
      >
        <color attach="background" args={[variant.colors.background]} />
        <PerformanceMonitor onDecline={() => setQuality(stepDown[quality])} />
        <CameraRig />
        <Lights />
        <Suspense fallback={null}>
          <Perfume />
          {/* inside Suspense so its single frame is rendered after the bottle exists */}
          <ContactShadows position={[0, -0.7, 0]} opacity={0.5} scale={3} blur={2.5} far={1} frames={1} />
        </Suspense>
      </Canvas>
    </div>
  );
}
