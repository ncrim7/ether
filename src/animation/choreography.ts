import { gsap, ScrollTrigger } from './scroll';
import { pose } from '../scene/pose';

/** The scroll-driven part of the pose. Everything else in `pose` belongs to interactions. */
type ScrollPose = Pick<typeof pose, 'x' | 'y' | 'scale' | 'scrollRot' | 'lift' | 'split'>;

const TURN = Math.PI * 2;
/** Same breakpoint as the CSS and the camera rig. */
const NARROW = 760;

const rest: ScrollPose = { x: 0, y: 0, scale: 1, scrollRot: 0, lift: 0, split: 0 };

interface Anchor {
  /** scroll position in px at which the bottle should hold this pose */
  at: number;
  pose: ScrollPose;
}

const top = (el: Element | null) => (el ? el.getBoundingClientRect().top + window.scrollY : 0);

/**
 * Measures the sections and lists the pose the bottle holds as each one reaches the top of the
 * viewport. On wide screens the bottle moves to the side opposite the copy; on narrow screens the
 * copy sits under the bottle, so it stays centered.
 */
function anchors(): Anchor[] {
  const narrow = window.innerWidth < NARROW;
  const side = narrow ? 0 : 0.45;
  const s = narrow ? 0.92 : 1;
  const vh = window.innerHeight;

  const manifesto = document.getElementById('manifesto');
  const panels = document.querySelectorAll('.collection__panel');
  const notes = document.getElementById('notes');
  const deconstruct = document.getElementById('deconstruct');
  const final = document.getElementById('final');
  const dTop = top(deconstruct);
  const dLen = top(final) - dTop;

  const p = (partial: Partial<ScrollPose>): ScrollPose => ({ ...rest, scale: s, ...partial });
  const threeQuarter = TURN - 0.55;

  return [
    { at: 0, pose: p({}) },
    // manifesto: copy on the left
    { at: top(manifesto), pose: p({ x: side, scale: s * 1.05, scrollRot: 1 }) },
    { at: top(manifesto) + vh, pose: p({ x: side, scale: s * 1.05, scrollRot: 2.2 }) },
    // collection: copy alternates left, right, left
    { at: top(panels[0]), pose: p({ x: side, scrollRot: 3.4 }) },
    { at: top(panels[1]), pose: p({ x: -side, scrollRot: 4.3 }) },
    { at: top(panels[2]), pose: p({ x: side, scrollRot: 5.2 }) },
    // notes: centered, a whole number of turns so each note's angle is exact
    // (narrow: smaller and higher, the note chips and panel fill the lower half)
    { at: top(notes), pose: p({ scale: s * (narrow ? 0.72 : 0.95), y: narrow ? 0.2 : 0, scrollRot: TURN }) },
    // deconstruct: three-quarter view, cap off, glass slides left off the liquid, reassemble.
    // The bottle sits a little right and low so the glass lands under the title, clear of the labels.
    ...(() => {
      const d = p({ x: side * 0.25, y: narrow ? -0.12 : -0.06, scale: s * (narrow ? 0.72 : 0.9), scrollRot: threeQuarter });
      const split = narrow ? 0.5 : 0.9;
      // keeps the liquid + glass pair centered once the glass has moved
      const x = narrow ? split / 2 : side * 0.55;
      return [
        { at: dTop, pose: d },
        { at: dTop + dLen * 0.3, pose: { ...d, lift: 1 } },
        { at: dTop + dLen * 0.55, pose: { ...d, x, lift: 1, split } },
        { at: dTop + dLen * 0.8, pose: { ...d, x, lift: 1, split, scrollRot: threeQuarter + 0.3 } },
      ];
    })(),
    // final: whole again, opposite the copy (narrow: above it)
    { at: top(final), pose: p({ x: side * 1.1, scale: s * 0.92, scrollRot: TURN * 2 }) },
  ];
}

/** Builds the page-long scrubbed timeline. Returns a cleanup. Rebuilt on resize. */
export function buildChoreography(): () => void {
  const list = anchors();
  const tl = gsap.timeline({ paused: true });
  tl.set(pose, list[0].pose, 0);
  for (let i = 1; i < list.length; i++) {
    const from = list[i - 1];
    const to = list[i];
    const duration = Math.max(1, to.at - from.at);
    tl.fromTo(pose, { ...from.pose }, { ...to.pose, duration, ease: 'power2.inOut', immediateRender: false }, from.at);
  }
  // hold the final pose to the end of the page
  const end = document.documentElement.scrollHeight - window.innerHeight;
  const last = list[list.length - 1];
  if (end > last.at) tl.to({}, { duration: end - last.at }, last.at);

  const trigger = ScrollTrigger.create({ animation: tl, start: 0, end: 'max', scrub: 0.8 });
  return () => {
    trigger.kill();
    tl.kill();
  };
}
