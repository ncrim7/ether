import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import { useExperience } from './store/useExperience';

/** How long the loader waits before giving up on WebGL assets and showing the page anyway. */
const TIMEOUT_MS = 10_000;

export function Loader() {
  const { progress, active } = useProgress();
  const loaded = useExperience((s) => s.loaded);
  const setLoaded = useExperience((s) => s.setLoaded);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, []);

  const done = (!active && progress === 100) || timedOut;
  useEffect(() => {
    if (done && !loaded) setLoaded();
  }, [done, loaded, setLoaded]);

  return (
    <div className="loader" data-done={loaded} aria-hidden={loaded}>
      <p className="loader__mark">ÉTHER</p>
      <p className="loader__progress" role="status">
        {Math.round(progress)}%
      </p>
    </div>
  );
}
