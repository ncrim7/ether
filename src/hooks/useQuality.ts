import { useEffect } from 'react';
import { useExperience, type Quality } from '../store/useExperience';

// Initial guess only; drei's PerformanceMonitor can step it down at runtime.
export function detectQuality(): Quality {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  if (cores <= 4 || memory <= 3) return 'low';
  if (coarse || window.innerWidth < 900) return 'medium';
  return 'high';
}

export function useQuality() {
  const setQuality = useExperience((s) => s.setQuality);
  useEffect(() => setQuality(detectQuality()), [setQuality]);
  return useExperience((s) => s.quality);
}

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const qualitySettings = {
  high: { dpr: [1, 2] as [number, number], transmission: true, transmissionResolution: 1, particles: 1, antialias: true },
  medium: { dpr: [1, 1.5] as [number, number], transmission: true, transmissionResolution: 0.5, particles: 0.5, antialias: true },
  low: { dpr: [1, 1] as [number, number], transmission: false, transmissionResolution: 0.25, particles: 0.25, antialias: false },
} satisfies Record<Quality, unknown>;
