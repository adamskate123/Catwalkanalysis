# Changelog

All notable changes to Gait Lab (CatWalk Analyzer) are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/).

## [1.2.0] - 2026-09-26

Tested against real CatWalk XT 10 Run Statistics and Trial Statistics exports.

### Added

- **Animal key files.** Load a spreadsheet with genotype, sex, date of birth, age and similar columns alongside the CatWalk export. It is detected automatically and joined to the gait data through the column whose values match (for example "CatWalk trial name" ↔ Trial). Setup reports which animals matched and which didn't. Free-text notes written below the key table are shown as notes in the Summary.
- **Filters** (Setup → Filters): restrict the analysis to a subset of animals, such as one sex, using any descriptive column.
- **Run quality** (Setup → Run quality): optionally exclude runs whose maximum speed variation exceeds a threshold (default 60%).
- New data-quality warnings: runs with high speed variation, sex imbalance between groups, age differences between groups, acquisition settings (camera gain, intensity threshold, lighting) that differ between recordings, and animals missing from the key.
- New parameters: toe spread, intermediate toe spread, manual print length, paw angles (body axis and movement vector), and the sciatic, peroneal and posterior tibial functional indices.
- Phase-dispersion and coupling **consistency (R)** from CatWalk's circular statistics, included in the interlimb-coordination pattern.

### Changed

- CatWalk XT 10 column names are now recognised throughout: `OtherStatistics_` values (cadence, number of steps, functional indices), underscore metadata (`Group_Type`, `Time_Point`, `*_Description`), and circular statistics (`CStat Mean`, `AD`, `R`).
- The control group is taken from CatWalk's `Group_Type = Control` when present.
- A time column is only used when it has at least two real timepoints (CatWalk writes "Undefined" when none were set).
- Trial Statistics files use their `NumberOfRunsUsedForCalculatingTrialStatistics` column for run counts.
- Loading Run and Trial Statistics files from the same experiment together no longer counts the animals twice: the run file is used and a notice explains why.

### Fixed

- `-` placeholders in CatWalk exports are treated as missing values.
- Acquisition-setting columns and the run-count column are no longer analysed as gait parameters.
- Trailing spaces in group names (e.g. "JAX WT ") no longer split groups.

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

[1.2.0]: https://github.com/adamskate123/Catwalkanalysis/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/adamskate123/Catwalkanalysis/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/adamskate123/Catwalkanalysis/releases/tag/v1.0.0
