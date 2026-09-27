import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { gsap } from '../animation/scroll';
import { layerLabel, variantById, type Variant } from '../data/products';
import { useExperience } from '../store/useExperience';

// The glass body's flat faces sit at z = ±0.187 (bottle units); prints go just outside them.
const FACE_Z = 0.1885;
const WIDTH = 0.56;
const HEIGHT = 0.46;
const CENTER_Y = 0.44;
const CANVAS_W = 1024;
const CANVAS_H = Math.round((CANVAS_W * HEIGHT) / WIDTH);

const DISPLAY = '"Cormorant Garamond", "Times New Roman", serif';
const BODY = 'Manrope, system-ui, sans-serif';

/** Text drawn one glyph at a time, so letter-spacing works in every browser. */
function tracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number) {
  const widths = Array.from(text).map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (widths.length - 1);
  let cx = x - total / 2;
  Array.from(text).forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
}

function surface() {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { canvas, ctx: canvas.getContext('2d')!, texture };
}

type Surface = ReturnType<typeof surface>;

/** Front: the brand, the scent, the size — screen-printed straight onto the glass. */
function drawFront({ ctx, texture }: Surface, v: Variant) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = v.colors.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const cx = CANVAS_W / 2;

  ctx.font = `500 50px ${BODY}`;
  ctx.globalAlpha = 0.85;
  tracked(ctx, 'ÉTHER', cx, 110, 30);

  ctx.globalAlpha = 0.5;
  ctx.fillRect(cx - 50, 150, 100, 3);

  ctx.globalAlpha = 0.95;
  ctx.font = `300 270px ${DISPLAY}`;
  tracked(ctx, v.name, cx, 400, 16);

  ctx.globalAlpha = 0.8;
  ctx.font = `500 42px ${BODY}`;
  tracked(ctx, 'EAU DE PARFUM', cx, 510, 16);
  ctx.globalAlpha = 0.55;
  ctx.font = `400 34px ${BODY}`;
  tracked(ctx, `Nº ${v.index} · 50 ML`, cx, 575, 10);
  ctx.globalAlpha = 1;
  texture.needsUpdate = true;
}

function noteRows(v: Variant) {
  const top = 120;
  const step = (CANVAS_H - top - 70) / v.notes.length;
  return v.notes.map((n, i) => ({ note: n, y: top + step * (i + 0.5) }));
}

/** Sizes shared by the quiet back label and its glowing highlight, so they line up exactly. */
const BACK = { layer: 24, layerDy: -52, name: 92, nameDy: 26 };

/** Back: the composition, every note listed quietly. */
function drawBack({ ctx, texture }: Surface, v: Variant) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = v.colors.text;
  ctx.textAlign = 'left';
  const cx = CANVAS_W / 2;

  ctx.globalAlpha = 0.75;
  ctx.font = `500 36px ${BODY}`;
  tracked(ctx, 'COMPOSITION', cx, 70, 18);

  for (const { note, y } of noteRows(v)) {
    ctx.globalAlpha = 0.45;
    ctx.font = `500 ${BACK.layer}px ${BODY}`;
    tracked(ctx, layerLabel[note.layer].toUpperCase(), cx, y + BACK.layerDy, 10);
    ctx.globalAlpha = 0.6;
    ctx.font = `300 ${BACK.name}px ${DISPLAY}`;
    tracked(ctx, note.name, cx, y + BACK.nameDy, 4);
  }
  ctx.globalAlpha = 1;
  texture.needsUpdate = true;
}

/** Back, highlight layer: only the chosen note, in the accent color, glowing. */
function drawGlow({ ctx, texture }: Surface, v: Variant, noteId: string | null) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const row = noteRows(v).find((r) => r.note.id === noteId);
  if (row) {
    const cx = CANVAS_W / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = v.colors.accent;
    ctx.shadowColor = v.colors.accent;
    ctx.font = `500 ${BACK.layer}px ${BODY}`;
    ctx.shadowBlur = 14;
    tracked(ctx, layerLabel[row.note.layer].toUpperCase(), cx, row.y + BACK.layerDy, 10);
    ctx.font = `400 ${BACK.name}px ${DISPLAY}`;
    // two passes: a wide bloom, then the crisp letters
    ctx.shadowBlur = 50;
    tracked(ctx, row.note.name, cx, row.y + BACK.nameDy, 4);
    ctx.shadowBlur = 12;
    tracked(ctx, row.note.name, cx, row.y + BACK.nameDy, 4);
    ctx.shadowBlur = 0;
  }
  texture.needsUpdate = true;
}

const fontsReady = () =>
  Promise.all([
    document.fonts.load(`300 64px ${DISPLAY}`),
    document.fonts.load(`400 64px ${DISPLAY}`),
    document.fonts.load(`500 28px ${BODY}`),
    document.fonts.load(`400 24px ${BODY}`),
  ]).catch(() => undefined);

/**
 * The bottle's printed labels, inside the glass group so they travel with the glass.
 * The copy changes while the bottle has its back turned during a refill; the chosen note
 * lights up on the back label.
 */
export function Label() {
  // the refill timeline decides when the new copy is printed (while the bottle is side-on)
  const variant = variantById(useExperience((s) => s.printed));
  const activeNote = useExperience((s) => s.activeNote);
  const front = useMemo(surface, []);
  const back = useMemo(surface, []);
  const glow = useMemo(surface, []);
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const shown = useRef<Variant | null>(null);

  useEffect(
    () => () => [front, back, glow].forEach((s) => s.texture.dispose()),
    [front, back, glow],
  );

  // Print the variant's copy (again once the web fonts have arrived, the first time).
  useEffect(() => {
    let cancelled = false;
    const print = () => {
      if (cancelled) return;
      drawFront(front, variant);
      drawBack(back, variant);
      drawGlow(glow, variant, useExperience.getState().activeNote);
      shown.current = variant;
    };
    const firstPrint = !shown.current;
    print();
    if (firstPrint) fontsReady().then(print);
    return () => void (cancelled = true);
  }, [variant, front, back, glow]);

  // The chosen note: redraw the highlight and fade it in.
  useEffect(() => {
    const m = glowMaterial.current;
    if (!m) return;
    const tl = gsap.timeline();
    tl.to(m, { opacity: 0, duration: 0.2, ease: 'power1.in' });
    tl.call(() => drawGlow(glow, shown.current ?? variant, activeNote));
    if (activeNote) tl.to(m, { opacity: 1, duration: 0.7, ease: 'power2.out' });
    return () => void tl.kill();
  }, [activeNote, glow, variant]);

  const print = { transparent: true, depthWrite: false, toneMapped: false } as const;
  return (
    <group>
      <mesh position={[0, CENTER_Y, FACE_Z]} renderOrder={3}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshBasicMaterial map={front.texture} {...print} />
      </mesh>
      <group position={[0, CENTER_Y, -FACE_Z]} rotation-y={Math.PI}>
        <mesh renderOrder={3}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial map={back.texture} {...print} />
        </mesh>
        <mesh position-z={0.0005} renderOrder={4}>
          <planeGeometry args={[WIDTH, HEIGHT]} />
          <meshBasicMaterial ref={glowMaterial} map={glow.texture} {...print} opacity={0} />
        </mesh>
      </group>
    </group>
  );
}
