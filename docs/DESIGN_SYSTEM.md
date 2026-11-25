# ORSAVEN — Design System (v1, working)

Implementation: `src/web/styles/index.css` (tokens) and `src/web/components/ui/index.tsx` (components).
Status: working system for the application. Final logo, typefaces and colour values remain subject to owner approval (see IDENTITY_DIRECTION.md).

## Art direction
Editorial commerce. Deep forest surfaces, warm ivory paper, muted sage for secondary information, a restrained brass hairline accent. Typography carries the hierarchy; decoration is minimal. No gradients, glassmorphism, neon, stock or AI imagery, fake testimonials or counters.

## Colour tokens
| Token | Value | Use |
|---|---|---|
| forest-950 | #0d1813 | Hero, footer, dark surfaces |
| forest-900 | #13221b | Primary buttons, active nav |
| forest-700 | #264536 | Hover, focus ring on inputs |
| ivory-50 | #fbf8f1 | Page background |
| ivory-100 | #f5f0e4 | Section bands, panels |
| sage-500/600 | #788d75 / #5b6f59 | Eyebrows, icons, secondary text |
| brass-400/500 | #c9a86a / #a98a4f | Index numerals, hairlines, focus outline |
| ink | #161a18 | Body text |
| stone-600 | #56554e | Muted text (≥ 4.5:1 on ivory) |
| success / warning / danger | #2f6b47 / #85621a / #9a2f2a | Status only |

## Typography
- Display: **Fraunces Variable** (OFL, self-hosted via @fontsource) — headlines, numerals, card titles. Fallback: Iowan Old Style, Palatino, Georgia.
- Interface: **Inter Variable** (OFL, self-hosted) — body, UI, tables. Fallback: system UI stack.
- Fluid scale: `display-xl` (2.75→5.75rem), `display-lg` (2.25→4rem), `display-md` (1.75→2.75rem), `display-sm` (1.375→1.875rem); body 15–17px, line-height 1.6–1.75.
- Eyebrows: 11px, 600, uppercase, 0.22em tracking.

## Layout
- Container `container-site`: max 82rem, gutters 20/32/48px.
- Breakpoints: xs 30rem, sm 40, md 48, lg 64, xl 80, 3xl 112rem.
- Prose max 68ch. 12-column asymmetric compositions (e.g. 3/9, 5/7, 7/5) instead of uniform card grids.

## Shape & depth
Radius 2/4/6px. Hairline (`0 0 0 1px ink/8%`) instead of borders; `shadow-lift` only on hover/overlays.

## Components
Button (primary, secondary, ghost, inverse, danger, link × sm/md/lg, loading), ButtonLink, Input, Textarea, Select, Field (label/hint/error with aria wiring), Checkbox, Badge (8 tones), StatusBadge, Tabs (roving keyboard), Dropdown (menu roles, arrow keys, Esc, outside-click), Dialog (native `<dialog>`, focus trap), ConfirmDialog, Table + th/td, Pagination, Toast provider, Skeleton/LoadingBlock, EmptyState, ErrorState, Notice, SectionHeading, PageHeader, StatCard, ProductCard (editorial, typographic), Wordmark/Mark.

## Interaction & accessibility
- Transitions 200–350ms `ease-out-quart`; `prefers-reduced-motion` disables animation.
- Visible brass focus outline on every interactive element; skip link; semantic landmarks.
- Forms: labelled controls, `aria-invalid`, `aria-describedby`, `role="alert"` errors.
- Loading, empty, error and success states exist for every data view.
- Target: WCAG 2.2 AA.

## Icons
Stroke-only 24px set (1.6 stroke), used functionally (arrows, close, file, download). No decorative icon clusters.
