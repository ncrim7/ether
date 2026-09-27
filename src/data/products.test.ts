// Guards against the reference video's bug: a feature button that opens an empty panel.
import { describe, expect, it } from 'vitest';
import { variants, variantById } from './products';

const hex = /^#[0-9a-f]{6}$/i;

describe('products', () => {
  it('has three variants with unique ids and names', () => {
    expect(variants).toHaveLength(3);
    expect(new Set(variants.map((v) => v.id)).size).toBe(3);
    expect(new Set(variants.map((v) => v.name)).size).toBe(3);
  });

  it.each(variants)('$name has complete copy and valid colors', (variant) => {
    expect(variant.tagline.trim()).not.toBe('');
    expect(variant.description.trim()).not.toBe('');
    for (const color of [...Object.values(variant.colors), variant.lights.key, variant.lights.rim, variant.atmosphere.particleColor]) {
      expect(color).toMatch(hex);
    }
    expect(variant.atmosphere.count.low).toBeLessThan(variant.atmosphere.count.high);
  });

  it.each(variants)('$name has 3 to 4 complete notes covering every layer', (variant) => {
    expect(variant.notes.length).toBeGreaterThanOrEqual(3);
    expect(variant.notes.length).toBeLessThanOrEqual(4);
    expect(new Set(variant.notes.map((n) => n.id)).size).toBe(variant.notes.length);
    expect(new Set(variant.notes.map((n) => n.layer))).toEqual(new Set(['top', 'heart', 'base']));
    for (const note of variant.notes) {
      expect(note.name.trim()).not.toBe('');
      expect(note.line.trim()).not.toBe('');
      note.adjectives.forEach((a) => expect(a.trim()).not.toBe(''));
      expect(note.particle.color).toMatch(hex);
      expect(note.camera.distance).toBeGreaterThan(1);
      expect(Math.abs(note.camera.elevation)).toBeLessThan(60);
    }
  });

  it('looks variants up by id', () => {
    expect(variantById('ember').name).toBe('EMBER');
    expect(() => variantById('nope' as never)).toThrow();
  });
});
