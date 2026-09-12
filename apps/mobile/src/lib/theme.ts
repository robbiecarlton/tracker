/**
 * Centralizes the app's UI palette (previously hardcoded per-file in
 * `components/ui.tsx` and screens). This is deliberately separate from
 * `@tracker/core`'s highlight colors (`ratioToColor`/`computeHighlight`,
 * red/orange/green) — that's a distinct semantic system (target-performance
 * signal, not app chrome) and stays consumed as opaque hex strings, never
 * folded in here.
 */
export const theme = {
  colors: {
    brand: "#208AEF",
    brandDisabled: "#9ec6f0",
    error: "#c5221f",
    text: {
      primary: "#1a1a1a",
      secondary: "#3c4043",
      muted: "#5f6368",
      faint: "#9aa0a6",
    },
    border: "#d2d5da",
    background: "#fff",
    /** Text/icon color on top of a solid brand-colored surface (e.g. a button). */
    onBrand: "#fff",
    warning: {
      background: "#fff4e5",
      border: "#f5a623",
      text: "#7a4a00",
    },
    /** Neutral marker — an "Archive log" badge, an archived-habit's status. */
    badge: {
      background: "#eceef1",
      text: "#5f6368",
    },
  },
} as const;
