import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useExperience } from './store/useExperience';
import { prefersReducedMotion } from './hooks/useQuality';
import { hasWebGL } from './webgl';

/** How long the loader waits before giving up on WebGL assets and showing the page anyway. */
const TIMEOUT_MS = 10_000;
/** The counter never runs faster than this, so even a cached load reads as a deliberate opening. */
const MIN_COUNT_MS = 2200;

export function Loader() {
  // reported by the 3D scene, which loads as a separate chunk; without WebGL there is nothing to wait for
  const progress = useExperience((s) => s.loadProgress);
  const loaded = useExperience((s) => s.loaded);
  const setLoaded = useExperience((s) => s.setLoaded);
  const [shown, setShown] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const real = useRef(0);
  real.current = hasWebGL() ? progress : 100;

  useEffect(() => {
    const id = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, []);

  // The shown number eases toward the real one, capped at 100% per MIN_COUNT_MS.
  useEffect(() => {
    const minMs = prefersReducedMotion() ? 300 : MIN_COUNT_MS;
    let raf = 0;
    let last = performance.now();
    let value = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const target = timedOut ? 100 : real.current;
      // time-based (not per-frame) easing, so a slow device doesn't also mean a slow counter
      const eased = target - (target - value) * Math.exp(-dt / 180);
      value = Math.min(eased, value + (100 / minMs) * dt);
      if (target - value < 0.5) value = target;
      setShown(value);
      if (value < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timedOut]);

  // Hold the full mark for a beat before the curtain lifts.
  useEffect(() => {
    if (shown < 100 || loaded) return;
    const id = window.setTimeout(setLoaded, prefersReducedMotion() ? 0 : 450);
    return () => window.clearTimeout(id);
  }, [shown, loaded, setLoaded]);

  return (
    <div className="loader" data-done={loaded} aria-hidden={loaded} style={{ '--p': shown / 100 } as CSSProperties}>
      <p className="loader__mark">
        <span className="loader__mark-base">ÉTHER</span>
        <span className="loader__mark-fill" aria-hidden="true">
          ÉTHER
        </span>
      </p>
      <div className="loader__bar" aria-hidden="true" />
      <p className="loader__progress" role="status">
        {String(Math.floor(shown)).padStart(3, '0')}
      </p>
    </div>
  );
}
