import { Fragment, useEffect, useLayoutEffect, type CSSProperties } from 'react';
import { layerLabel, variantById, variants, type VariantId } from '../data/products';
import { useExperience } from '../store/useExperience';
import { scrollToSection, ScrollTrigger } from '../animation/scroll';

/** Splits text into spans so CSS can stagger them; the real text stays readable to screen readers. */
function Split({ text, by }: { text: string; by: 'char' | 'word' }) {
  const parts = by === 'char' ? Array.from(text) : text.split(' ');
  return (
    <>
      <span className="sr-only">{text}</span>
      <span className="split" aria-hidden="true">
        {parts.map((part, i) => (
          <Fragment key={i}>
            <span className="split__mask">
              <span className="split__item" style={{ '--i': i } as CSSProperties}>
                {part}
              </span>
            </span>
            {/* outside the inline-block mask, or the space collapses */}
            {by === 'word' && i < parts.length - 1 ? ' ' : null}
          </Fragment>
        ))}
      </span>
    </>
  );
}

export function Intro() {
  return (
    <section id="intro" className="section section--intro" data-section="intro">
      <div className="intro__title">
        <p className="eyebrow intro__eyebrow">Maison ÉTHER</p>
        <h1 className="display intro__name">
          <Split text="ÉTHER" by="char" />
        </h1>
        <p className="lede intro__lede">The Architecture of Scent</p>
      </div>
      <button className="scroll-cue" type="button" onClick={() => scrollToSection('manifesto')}>
        Scroll to discover
        <span className="scroll-cue__line" aria-hidden="true" />
      </button>
    </section>
  );
}

export function Manifesto() {
  return (
    <section id="manifesto" className="section section--manifesto" data-section="manifesto">
      <div className="manifesto__line" data-reveal>
        <h2 className="headline">
          <Split text="A fragrance cannot be seen." by="word" />
        </h2>
      </div>
      <div className="manifesto__line" data-reveal>
        <h2 className="headline">
          <Split text="So we built it in layers." by="word" />
        </h2>
      </div>
    </section>
  );
}

export function Collection() {
  const setVariant = useExperience((s) => s.setVariant);

  // Scrolling through the collection changes the variant: the panel at the middle of the screen wins.
  useLayoutEffect(() => {
    const triggers = Array.from(document.querySelectorAll<HTMLElement>('.collection__panel')).map((panel) =>
      ScrollTrigger.create({
        trigger: panel,
        start: 'top center',
        end: 'bottom center',
        onToggle: (self) => self.isActive && setVariant(panel.dataset.variant as VariantId),
      }),
    );
    return () => triggers.forEach((t) => t.kill());
  }, [setVariant]);

  return (
    <section id="collection" className="section section--collection" data-section="collection">
      {variants.map((v) => (
        <article key={v.id} className="collection__panel" data-variant={v.id} data-reveal aria-labelledby={`variant-${v.id}`}>
          <p className="eyebrow">{v.index} / 03</p>
          <h2 id={`variant-${v.id}`} className="display display--md">
            <Split text={v.name} by="char" />
          </h2>
          <p className="lede reveal-fade">{v.tagline}</p>
          <p className="body reveal-fade">{v.description}</p>
        </article>
      ))}
    </section>
  );
}

export function Notes() {
  const variant = variantById(useExperience((s) => s.variant));
  const activeNote = useExperience((s) => s.activeNote);
  const toggleNote = useExperience((s) => s.toggleNote);
  const clearNote = useExperience((s) => s.clearNote);
  const note = variant.notes.find((n) => n.id === activeNote) ?? null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && clearNote();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clearNote]);

  return (
    <section id="notes" className="section section--notes" data-section="notes">
      <header className="notes__header">
        <p className="eyebrow">{variant.name} — Composition</p>
        <h2 className="headline">Choose a note.</h2>
      </header>
      <ul className="notes__list">
        {variant.notes.map((n) => (
          <li key={n.id}>
            <button type="button" className="note-button" aria-pressed={activeNote === n.id} onClick={() => toggleNote(n.id)}>
              <span className="note-button__layer">{layerLabel[n.layer]}</span>
              <span className="note-button__name">{n.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="note-panel" aria-live="polite">
        {note && (
          // keyed so the entrance animation replays for every note
          <div key={note.id} className="note-panel__inner">
            <p className="eyebrow">{layerLabel[note.layer]}</p>
            <h3 className="headline headline--sm">{note.name}</h3>
            <p className="note-panel__adjectives">{note.adjectives.join(' · ')}</p>
            <p className="body">{note.line}</p>
          </div>
        )}
      </div>
    </section>
  );
}

const layers = [
  { id: 'cap', title: 'Cap', detail: 'Brushed metal, turned on a lathe.' },
  { id: 'glass', title: 'Glass', detail: 'Optically clear, heavy-walled crystal.' },
  { id: 'formula', title: 'The formula', detail: '50 ml, macerated for eight weeks.' },
  { id: 'scent', title: 'The scent', detail: 'Top, heart and base, built to unfold in that order.' },
];

export function Deconstruct() {
  return (
    <section id="deconstruct" className="section section--deconstruct" data-section="deconstruct">
      <h2 className="headline deconstruct__title">Built in layers.</h2>
      <ol className="deconstruct__layers">
        {layers.map((l) => (
          <li key={l.id} className="deconstruct__layer" data-layer={l.id} data-reveal>
            <p className="eyebrow">{l.title}</p>
            <p className="body">{l.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Final() {
  const current = useExperience((s) => s.variant);
  const setVariant = useExperience((s) => s.setVariant);

  return (
    <section id="final" className="section section--final" data-section="final">
      <h2 className="display display--md" data-reveal>
        <Split text="Define your presence." by="word" />
      </h2>
      <div className="final__picker" role="group" aria-label="Choose a fragrance">
        {variants.map((v) => (
          <button key={v.id} type="button" className="pill" aria-pressed={current === v.id} onClick={() => setVariant(v.id)}>
            {v.name}
          </button>
        ))}
      </div>
      <footer className="footer">
        <p>ÉTHER is a fictional brand, made as a design study.</p>
        <p>
          Bottle based on{' '}
          <a href="https://sketchfab.com/3d-models/05-parfum-c6de4b728fb74cddaa5ca1e156e45c17" target="_blank" rel="noreferrer">
            “05 Parfum”
          </a>{' '}
          by pedrofbfranca, licensed{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          , modified.
        </p>
        <button type="button" className="link-button" onClick={() => scrollToSection('intro')}>
          Back to top
        </button>
      </footer>
    </section>
  );
}
