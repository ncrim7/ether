import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useExperience } from '../store/useExperience';
import { forcedQuality, qualitySettings } from '../hooks/useQuality';
import { Perfume } from './Perfume';
import { Lights } from './Lights';
import { CameraRig } from './CameraRig';

const stepDown = { high: 'medium', medium: 'low', low: 'low' } as const;

/** Keeps renderer settings that can't be props in step with the quality tier. */
function QualitySync() {
  const gl = useThree((s) => s.gl);
  const quality = useExperience((s) => s.quality);
  useEffect(() => {
    gl.transmissionResolutionScale = qualitySettings[quality].transmissionResolution;
  }, [gl, quality]);
  return null;
}

export function Scene() {
  const quality = useExperience((s) => s.quality);
  const setQuality = useExperience((s) => s.setQuality);
  const settings = qualitySettings[quality];

  return (
    <div className="scene" aria-hidden="true">
      <Canvas
        dpr={settings.dpr}
        gl={{ antialias: settings.antialias, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.15, 3.2], fov: 30, near: 0.1, far: 50 }}
      >
        {!forcedQuality() && <PerformanceMonitor onDecline={() => setQuality(stepDown[quality])} />}
        <QualitySync />
        <CameraRig />
        <Lights />
        <Suspense fallback={null}>
          <Perfume />
        </Suspense>
      </Canvas>
    </div>
  );
}
