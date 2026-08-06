# Antigravity Task Prompt — Shape Library + Slide Layout Library

Copy everything below the line into Antigravity as a single task.

---

## Context

You are working in `/Users/vaishh/flam`, an npm workspace:

- `frontend/` — Vite + React 18 + TypeScript, canvas rendered with `react-konva`, state in Zustand
  (`store/useBoardStore.ts` = elements, `store/useUIStore.ts` = UI flags, `store/usePresenceStore.ts` = collaborators)
- `backend/` — Express + Socket.IO + sqlite3, runs on port 4000
- Run both with `npm run dev` from the repo root. Frontend is on port 3000.

The app is a Miro-style collaborative whiteboard. Two panels already exist and work, but are
shallow and badly wired:

- `frontend/src/components/DiagrammingShapesDrawer.tsx` — shape picker with categories
  (Basic, Flowchart, Callouts, AWS, UML, VMware, Azure)
- `frontend/src/components/SlideLayoutsModal.tsx` — 18 slide layouts that spawn a frame
  plus child elements
- `frontend/src/components/FrameNavigationDrawer.tsx`, `SlideDeckBar.tsx`,
  `PresentationPlayer.tsx` — frame navigation and presentation mode

## Goal

Make "Frames" and "Diagramming" first-class, data-driven feature areas that scale to hundreds of
shapes and dozens of layouts without growing the existing 3000-line files.

Do NOT copy assets, SVG paths, or copyrighted content from Miro. Author shapes yourself or use
officially published, freely licensed icon sets (AWS Architecture Icons, Azure Architecture Icons).

---

## Task 1 — Replace the hardcoded shape switch with a shape manifest

**Problem.** `DiagrammingShapesDrawer.tsx` lists shapes with hand-written JSX icons, and each one
calls `handleAddShape(type, label)` with a *generic fallback* type. For example, every Azure entry
maps to `database` / `server` / `container` / `cloud`, and every UML entry maps to `rectangle` /
`diamond` / `ellipse`. So the icon shown in the panel does not match what lands on the canvas.
Meanwhile `types/canvas.ts` declares ~30 specific `ElementType` values (`azure-sql`, `azure-func`,
`uml-actor`, `uml-class`, `vmware-host`, `ui-button`, …) that have **no renderer case** in
`canvas/SketchCanvas.tsx` and would fall through to the default branch.

**Do this:**

1. Create `frontend/src/shapes/shapeLibrary.ts` exporting a typed manifest:

   ```ts
   export interface ShapeDef {
     id: string;                    // stable, e.g. 'aws-s3'
     category: string;              // 'basic' | 'flowchart' | 'aws' | 'uml' | ...
     label: string;                 // 'Amazon S3 Bucket'
     keywords: string[];            // for search
     // geometry: EITHER a normalized SVG path in a 0..100 x 0..100 box,
     // OR a named primitive the renderer already supports
     geometry:
       | { kind: 'primitive'; primitive: 'rect' | 'roundedRect' | 'ellipse' | 'polygon'; points?: number[]; cornerRadius?: number }
       | { kind: 'path'; d: string };
     defaultWidth: number;
     defaultHeight: number;
     defaultFill: string;
     defaultStroke: string;
     labelPlacement: 'inside' | 'below' | 'none';
     ports?: ('top' | 'right' | 'bottom' | 'left')[];
   }

   export const SHAPE_LIBRARY: ShapeDef[] = [ /* ... */ ];
   export const SHAPE_CATEGORIES: { id: string; title: string; order: number }[] = [ /* ... */ ];
   ```

2. Populate it with **at least** these categories, authored as normalized SVG paths:
   - Basic (12): square, rounded square, circle, triangle, diamond, hexagon, octagon,
     parallelogram, trapezoid, star, arrow, cross
   - Flowchart (14): process, decision, start/end terminator, data (parallelogram),
     predefined process, internal storage, document, multi-document, manual input,
     manual operation, preparation, connector (circle), off-page connector, database
   - Callouts (6): speech bubble, thought cloud, rounded banner, rectangular callout,
     oval callout, arrow callout
   - UML (12): actor, class box (3-compartment), interface, package, component, node,
     use case, note, composition, aggregation, generalization, dependency
   - AWS (20+), Azure (20+), GCP (15+): use the official free architecture-icon SVG sets;
     download them into `frontend/public/shapes/<vendor>/` and reference by file path in a
     `{ kind: 'image'; src: string }` geometry variant. Check and record each vendor's terms
     in a comment at the top of the manifest.
   - Wireframe / UI (10): button, text input, card, navbar, avatar, checkbox, dropdown,
     image placeholder, toggle, slider

3. Add a **single generic renderer** in `SketchCanvas.tsx` — one case that looks the element's
   `shapeId` up in `SHAPE_LIBRARY` and draws a Konva `<Path>`, `<Image>`, or primitive plus an
   optional `<Text>` label. Delete the per-shape `case 'aws-lambda':`, `case 'aws-ec2':`,
   `case 'aws-s3':` etc. blocks it replaces. Keep behavior identical for shapes that already
   render correctly — verify visually before deleting anything.

4. Extend the element model in `types/canvas.ts`: add `shapeId?: string` to `BaseElement` (or a
   dedicated `LibraryShapeElement`). Existing saved boards must still load — if `shapeId` is
   absent, fall back to the current `type`-based rendering path.

5. Rewrite `DiagrammingShapesDrawer.tsx` to render from the manifest: map over
   `SHAPE_CATEGORIES`, filter `SHAPE_LIBRARY` by category and by the search box, and render each
   shape's icon by drawing its own geometry (small inline SVG built from the same path data) so
   the picker preview and the canvas result always match.

6. Replace the fake badges (`+803 shapes`, `+555 shapes`, `+600 shapes`) with the real count from
   the manifest.

7. Replace `alert('Import custom SVG shapes feature operational!')` at the drawer's import button
   with a working SVG upload that adds the file to a user shape collection persisted in
   localStorage, or remove the button.

## Task 2 — Give Diagramming its own toolbar entry

Currently in `frontend/src/components/Layout.tsx` (~line 973) clicking the **Rectangle** tool both
selects the rectangle tool and toggles the diagramming drawer. That is confusing.

- Add a dedicated "Diagramming shapes" button to the left tool rail with its own icon and shortcut.
- Make the Rectangle tool only select the rectangle tool.
- Move `isDiagrammingDrawerOpen` from `useState` in `Layout.tsx` into `useUIStore` so other
  components (command palette, keyboard shortcuts) can open it.

## Task 3 — Make Frames the entry point for slide layouts

**Problem.** `setSlideLayoutsModalOpen(true)` is called from exactly one place: a floating Konva
toolbar inside `SketchCanvas.tsx` (~line 1836) that only appears once a frame is already selected.
The Frames flyout in `Layout.tsx` (~line 1106) offers only aspect-ratio presets. So the 18 slide
layouts are nearly undiscoverable.

**Do this:**

1. Restructure the Frames flyout into two tabs: **Size** (the existing aspect-ratio grid) and
   **Layouts** (a scrollable grid of slide layouts).
2. Extract the 18 layouts out of the if/else chain in `SlideLayoutsModal.tsx` into
   `frontend/src/slides/slideLayouts.ts`:

   ```ts
   export interface SlideLayoutDef {
     id: string;
     name: string;
     category: 'title' | 'content' | 'data' | 'interactive' | 'team' | 'diagram';
     description: string;
     frameSize: { width: number; height: number };
     // pure function: given the frame origin, return the child elements to create
     build: (originX: number, originY: number, idSeed: string) => CanvasElement[];
   }
   export const SLIDE_LAYOUTS: SlideLayoutDef[] = [ /* ... */ ];
   ```

   Each existing layout becomes one entry with its current body moved into `build`. Behavior must
   not change — the same elements at the same offsets.
3. Add these missing layouts, matching what a modern whiteboard offers: two-column text,
   three-column text, quote slide, big-number statistic, comparison (before/after),
   bullet list with icons, image grid (2x2), full-bleed image with caption, chart placeholder,
   closing / thank-you slide, kanban slide, SWOT slide, timeline slide (horizontal),
   pros-and-cons slide, roadmap slide.
4. Render a **real preview thumbnail** for each layout in the picker — build a small static SVG
   from the same `build` output rather than the current text-only description.

## Task 4 — Correctness and polish fixes

1. **Remove all Miro branding from the product UI.** There is a banner reading
   "Get faster access to your boards by using Miro apps · Install apps", a dashboard heading
   "Start with a Miro Template", and a color swatch named "Miro Blue". Replace every one with
   SyncSketch's own wording. Grep for `Miro` across `frontend/src` and fix each hit.
2. **Zoom-to-fit when a board opens.** Opening a board currently lands at world origin `(0, 0)`
   showing an empty viewport even when the board has content. After `loadBoard` resolves,
   compute the bounding box of all elements and set pan/zoom to fit it (with padding), falling
   back to `(0, 0)` at 100% for a genuinely empty board.
3. **Deduplicate the zoom controls.** There are two separate zoom widgets in the bottom-left of
   the board view. Keep one.
4. **Unify the theme.** The dashboard renders light, the board chrome renders dark, and the canvas
   surface renders light. Pick one source of truth for the theme and apply it to all three, and
   make the existing dark-mode classes actually respond to it.

## Constraints

- TypeScript must compile: `npm run build:frontend` from the repo root, with no new errors.
- Do not break realtime sync. Elements travel over Socket.IO in `App.tsx` (`element-sync`) and are
  persisted server-side; any new element field must round-trip through the backend in
  `backend/src/index.ts` and `backend/src/db.ts`.
- Do not commit `frontend/dist` or `backend/dist` changes as part of the feature work.
- Work incrementally: finish and verify Task 1 before starting Task 2. After each task, run the
  dev server and confirm the affected panel still opens, adds elements, and syncs.
- If a decision is genuinely ambiguous (e.g. which icon set to license), state the assumption in a
  comment and continue — do not stop and wait.
