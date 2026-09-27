# ÉTHER — The Architecture of Scent

An interactive 3D product experience for a fictional fragrance house. One bottle, three scents
(NOIR, AURA, EMBER): scroll to turn it, take it apart and read its composition; switch scents and
watch the bottle drain and refill with the new perfume.

Built with Vite, React, TypeScript, React Three Fiber / three.js, GSAP ScrollTrigger, Lenis and
Zustand.

## Highlights

- **Real refill on every scent change** — the liquid has a fill level (clip plane + back-face
  surface), sloshes on a spring, and fills from a stream poured through the neck.
- **Scroll choreography** — one scrubbed timeline moves the bottle opposite the copy, spins it,
  lifts the cap and slides the glass off the liquid.
- **Printed labels** — canvas-drawn brand and composition prints; the chosen note glows on the back.
- **Atmosphere** — a refracted backdrop with a breathing halo, a noise ring on scent change, and
  per-scent particles (dust, motes, sparks).
- **Built to degrade** — device quality tiers, the 3D stack loaded as its own chunk (121 KB initial
  JS gzipped), reduced-motion support and a no-WebGL fallback.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # data tests
npm run build && npm run preview
```

Checks against the preview server (`npm run preview`, port 4173):

```bash
node scripts/shoot.mjs      # screenshots every section, desktop + mobile, and checks behavior
node scripts/refill.mjs     # films the refill frame by frame into a contact sheet
node scripts/fallback.mjs   # the site without WebGL
```

URL flags: `?quality=high|medium|low` pins the render tier, `?debug` exposes timelines for the
scripts above.

## Credits

- Bottle: [“05 Parfum”](https://sketchfab.com/3d-models/05-parfum-c6de4b728fb74cddaa5ca1e156e45c17)
  by pedrofbfranca, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified:
  stopper removed (the cap is generated in code), parts renamed, rescaled and compressed by
  `scripts/prepare-model.mjs`.
- Noise transition and radial noise ideas: [codrops-noise-transition](https://github.com/mohAmineBrs/codrops-noise-transition)
  by mohAmineBrs (MIT).
- Liquid technique: after MinionsArt's liquid shader.
- Fonts: Cormorant Garamond and Manrope (SIL Open Font License), via Google Fonts.
- Interaction reference: [Ciao Energy](https://www.ciaoenergy.com/) by SKAALD.

ÉTHER is a fictional brand, made as a design study.
