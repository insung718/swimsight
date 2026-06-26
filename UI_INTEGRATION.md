# SwimSight UI Integration Guide

SwimSight uses a premium glassmorphism system built around dark navy, white glass, and aqua highlights. New animated components should feel native to this system, not pasted in.

## Contrast Rules

- Use `stitch-panel`, `stitch-panel-soft`, or `dashboard-glass` for translucent surfaces.
- Keep body text at strong contrast. Avoid text below `text-white/65` unless it is purely decorative.
- Inputs should use dark tinted backgrounds, visible borders, and readable placeholders.
- If a component sits over a bright or busy background, increase the surface opacity before lowering text contrast.
- Buttons and icons must be immediately distinguishable in default, hover, focus, and disabled states.

## Component Integration Rules

- Adapt third-party components to SwimSight tokens: `stitch-abyss`, `stitch-cyan`, white glass borders, 8px card radius, and existing motion timing.
- Prefer existing dependencies. Add animation libraries only when the component truly needs them.
- Respect `prefers-reduced-motion`.
- Preserve keyboard access, focus states, and ARIA labels for interactive pieces.
- Keep mobile layouts compact and readable before adding desktop-only visual flair.

## Integrated React Bits-Inspired Components

- `MagicBento`: `src/components/ui/magic-bento.tsx`
- `StaggeredMenu`: `src/components/ui/staggered-menu.tsx`
- `Dock`: `src/components/ui/dock.tsx`

These are adapted to SwimSight instead of copied raw. They preserve the requested interaction patterns while using the app's glass panels, aqua highlights, readable navy tinting, accessible focus states, and existing dependency set.
