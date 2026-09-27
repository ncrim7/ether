import { lazy, Suspense, useEffect, useLayoutEffect } from 'react';
import { hasWebGL } from './webgl';
import { Loader } from './Loader';
import { CapButton } from './CapButton';
import { Intro, Manifesto, Collection, Notes, Deconstruct, Final } from './sections/Sections';
import { setupScroll, ScrollTrigger } from './animation/scroll';
import { buildChoreography } from './animation/choreography';
import { useQuality } from './hooks/useQuality';
import { variantById } from './data/products';
import { useExperience, type SectionId } from './store/useExperience';

// three.js, R3F and drei load as their own chunk, so the page and loader paint first
const Scene = lazy(() => import('./scene/Scene'));

export default function App() {
  useQuality();
  const variant = variantById(useExperience((s) => s.variant));
  const loaded = useExperience((s) => s.loaded);
  const setSection = useExperience((s) => s.setSection);

  useEffect(() => setupScroll(), []);

  // Track which section fills the middle of the viewport.
  useLayoutEffect(() => {
    const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-section]')).map((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => self.isActive && setSection(el.dataset.section as SectionId),
      }),
    );
    return () => triggers.forEach((t) => t.kill());
  }, [setSection]);

  // Copy marked data-reveal animates in (CSS) while it is on screen, and out again when it leaves.
  useLayoutEffect(() => {
    const triggers = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]')).map((el) =>
      ScrollTrigger.create({ trigger: el, start: 'top 70%', end: 'bottom 30%', toggleClass: 'is-in' }),
    );
    return () => triggers.forEach((t) => t.kill());
  }, []);

  // The scroll timeline measures the layout, so it is rebuilt when the layout changes.
  useLayoutEffect(() => {
    let cleanup = buildChoreography();
    let timer = 0;
    let width = window.innerWidth;
    const onResize = () => {
      // mobile address bars resize the height while scrolling; only a new width changes the layout
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      rebuild();
    };
    const rebuild = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        cleanup();
        ScrollTrigger.refresh();
        cleanup = buildChoreography();
      }, 200);
    };
    window.addEventListener('resize', onResize);
    document.fonts?.ready.then(rebuild);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', onResize);
      cleanup();
    };
  }, []);

  // Variant colors drive the HTML layer through CSS variables.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--bg', variant.colors.background);
    root.setProperty('--text', variant.colors.text);
    root.setProperty('--accent', variant.colors.accent);
    document.documentElement.dataset.tone = variant.tone;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', variant.colors.background);
  }, [variant]);

  // Starts the CSS intro once the loader is gone.
  useEffect(() => {
    document.documentElement.dataset.ready = String(loaded);
  }, [loaded]);

  // Without WebGL the copy, colors and transitions still work; CSS draws a halo in place of the bottle.
  const webgl = hasWebGL();
  useEffect(() => {
    document.documentElement.dataset.webgl = String(webgl);
  }, [webgl]);

  return (
    <>
      {webgl && (
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      )}
      <Loader />
      <main className="content">
        <Intro />
        <Manifesto />
        <Collection />
        <Notes />
        <Deconstruct />
        <Final />
      </main>
      <CapButton />
    </>
  );
}
