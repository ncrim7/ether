import { useEffect, useLayoutEffect } from 'react';
import { Scene } from './scene/Scene';
import { Loader } from './Loader';
import { Intro, Manifesto, Collection, Notes, Deconstruct, Final } from './sections/Sections';
import { setupScroll, ScrollTrigger } from './animation/scroll';
import { useQuality } from './hooks/useQuality';
import { variantById } from './data/products';
import { useExperience, type SectionId } from './store/useExperience';

export default function App() {
  useQuality();
  const variant = variantById(useExperience((s) => s.variant));
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

  // Variant colors drive the HTML layer through CSS variables.
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--bg', variant.colors.background);
    root.setProperty('--text', variant.colors.text);
    root.setProperty('--accent', variant.colors.accent);
    document.documentElement.dataset.tone = variant.tone;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', variant.colors.background);
  }, [variant]);

  return (
    <>
      <Scene />
      <Loader />
      <main className="content">
        <Intro />
        <Manifesto />
        <Collection />
        <Notes />
        <Deconstruct />
        <Final />
      </main>
    </>
  );
}
