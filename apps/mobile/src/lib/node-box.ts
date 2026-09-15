import { StyleSheet } from "react-native";
import { theme } from "./theme";

/**
 * Alternates a habit's box background by its nesting depth on the
 * dashboard (0 = top-level) — even depths plain white, odd depths a very
 * pale gray, just enough to help the eye track which box belongs to which
 * level. Shared between the normal nested tree (`(app)/index.tsx`) and the
 * flat search results list (`components/SearchResults.tsx`), so a habit
 * looks the same whether reached by scrolling or by searching.
 */
export function nodeBackgroundForDepth(depth: number): string {
  return depth % 2 === 0 ? theme.colors.background : theme.colors.backgroundAlt;
}

/**
 * The one bordered box per habit. Also shared between the dashboard's
 * nested tree and the flat search results list — see
 * `nodeBackgroundForDepth` above.
 */
export const nodeBoxStyles = StyleSheet.create({
  nodeBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  nodeBoxActive: { opacity: 0.85 },
});
