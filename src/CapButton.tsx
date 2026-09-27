import { useExperience } from './store/useExperience';

/** Floating control that unscrews and replaces the cap. Hidden while the bottle is taken apart. */
export function CapButton() {
  const capOpen = useExperience((s) => s.capOpen);
  const toggleCap = useExperience((s) => s.toggleCap);
  const section = useExperience((s) => s.section);
  const hidden = section === 'deconstruct';

  return (
    <button
      type="button"
      className="cap-button"
      aria-pressed={capOpen}
      data-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      onClick={toggleCap}
    >
      <span className="cap-button__icon" aria-hidden="true" />
      {capOpen ? 'Close the cap' : 'Open the cap'}
    </button>
  );
}
