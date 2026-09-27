import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { prefersReducedMotion } from '../hooks/useQuality';

gsap.registerPlugin(ScrollTrigger);

// iOS Safari resizes the viewport when the address bar shows or hides; don't re-pin on that.
ScrollTrigger.config({ ignoreMobileResize: true });

let lenis: Lenis | null = null;

/** Lenis smooth scrolling driven by GSAP's ticker, so ScrollTrigger and Lenis share one clock. */
export function setupScroll(): () => void {
  if (prefersReducedMotion()) return () => {};

  lenis = new Lenis({ lerp: 0.1, autoRaf: false });
  lenis.on('scroll', ScrollTrigger.update);
  const raf = (time: number) => lenis?.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(raf);
    lenis?.destroy();
    lenis = null;
  };
}

export function scrollToSection(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  if (lenis) lenis.scrollTo(target);
  else target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

export { gsap, ScrollTrigger };
