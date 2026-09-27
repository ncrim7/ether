// Single source of truth for every variant: copy, colors, lighting, atmosphere and notes.
// Components never hard-code text or colors; adding a scent means adding a record here.

export type NoteLayer = 'top' | 'heart' | 'base';

export interface CameraAngle {
  /** degrees around the bottle, 0 = front */
  azimuth: number;
  /** degrees above the horizon */
  elevation: number;
  /** distance from the bottle, in bottle heights */
  distance: number;
}

export interface Note {
  id: string;
  name: string;
  layer: NoteLayer;
  adjectives: [string, string, string];
  line: string;
  camera: CameraAngle;
  particle: { color: string; speed: number; size: number };
}

export type VariantId = 'noir' | 'aura' | 'ember';

export interface Variant {
  id: VariantId;
  index: string;
  name: string;
  tagline: string;
  description: string;
  /** light variants need dark text */
  tone: 'dark' | 'light';
  colors: {
    background: string;
    backgroundDeep: string;
    accent: string;
    text: string;
    liquid: string;
    glassTint: string;
    metal: string;
    cap: string;
  };
  lights: { key: string; rim: string; intensity: number };
  atmosphere: {
    particleColor: string;
    count: { high: number; low: number };
    /** particle drift direction and speed, units per second */
    drift: [number, number, number];
    /** point size multiplier */
    size: number;
    /** 0 = steady, 1 = embers flickering like sparks */
    flicker: number;
    opacity: number;
  };
  notes: Note[];
}

export const variants: Variant[] = [
  {
    id: 'noir',
    index: '01',
    name: 'NOIR',
    tagline: 'The weight of midnight.',
    description: 'A dark, slow-burning signature. Iris and amber over a cold spark of bergamot.',
    tone: 'dark',
    colors: {
      background: '#0b0810',
      backgroundDeep: '#050307',
      accent: '#b58cff',
      text: '#f1ebfa',
      liquid: '#4a2275',
      glassTint: '#2a1f35',
      metal: '#3a3740',
      cap: '#111014',
    },
    lights: { key: '#e9dcff', rim: '#9a6bff', intensity: 1 },
    // slow violet dust hanging in the dark
    atmosphere: { particleColor: '#b58cff', count: { high: 1500, low: 400 }, drift: [0.02, 0.015, 0], size: 1, flicker: 0.15, opacity: 0.55 },
    notes: [
      {
        id: 'bergamot',
        name: 'Bergamot',
        layer: 'top',
        adjectives: ['Bright', 'Citrus', 'Cold'],
        line: 'A cold spark that opens the dark.',
        camera: { azimuth: -25, elevation: 18, distance: 2.4 },
        particle: { color: '#f4d35e', speed: 1.4, size: 1 },
      },
      {
        id: 'iris',
        name: 'Iris',
        layer: 'heart',
        adjectives: ['Powdery', 'Violet', 'Cool'],
        line: 'Soft powder over cold earth, the quiet heart of the night.',
        camera: { azimuth: 20, elevation: 6, distance: 2.2 },
        particle: { color: '#9a6bff', speed: 0.5, size: 1.2 },
      },
      {
        id: 'amber',
        name: 'Amber',
        layer: 'base',
        adjectives: ['Warm', 'Resinous', 'Deep'],
        line: 'Resin and warmth that stays long after you leave.',
        camera: { azimuth: 40, elevation: -8, distance: 2.6 },
        particle: { color: '#e0a64b', speed: 0.3, size: 1.4 },
      },
      {
        id: 'cedar',
        name: 'Cedar',
        layer: 'base',
        adjectives: ['Dry', 'Woody', 'Steady'],
        line: 'Dry wood that holds the whole composition upright.',
        camera: { azimuth: -45, elevation: -4, distance: 2.8 },
        particle: { color: '#a07855', speed: 0.4, size: 1.1 },
      },
    ],
  },
  {
    id: 'aura',
    index: '02',
    name: 'AURA',
    tagline: 'Light, made wearable.',
    description: 'Clean and luminous. White tea and jasmine in a halo of musk.',
    tone: 'light',
    colors: {
      background: '#eaf4f5',
      backgroundDeep: '#cfe3e6',
      accent: '#2e9fb0',
      text: '#0e2a30',
      liquid: '#bfe9f0',
      glassTint: '#dff3f6',
      metal: '#d7dde0',
      cap: '#e9eef0',
    },
    lights: { key: '#ffffff', rim: '#7fd8e6', intensity: 1.2 },
    // luminous motes rising through clean air (drawn darker than the pale background)
    atmosphere: { particleColor: '#5fb3c0', count: { high: 1000, low: 300 }, drift: [0, 0.07, 0], size: 1.2, flicker: 0, opacity: 0.45 },
    notes: [
      {
        id: 'bergamot',
        name: 'Bergamot',
        layer: 'top',
        adjectives: ['Sparkling', 'Green', 'Fresh'],
        line: 'A clean citrus breath, like morning air.',
        camera: { azimuth: -25, elevation: 18, distance: 2.4 },
        particle: { color: '#f2e47a', speed: 1.4, size: 1 },
      },
      {
        id: 'white-tea',
        name: 'White Tea',
        layer: 'heart',
        adjectives: ['Soft', 'Airy', 'Calm'],
        line: 'The stillness of steam over a porcelain cup.',
        camera: { azimuth: 15, elevation: 10, distance: 2.2 },
        particle: { color: '#dfe9d8', speed: 0.6, size: 1.2 },
      },
      {
        id: 'jasmine',
        name: 'Jasmine',
        layer: 'heart',
        adjectives: ['Floral', 'Luminous', 'Sweet'],
        line: 'White petals opening in full light.',
        camera: { azimuth: 35, elevation: 4, distance: 2.3 },
        particle: { color: '#fff6e8', speed: 0.7, size: 1.3 },
      },
      {
        id: 'musk',
        name: 'Musk',
        layer: 'base',
        adjectives: ['Clean', 'Skin-like', 'Lasting'],
        line: 'A second skin that lingers without a sound.',
        camera: { azimuth: -40, elevation: -6, distance: 2.7 },
        particle: { color: '#e6eef2', speed: 0.3, size: 1.5 },
      },
    ],
  },
  {
    id: 'ember',
    index: '03',
    name: 'EMBER',
    tagline: 'Heat that remembers.',
    description: 'Intense and sensual. Saffron and spice burning down into leather and vanilla.',
    tone: 'dark',
    colors: {
      background: '#140604',
      backgroundDeep: '#070201',
      accent: '#ff7a2e',
      text: '#fbe9dd',
      liquid: '#b3360f',
      glassTint: '#5a1e0c',
      metal: '#b0673c',
      cap: '#15100e',
    },
    lights: { key: '#ffd9bf', rim: '#ff6a1f', intensity: 1.1 },
    // sparks rising from a fire below the frame
    atmosphere: { particleColor: '#ff8a3d', count: { high: 900, low: 250 }, drift: [0.03, 0.32, 0], size: 0.9, flicker: 1, opacity: 0.9 },
    notes: [
      {
        id: 'saffron',
        name: 'Saffron',
        layer: 'top',
        adjectives: ['Metallic', 'Honeyed', 'Rare'],
        line: 'A golden thread that catches fire first.',
        camera: { azimuth: -25, elevation: 18, distance: 2.4 },
        particle: { color: '#ffb22e', speed: 1.2, size: 1 },
      },
      {
        id: 'spice',
        name: 'Spice',
        layer: 'heart',
        adjectives: ['Hot', 'Peppery', 'Vivid'],
        line: 'Pink pepper and clove crackling at the core.',
        camera: { azimuth: 25, elevation: 8, distance: 2.2 },
        particle: { color: '#ff5a2a', speed: 1, size: 1.1 },
      },
      {
        id: 'leather',
        name: 'Leather',
        layer: 'heart',
        adjectives: ['Smoky', 'Supple', 'Dark'],
        line: 'Worn leather warmed by the hand.',
        camera: { azimuth: 45, elevation: -2, distance: 2.5 },
        particle: { color: '#6b3a24', speed: 0.4, size: 1.3 },
      },
      {
        id: 'vanilla',
        name: 'Vanilla',
        layer: 'base',
        adjectives: ['Creamy', 'Sweet', 'Enveloping'],
        line: 'The last glow of the fire, soft and golden.',
        camera: { azimuth: -40, elevation: -8, distance: 2.7 },
        particle: { color: '#f3dcb2', speed: 0.3, size: 1.5 },
      },
    ],
  },
];

export const variantById = (id: VariantId): Variant => {
  const variant = variants.find((v) => v.id === id);
  if (!variant) throw new Error(`Unknown variant: ${id}`);
  return variant;
};

export const layerLabel: Record<NoteLayer, string> = {
  top: 'Top note',
  heart: 'Heart note',
  base: 'Base note',
};
