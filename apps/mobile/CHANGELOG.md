# Changelog

All notable changes to `@tracker/mobile` are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.10.1] - 2026-09-15

### Changed

- The "Add log" form's date & time field now defaults to the current time
  (still editable, and can still be cleared to fall back to "now at submit
  time") instead of starting blank with only a format placeholder.

## [0.10.0] - 2026-09-14

### Added

- The Heatmap view can now pick a cell color: Positive (green), Neutral
  (the original blue — default), or Negative (red), via a new "Color"
  chip row on the habit form (shown only for Heatmap views).

## [0.9.0] - 2026-09-14

### Added

- **Habit search**: a search box at the top of the dashboard fuzzy-matches
  (ordered subsequence, e.g. `"exru"`/`"xrun"`/`"ru"` all match "Be Healthy
  → Exercise → Run") against a habit's own name plus every ancestor's.
  Results render as a flat list, grouped by nesting depth (less-nested
  matches above their own matching children), each showing a small
  breadcrumb of its ancestors, the full normal habit card (Log, `+note`,
  Edit, `+ Subhabit`, tiles/heatmap), and its subhabit count — reusing
  `HabitCard` as-is, just without a drag handle or the content-collapse
  toggle (`components/SearchResults.tsx`, `@tracker/core`'s new
  `searchHabits`). The search clears whenever the dashboard loses focus,
  plus an explicit clear button next to the box.

### Changed

- Nested habit boxes now subtly alternate background color by nesting
  depth (plain white / very pale gray) instead of all sharing the same
  white, making it easier to track which box belongs to which level. The
  same alternation applies to search results.

## [0.8.1] - 2026-09-14

### Fixed

- A content-collapsed habit card hid its Log/`+note` actions entirely,
  along with everything else — but those two are still useful even when
  collapsed. They now stay visible, relocated to a right-aligned slot in
  the collapsed header (same controls, same `habit.allowDirectLogging`
  gating, shared with the expanded actions row via a new
  `logAndNoteActions` variable rather than duplicated).

## [0.8.0] - 2026-09-14

### Changed

- Subhabits now render *nested inside their parent's own bordered box*,
  arbitrarily deep, instead of just indented alongside it — the border
  visually contains them. Required switching the dashboard from one flat
  list over a depth-annotated array to genuinely recursive rendering (a
  `habitNode`/`siblingGroup` pair of plain functions — not JSX components,
  since defining a component inside another component's render and using
  it as `<Component/>` would make React remount the whole tree on every
  state change; see the code comment). Drag-to-reorder now happens one
  nesting level at a time: web's hand-rolled Pointer Events logic needed no
  changes (each `siblingGroup` call already scopes its own hit-testing to
  just its own rendered siblings); native switches from a single
  `DraggableFlatList` to `react-native-draggable-flatlist`'s own
  `NestableScrollContainer`/`NestableDraggableFlatList` — its
  purpose-built solution for a draggable list inside another draggable
  list's row, nested arbitrarily. `HabitCard`'s own `card` style lost its
  border/padding in the process — it's only ever rendered inside the new
  wrapping box now, and keeping both drew two concentric borders around
  every node instead of one.
- Both collapse/expand arrows (content-collapse's ▴/▾, and the
  subhabit-count toggle's ▸/▾, split out from its "N subhabits" label into
  its own larger-sized `Text` so only the arrow grows) are a bit bigger,
  and the subhabit-count toggle sits a little further below a habit's own
  controls than the uniform box gap alone gave it.

### Added

- A collapse toggle ("▴"/"▾", a true mirrored pair) directly beside each
  habit's name (with a little padding, not pushed flush right),
  independent of the existing subhabit-expand control below the card:
  collapsing it hides that habit's own tiles/heatmap/actions/Edit/+Subhabit
  links, leaving only the drag handle, name, and the toggle itself — while
  its subhabits keep showing underneath, unaffected. Lets you see just a
  parent's children without its own aggregate taking up space. Persisted
  locally (`lib/expanded-habits.ts`'s new `getCollapsedContentHabitIds`/
  `setCollapsedContentHabitIds`, alongside the existing subhabit-collapse
  storage), not synced across devices — same as the existing
  expand/collapse state.

### Fixed

- The "N subhabits" count below a habit card only counted its *direct*
  children, not grandchildren and below. Now counts every non-archived
  descendant, matching what actually appears when expanded.

## [0.6.5] - 2026-09-14

### Fixed

- The web drag ghost's text used the browser's default sans-serif instead
  of the app's actual font — it's raw DOM, not a real RN `<Text>`, so it
  never inherited react-native-web's default font stack the way everything
  else on the page does. Now sets it explicitly
  (`-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,
  sans-serif`, confirmed against a built web export's actual computed
  style).

## [0.6.4] - 2026-09-14

### Added

- Web drag-to-reorder now shows a small floating "ghost" chip (drag handle
  glyph + habit name) that follows the pointer while dragging — new
  `lib/web-drag-ghost.ts`, a plain-DOM helper (not a React component, so
  tracking raw pointer coordinates on every `pointermove` doesn't pay for
  a re-render each time). Native's `react-native-draggable-flatlist`
  already shows an equivalent lift/scale effect on its own, so this is
  web-only.

## [0.6.3] - 2026-09-14

### Fixed

- Web drag-to-reorder could only move a habit *up* the list — dropping it
  onto a sibling always inserted it immediately *before* that sibling, so
  dragging something down onto its very next neighbor just put it right
  back where it started. Now direction-aware: dropping onto a sibling
  below the source's current position inserts *after* it; above,
  *before* it (as before) — so dragging something down past a neighbor
  actually moves it there.

## [0.6.2] - 2026-09-14

### Fixed

- 0.6.1's HTML5-drag-and-drop fix resolved scrolling but not dragging
  itself — `draggable`/`dragstart` still didn't work on web. Root cause:
  react-native-web's own touch-responder system explicitly treats a native
  `dragstart` as a cancellation signal for its responder gesture tracking
  (`MOUSE_CANCEL = 'dragstart'` in its source) — native HTML5 drag and
  RNW's synthetic responder layer are known to conflict by the library's
  own design. Replaced with hand-rolled Pointer Events instead: the handle
  captures the pointer on `pointerdown` (`setPointerCapture`, routing every
  subsequent pointer event to it regardless of what's under the cursor),
  and on release does a manual `getBoundingClientRect()` hit-test against
  each row to find the drop target. No native drag APIs involved, so
  nothing for RNW's responder system to intercept.

## [0.6.1] - 2026-09-13

### Fixed

- Dashboard drag-to-reorder used `react-native-draggable-flatlist`
  (gesture-handler + reanimated) on every platform — on web this broke
  both dragging (long-press-based drag activation is unreliable there) and
  ordinary scrolling (its gesture-handler-wrapped `FlatList` captures
  scroll input; see e.g. software-mansion/react-native-gesture-handler#1819).
  Web now uses real HTML5 drag-and-drop instead (`ondragstart`/`ondragover`/
  `ondrop` wired directly onto each row's DOM node via ref callbacks in
  `(app)/index.tsx`) — no gesture library involved at all on web, so
  scrolling is untouched. Native (iOS) keeps the original
  `react-native-draggable-flatlist` implementation, which isn't reported
  broken. Same `applyReorder`/persistence logic underneath both.
- The heatmap's section legend now shows its box-size unit ("Day" / "Week"
  / "Month" — new `heatmapUnitLabel`) instead of the literal word
  "Heatmap".

## [0.6.0] - 2026-09-12

### Added

- Drag-to-reorder on the dashboard: a small "⠿" handle on each `HabitCard`
  (long-press to drag), backed by new `react-native-gesture-handler` /
  `react-native-reanimated` / `react-native-draggable-flatlist`
  dependencies (root layout now wraps everything in
  `GestureHandlerRootView`). Dragging never changes a habit's parent —
  only its relative order within its real sibling group (top-level, or one
  parent's direct subhabits) — so however a drop looks mid-gesture, the
  next render always regroups correctly (see `(app)/index.tsx`'s
  `onDragEnd`). Persists via the new `reorderHabits` API call;
  `useHabits()` gains a `setHabits` escape hatch for the optimistic local
  update.
- Heatmap: a `Heatmap` view kind is now selectable on the create/edit form
  (with a "Box size" day/week/month chip row, no hour), rendered as a new
  `components/Heatmap.tsx` full-width grid below a habit's usual tiles
  (can't fit a heatmap in a small tile) — real calendar-aligned columns
  for the day unit, a simple wrapped grid for week/month. Cell color is a
  relative intensity scale in the app's brand blue. Rolls up subhabit logs
  automatically, same as every other view.

## [0.5.0] - 2026-09-12

### Added

- A small, unobtrusive `v<version>` label pinned to the top-right corner of
  every screen, auth pages included (`VersionBadge`, rendered once in the
  root layout). Reads `@tracker/mobile`'s own `package.json` version at
  build time — bump that (as this commit does) and it's what shows.

## [0.4.0] - 2026-09-12

### Added

- Nested habits: a habit can have a parent habit (arbitrarily deep) via a
  new picker (`HabitPickerModal`) on the create/edit form, plus a
  direct-logging on/off toggle that only appears once a habit has a
  subhabit. The dashboard renders subhabits indented directly under their
  parent with a `▾`/`▸` expand/collapse control per parent — collapsed
  state persists locally (`@react-native-async-storage/async-storage`,
  `src/lib/expanded-habits.ts`), not synced across devices. A habit's view
  tiles now roll up its non-archived subhabits' logs
  (`@tracker/core`'s `aggregatedLogs`), and its Log/`+note` actions
  disappear once direct logging is disabled.
- The edit form gains a direct **Archive** action (the `archiveHabit` API
  existed but nothing called it before — only `archive-and-clone` and
  `unarchive` were wired up). Deleting or archiving a habit with active
  subhabits now prompts to cascade the action to the whole subtree, promote
  direct children to top-level, or rehome them under the habit's own
  parent — `edit.tsx`'s `confirmChildrenAction`.
- The per-habit log list gains an "All logs" / "This habit only" filter
  (defaulting to all), each rolled-up log labeled with its source habit
  ("From: Smoking"), and Edit/Delete on such a log now correctly targets
  that log's own habit rather than the page's.
- `ChipRow` (the pill-style option selector) is lifted out of `HabitForm.tsx`
  into its own `components/ChipRow.tsx` so the log-list filter and the
  direct-logging toggle can reuse it.
- Each `HabitCard` gains a "+ Subhabit" link below Edit, opening the create
  form with this habit preselected as the parent (`/habits/new?parentId=`).

### Fixed

- `Screen` (`components/ui.tsx`, backing the sign-in/sign-up, habit
  create/edit, and single-log forms) was a plain `View` with
  `justifyContent: "center"` and no scroll container — fine while content
  was always shorter than the viewport, but once a form grows past it (the
  habit edit form, now with a parent picker and toggle) there was nothing
  to scroll: content just clipped, vertically centered and stuck. Now a
  `ScrollView`, top-aligned, that scrolls normally when content overflows.

## [0.3.3] - 2026-09-12

### Added

- A `start` script (`serve -s dist -l $PORT`) and a new `serve` dependency,
  so the static web export (`npm run build`) can actually be served in
  production — previously nothing did. `-s` is `serve`'s single-page-app
  flag: any not-found path falls back to `index.html`, which Expo Router's
  client-side history-based routing then resolves — needed because dynamic
  routes (`[id]`, `[logId]`) export as literal bracket-named files, not
  per-instance pages. See `docs/RAILWAY.md`.

## [0.3.2] - 2026-09-12

### Added

- Extended `0.3.1`'s back buttons to the log form (add and edit) as well —
  same `BackButton`, same reasoning.

## [0.3.1] - 2026-09-12

### Fixed

- A new habit's default start date used `new Date().toISOString().slice(0, 10)`
  — UTC's current date, not the user's. Anyone west of UTC in the evening got
  "tomorrow" as the default (e.g. 8pm in America/Denver is already the next
  day in UTC). Fixed with a new `todayInZone()` (`lib/date-format.ts`);
  `HabitForm` now takes a required `timeZone` prop to compute this default
  when creating a habit (an explicit `initialStartDate`, as when editing, is
  unaffected and still wins).

### Added

- Back buttons (`components/ui.tsx`'s new `BackButton`) on the habit form
  (add and edit), the per-habit logs page, and the archived-habits page —
  previously the only way off those screens was a swipe/hardware-back
  gesture or (on the form) successfully submitting.

## [0.3.0] - 2026-09-12

### Added

- Per-habit log list (`habits/[id]/logs/`): a reverse-chronological feed
  merging logs with start-date-change markers, each log older than the
  habit's current start date visually flagged with an "Archive log" badge;
  edit/delete per log.
- `LogForm` — merges what used to be two separate flows ("log with notes"
  and "add a past log") into one shared create/edit form; the old
  `habits/[id]/log.tsx` is retired.
- Start-date-change handling: editing a habit's start date past logs that
  predate it now prompts Archive-vs-Keep (`docs/DOMAIN.md`'s "Start-date
  changes") — Keep is an ordinary save (the backend auto-records history),
  Archive calls the new `archiveAndCloneHabit`.
- Archived-habits area (`habits/archived.tsx`) with an Unarchive action, and
  an "Archived" link on the dashboard, which now excludes archived habits
  from the main list.
- `lib/date-format.ts`: raw ISO ⇄ human display ⇄ user-typed local text for
  a log's timestamp (a different concern from `view-format.ts`, which
  formats computed view results, not raw dates). Adds `luxon` as a direct
  dependency (previously only reachable transitively via `@tracker/core`,
  which deliberately never exposes it across its own API).
- `api/habits.ts`: `updateLog`, `deleteLog`, `archiveHabit`, `unarchiveHabit`,
  `archiveAndCloneHabit`.
- `theme.ts`: a `badge` token for the "Archive log" marker and archived
  status.
- `offline/outbox.ts`: added `"habit.archive"`/`"habit.unarchive"` mutation
  kinds (outbox itself still a no-op stub until Phase 5).
- `HabitCard`: a one-tap "+ note" link back to `logs/new` alongside the plain
  Log button and the Logs list link (the Phase 3 "log with notes" shortcut,
  dropped when the logs list replaced it — restored per-habit, not just
  reachable from the list).

### Fixed

- **`Alert.alert` was a complete no-op on web** (`react-native-web` ships it
  as `static alert() {}`), silently swallowing every confirmation dialog:
  delete habit, delete log (both the list and the edit-log screen), and the
  entire Archive-vs-Keep start-date prompt. Replaced every `Alert.alert` call
  with a new `lib/confirm.tsx` (`confirmAlert` + `<ConfirmHost />`, mounted
  once at the app root) built on RN's `Modal`, which `react-native-web` does
  implement for real.

## [0.2.0] - 2026-09-11

### Added

- Real dashboard (`(app)/index.tsx`): lists habits with computed view tiles
  (cumulative/streak/percentage/days/since, each computed client-side via
  `@tracker/core`'s `computeHabitView`) tinted by `computeHighlight`'s
  green→orange→red mapping. A simple-tap Log button per habit.
- Add/edit habit form (`HabitForm`) covering name, start date, and a
  repeatable view editor (kind, unit, days window, cumulation goal,
  target/target-type), including the streak demotivation warning
  (`StreakWarning`) and a delete action on the edit screen.
- Log-with-notes screen.
- `src/api/`: a thin fetch layer (`apiFetch`, `listHabits`/`createHabit`/
  `updateHabit`/`deleteHabit`/`createLog`) built on `authClient.$fetch`, which
  already authenticates transparently on both web (cookie) and native
  (SecureStore-backed bearer/cookie) — no platform-specific code needed.
- `useCurrentUser()` (centralizes the session→timezone cast) and `useHabits()`
  (plain-hooks list query + refetch; no data-fetching library, matching the
  app's existing minimalism — revisit in Phase 5's offline work).
- `src/lib/theme.ts`: centralizes the app's UI palette (previously hardcoded
  per-file); deliberately kept separate from `@tracker/core`'s highlight
  colors, which stay a distinct, opaque semantic system.
- `src/lib/view-format.ts`: display-only formatting for computed view results
  ("X out of N", %, unit pluralization) — kept out of `@tracker/core`, which
  stays pure math.
- `offline/outbox.ts`: added the missing `"habit.delete"` mutation kind
  (outbox itself still a no-op stub until Phase 5).

## [0.1.0] - 2026-09-10

### Added

- Expo Router app targeting iOS and web from one codebase (SDK 57).
- Auth flow: sign-in and sign-up screens (Zod-validated via `@tracker/core`),
  Better Auth client with SecureStore-backed sessions on native, session-gated
  route groups `(auth)` / `(app)`.
- Device timezone captured at signup and sent to the backend.
- Placeholder authenticated dashboard with sign-out.
- Offline outbox interface stub (`src/offline/outbox.ts`) for Phase 5.
- Metro config for the npm-workspaces monorepo.
