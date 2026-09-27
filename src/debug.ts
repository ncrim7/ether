/**
 * `?debug` exposes a few internals on `window.__ether` so test scripts can freeze and scrub
 * animations (headless software rendering is far too slow to film them in real time).
 * Without the flag nothing is exposed.
 */
export const debugEnabled = new URLSearchParams(window.location.search).has('debug');

export function expose(name: string, value: unknown) {
  if (!debugEnabled) return;
  const w = window as unknown as { __ether?: Record<string, unknown> };
  w.__ether = { ...w.__ether, [name]: value };
}
