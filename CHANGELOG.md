# Changelog

## 0.3.0 - 2026-10-07

- Add optional `label` text to flow diagram edges.
- Measure and wrap edge labels before layout to reserve space beside arrows.
- Support Korean, English, explicit newlines, and literal markup in labels.
- Preserve labels in Markdown previews and exported SVGs.
- Add an edge-label example and validation and collision tests.

## 0.2.0 - 2026-10-07

- Add diagram-wide `defaults.width` and `defaults.minHeight`.
- Add per-node `width` and `minHeight` overrides for flow diagrams.
- Add mixed string/object lane columns with per-column widths.
- Preserve automatic text wrapping, row alignment, and content-driven height growth.
- Add a box-size example and document the new syntax.
- Preserve existing diagrams when size options are omitted.

## 0.1.0 - 2026-10-07

- Initial YAML and Markdown diagram editor.
- Parallel timelines and automatically laid out flow diagrams.
- Live SVG previews and downloads.
