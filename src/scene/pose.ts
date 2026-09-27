/**
 * The bottle's pose as plain numbers. GSAP tweens these (scroll timeline, variant transition,
 * cap, note focus, intro) and Perfume reads them every frame. Keeping animation state out of
 * React means no re-renders while things move, and independent animations simply add up.
 */
export const pose = {
  /** 0 = hidden below and dark (before the intro), 1 = in place */
  intro: 0,

  // --- scroll timeline ---
  x: 0,
  y: 0,
  scale: 1,
  /** radians, added to the idle spin */
  scrollRot: 0,
  /** 0..1 cap and collar lifted off (deconstruct) */
  lift: 0,
  /** 0..1 glass slid away from the liquid (deconstruct) */
  split: 0,

  // --- interactions ---
  /** 0..1 cap unscrewed by the cap button */
  capOpen: 0,
  /** radians, accumulates half a turn per variant change */
  variantSpin: 0,
  /** radians, turns the chosen note's side toward the camera */
  noteRot: 0,
  /** radians, tips the bottle toward or away from the camera for the chosen note */
  noteTilt: 0,
  /** scale factor from the chosen note's camera distance */
  noteZoom: 1,
};

export type Pose = typeof pose;

/** Refill state, tweened by the variant transition and read by the liquid and the stream. */
export const pour = {
  /** 0 = empty, 1 = full */
  fill: 1,
  /** 0..1 how far the stream's leading end has fallen from the top toward the surface */
  head: 0,
  /** 0..1 how far the stream's trailing end has fallen (1 = the stream is gone) */
  tail: 0,
  /** 0..1 ripples, foam and bubbles */
  agitation: 0,
  /** 0..1 cap unscrewed and moved aside so the stream can reach the neck */
  capAside: 0,
  /** current surface height in bottle units, written by Perfume each frame */
  level: 0,
};

/** Where the stream starts: above the top of the frame, in bottle units. */
export const STREAM_TOP = 2.8;

/** Idle spin speed in radians per second (one turn every 24 s). */
export const IDLE_SPIN = (Math.PI * 2) / 24;
