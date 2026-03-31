# Tessera Brand Assets

## Mark Variants

- `tessera-mark-purple.svg`: Primary single-color mark. Default for standard use on light backgrounds.
- `tessera-mark-twotone.svg`: Editorial/web variant using `#534AB7` on the left half and `#7F77DD` on the right half.
- `tessera-mark-mono.svg`: Neutral dark mark using `#1A1A1A` for print, watermarks, and single-color reproduction.
- `tessera-mark-reversed.svg`: White mark for dark, saturated, or photographic backgrounds.

## Usage Hierarchy

1. Use `tessera-mark-purple.svg` by default.
2. Use `tessera-mark-mono.svg` when reproduction is limited to one color.
3. Use `tessera-mark-reversed.svg` on dark backgrounds only.
4. Use `tessera-mark-twotone.svg` only in high-resolution editorial, docs, slide, or web contexts where the dual-tone treatment adds value.

## Construction Notes

- The mark is built on a `100 x 100` grid.
- The gap between halves is `8` units.
- The interlock radius is `20` units and spans from `y = 30` to `y = 70`.
- Outer corner radius is `6` units.
- Left-half arc: `A20 20 0 0 1`
- Right-half arc: `A20 20 0 0 0`

## Clear Space And Minimum Size

- Maintain clear space equal to `25%` of mark height on all sides.
- Minimum digital size for the standalone mark: `24 x 24 px`
- Minimum print size for the standalone mark: `8 x 8 mm`
- Minimum digital width for a lockup: `120 px`
- Minimum print width for a lockup: `30 mm`

## Usage Rules

- Use the provided SVG assets directly; do not redraw or alter proportions.
- Do not stretch, rotate, distort, or recolor the mark outside the approved variants.
- Do not place the mark on busy photography or patterned backgrounds without sufficient contrast.
- Do not place text or taglines inside the mark's clear space.
- Do not animate the mark in ways that change its shape.

## Dynamic States

- `apart`: default state
- `together`: verified/authenticated UI state
- `faded right`: searching/connecting UI state

## Reference

- `tessera-brand-guidelines.pdf`: source brand guidance document, v1.1 (March 2026)
