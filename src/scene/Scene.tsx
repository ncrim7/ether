import { Suspense, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { PerformanceMonitor, useProgress } from '@react-three/drei';
import { useExperience } from '../store/useExperience';
import { forcedQuality, qualitySettings } from '../hooks/useQuality';
import { Perfume } from './Perfume';
import { Lights } from './Lights';
import { CameraRig } from './CameraRig';
import { Backdrop } from './Backdrop';
import { Particles } from './Particles';

const stepDown = { high: 'medium', medium: 'low', low: 'low' } as const;

/** Hands asset-loading progress to the loader, which lives outside this lazily loaded chunk. */
function ProgressReporter() {
  const { progress, active } = useProgress();
  const setLoadProgress = useExperience((s) => s.setLoadProgress);
  useEffect(() => setLoadProgress(!active && progress === 100 ? 100 : Math.min(progress, 99)), [progress, active, setLoadProgress]);
  return null;
}

/** Keeps renderer settings that can't be props in step with the quality tier. */
function QualitySync() {
  const gl = useThree((s) => s.gl);
  const quality = useExperience((s) => s.quality);
  useEffect(() => {
    gl.transmissionResolutionScale = qualitySettings[quality].transmissionResolution;
  }, [gl, quality]);
  return null;
}

// default export so the app can load the whole 3D stack as a separate chunk (React.lazy)
export default function Scene() {
  const quality = useExperience((s) => s.quality);
  const setQuality = useExperience((s) => s.setQuality);
  const settings = qualitySettings[quality];

  return (
    <div className="scene" aria-hidden="true">
      <ProgressReporter />
      <Canvas
        dpr={settings.dpr}
        gl={{ antialias: settings.antialias, powerPreference: 'high-performance' }}
        camera={{ position: [0, 0.15, 3.2], fov: 30, near: 0.1, far: 50 }}
      >
        {!forcedQuality() && <PerformanceMonitor onDecline={() => setQuality(stepDown[quality])} />}
        <QualitySync />
        <CameraRig />
        <Backdrop />
        <Particles />
        <Lights />
        <Suspense fallback={null}>
          <Perfume />
        </Suspense>
      </Canvas>
    </div>
  );
}
