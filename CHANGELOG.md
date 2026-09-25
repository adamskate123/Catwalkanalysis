# Changelog

All notable changes to Gait Lab (CatWalk Analyzer) are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/).

## [1.1.0] - 2026-09-25

### Added

- **GraphPad Prism export (.pzfx).** The Data & export tab can download a Prism project with per-animal values already arranged as data tables. It opens in Prism 5–10 via File → Open.
  - Column tables: groups side by side, one table per parameter and timepoint (for t-tests, one-way ANOVA and scatter-dot plots).
  - Grouped tables: timepoints × groups with animals as replicate subcolumns. Each animal keeps the same subcolumn at every timepoint, so repeated-measures two-way ANOVA and mixed-effects analysis work directly.
  - Parameters to include: key parameters (whole-body plus front/hind means), only parameters changed vs control at the current thresholds, or everything.
  - The project notes record the app version and analysis settings (compliant runs, speed adjustment, control and disease groups).
- A version number in the app footer, and a **What's new** page showing this changelog.

## [1.0.0] - 2026-09-25

### Added

- First release of Gait Lab: an installable web app for phones and desktops that works offline and keeps all processing on the device.
- Import of CatWalk XT run-statistics exports (.xlsx, .csv, .tsv, .txt), with header-row detection, two-row Mean/StDev headers, decimal commas, and recognition of about 50 CatWalk parameters across naming variants.
- Automatic detection of animal ID, group, timepoint and compliant-run columns, and of control and untreated-disease groups; everything is editable in Setup.
- Per-animal averaging of runs; front/hind means and left–right asymmetry indices.
- Statistics:
  - Tests: Welch t-test / one-way ANOVA or Mann–Whitney U / Kruskal–Wallis.
  - Corrections: Holm within each parameter, Benjamini–Hochberg FDR across parameters.
  - Effect sizes: Hedges' g.
  - Treatment rescue %.
  - Optional speed adjustment.
- Views: written summary with phenotype-pattern scoring, gait-fingerprint heatmap, per-paw parameter explorer, progression over time, speed check, and data tables.
- Exports: per-animal CSV, statistics CSV, Markdown summary, SVG/PNG charts, print to PDF.
- Tutorial: how CatWalk works, experimental design, gait-cycle, paw-print, coordination and support concepts, why speed matters, gait signatures of disease models with PubMed-verified references, and a searchable parameter glossary.
- Demo dataset (simulated gene-therapy study) and a GitHub Pages deployment workflow.

[1.1.0]: https://github.com/adamskate123/Catwalkanalysis/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/adamskate123/Catwalkanalysis/releases/tag/v1.0.0
