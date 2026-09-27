import { create } from 'zustand';
import type { VariantId } from '../data/products';

export type SectionId = 'intro' | 'manifesto' | 'collection' | 'notes' | 'deconstruct' | 'final';
export type Quality = 'high' | 'medium' | 'low';

interface ExperienceState {
  variant: VariantId;
  activeNote: string | null;
  section: SectionId;
  quality: Quality;
  loaded: boolean;
  setVariant: (variant: VariantId) => void;
  toggleNote: (note: string) => void;
  clearNote: () => void;
  setSection: (section: SectionId) => void;
  setQuality: (quality: Quality) => void;
  setLoaded: () => void;
}

export const useExperience = create<ExperienceState>((set) => ({
  variant: 'noir',
  activeNote: null,
  section: 'intro',
  quality: 'high',
  loaded: false,
  // notes differ per variant, so a variant change always closes the open note
  setVariant: (variant) => set((s) => (s.variant === variant ? s : { variant, activeNote: null })),
  toggleNote: (note) => set((s) => ({ activeNote: s.activeNote === note ? null : note })),
  clearNote: () => set({ activeNote: null }),
  setSection: (section) => set({ section }),
  setQuality: (quality) => set({ quality }),
  setLoaded: () => set({ loaded: true }),
}));
