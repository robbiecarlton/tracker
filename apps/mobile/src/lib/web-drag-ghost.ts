import { theme } from "./theme";

/**
 * A small floating "ghost" chip (drag handle glyph + habit name) that
 * follows the pointer during web drag-to-reorder — see `(app)/index.tsx`'s
 * `registerWebDragHandle`. Pure DOM, not a React component: it needs to
 * track raw pointer coordinates on every `pointermove`, and paying for a
 * re-render on every one of those would be wasteful for something this
 * throwaway. Positioned via `transform: translate(...)` rather than
 * `left`/`top` so moving it doesn't trigger layout.
 */
export function createWebDragGhost(): {
  show: (name: string, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
  destroy: () => void;
} {
  let container: HTMLDivElement | null = null;
  let nameEl: HTMLSpanElement | null = null;

  function ensure(): { container: HTMLDivElement; nameEl: HTMLSpanElement } {
    if (container && nameEl) return { container, nameEl };

    container = document.createElement("div");
    Object.assign(container.style, {
      position: "fixed",
      top: "0",
      left: "0",
      zIndex: "9999",
      pointerEvents: "none",
      display: "none",
      alignItems: "center",
      gap: "8px",
      padding: "10px 14px",
      borderRadius: "10px",
      border: `1px solid ${theme.colors.border}`,
      backgroundColor: theme.colors.background,
      boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
    });

    const handle = document.createElement("span");
    handle.textContent = "⠿";
    Object.assign(handle.style, { color: theme.colors.text.faint, fontSize: "16px" });

    nameEl = document.createElement("span");
    Object.assign(nameEl.style, {
      color: theme.colors.text.primary,
      fontSize: "15px",
      fontWeight: "700",
      whiteSpace: "nowrap",
    });

    container.appendChild(handle);
    container.appendChild(nameEl);
    document.body.appendChild(container);
    return { container, nameEl };
  }

  return {
    show(name, x, y) {
      const { container: el, nameEl: text } = ensure();
      text.textContent = name;
      el.style.display = "flex";
      // Offset down-right of the cursor so the ghost doesn't itself cover
      // the row the user is dropping onto.
      el.style.transform = `translate(${x + 16}px, ${y - 16}px)`;
    },
    move(x, y) {
      if (!container) return;
      container.style.transform = `translate(${x + 16}px, ${y - 16}px)`;
    },
    hide() {
      if (container) container.style.display = "none";
    },
    destroy() {
      container?.remove();
      container = null;
      nameEl = null;
    },
  };
}
