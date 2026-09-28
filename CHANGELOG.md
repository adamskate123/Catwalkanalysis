# Changelog

All notable changes to Behavior Lab (formerly Gait Lab · CatWalk Analyzer) are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2026-09-28

Tested against a real Prism 10.6 rotarod project with per-sex and pooled age-binned sheets.

### Added

- **Sex from sheet titles.** "Rotarod - Males 50 days" gives measure *Rotarod*, timepoint *50 days* and sex *M*, so per-sex sheets of the same measure form one column. Sheets naming both sexes ("Male vs Female") give no sex.
- **Pooled and per-sex copies are combined, not double-counted.** Animals with an ID (ear tag) are matched across tables by ID and timepoint.
  - Sex and group come from the sex-specific sheet, whose titles are more reliable than a pooled sheet labelled "Males" for every animal.
  - The same tag in a male and a female sheet stays two animals.
  - The app notes how many values were repeated and whether any differed.
- **Checks shown when a Prism file is loaded:**
  - group titles whose "n=" no longer matches the animals in the table;
  - animals listed under different groups in different sheets (e.g. "New Jax WT" in the per-sex sheet vs "Jax WT" in the pooled sheet);
  - Prism floating notes attached to sheets (e.g. animals necropsied before a session).
- **Ceiling warning (rotarod):** flags when many latencies sit exactly at the trial cut-off (e.g. 90 s), with advice on tests and protocol.

### Changed

- **Prism replicate subcolumns are averaged** as repeated values of the same animal (e.g. two sessions near the target age). They are no longer treated as trials. Subcolumns titled "Trial 1", "Trial 2"… are still read as trials, with best/first/last trial and improvement.
- Results open on the timepoint with the most animals, instead of always the last one.
- The written summary counts parameters that changed in **any** group vs control and names the groups. It previously said "each group" but counted only the first.
- A phenotype pattern is reported when at least two of its markers change, or all of them when fewer than two were measured, so a latency-only rotarod file can still be summarised.
- Wild-type is preferred as the control over other control-like names ("Het", "EIF Jax WT", "New Jax WT").
- Groups with no animals at a timepoint are left out of the summary and sex-balance text.
- The sex-balance warning no longer mentions paw print area outside Gait Lab.
- The program name no longer truncates in the header on wide screens.

## [2.0.0] - 2026-09-28

### Added

- **Three programs in one app.** Click the name and icon at the top left (where "Gait Lab" was) to switch between:
  - **Gait Lab**: CatWalk XT gait analysis, unchanged.
  - **Rotarod Lab**: latency to fall, rod speed at fall, distance and passive rotations. Trials are averaged per animal and day. Best, first and last trial and the first-to-last improvement are worked out for every animal. Patterns flagged: impaired coordination and balance, reduced motor learning, gripping instead of walking, and longer-than-control latencies.
  - **Open Field Lab**: distance, velocity, time moving and immobile, centre time, entries and latency, periphery time, rearing, grooming, stereotypy and fecal boli. EthoVision XT column names are recognised. Patterns flagged: hypoactivity, hyperactivity, anxiety-like centre avoidance, reduced centre avoidance, and repetitive behaviour.
  - The last program used is remembered.
- **Per-program experiments.** Saved experiments belong to the program they were made in. The start screen lists them and notes how many are saved in the other programs. Backups carry the program too.
- **Learning curves tab (rotarod).** It plots group mean ± SEM for every trial of every day. The Prism export adds "by trial" grouped tables for repeated-measures two-way ANOVA or mixed-effects models.
- **Prism and Excel import for every program.**
  - **Prism 10 projects (.prism):**
    - Each data table's title becomes the measure name.
    - Age or time windows in the title (e.g. "51–100 days", "P30") become timepoints.
    - Data-set titles become groups, with sex and "n=" read from them (e.g. "A477T Affected Males n=19").
    - Replicate subcolumns become trials.
    - Master sheets that repeat the age-binned data ("Males", "Females", "all ages") are skipped, with a note.
  - **Prism-style spreadsheets:** one column per group, or blocks of replicate subcolumns, with one row per animal.
  - **Long tables:** a measure column plus a value column.
  - **Wide trial tables:** columns such as "Trial 1", "Day 2 Trial 3" or "0–5 min".
  - **Layout setting:** "Prism tables" on the start screen and in Add data. Choose whether rows are animals or trials/time bins.
- Rotarod and Open Field tutorials under Learn, with references verified in PubMed: Deacon 2013; Rustay, Wahlsten & Crabbe 2003 (×2); Seibenhener & Wooten 2015; Prut & Belzung 2003.
- Demo data for each program.
- **References & sources** page (footer link) and `REFERENCES.md`, both listing every source the app is built on. That includes the CatWalk, rotarod and open field literature, the statistical methods (Welch, Mann–Whitney, Kruskal–Wallis, Holm, Benjamini–Hochberg, Hedges, Numerical Recipes, SciPy) and the instrument and Prism file formats, each with what it was used for. Tutorials cite from the same list.

### Changed

- The app is now called **Behavior Lab**; Gait Lab is its CatWalk program. Wording ("runs"/"trials"), export file names, the Prism project info and the written summary follow the active program.
- CatWalk-only views are hidden in the other programs: Speed check, speed adjustment, compliance and per-paw views.
- When a newly added file repeats rows already in the experiment, values missing from the new file are now kept from the earlier copy instead of being blanked.

## [1.5.0] - 2026-09-28

### Added

- **Switchable checks in "Before drawing conclusions" (Story tab).** Each possible confounder the app detects can now be turned on or off right there. The whole Story (and every other tab) updates immediately, and the choice is saved with the experiment.
  - Exclude runs with more than 60% speed variation (stop-and-go runs).
  - Adjust all parameters for walking speed, offered when groups walk at different speeds.
  - Analyse one sex only, with All / F only / M only buttons, offered when sex is unbalanced across groups.
  - Require at least 3 runs per animal.
  - Age differences between groups are shown as a note, since they can't be adjusted automatically.
- **Live previews.** The section states the current result (animals, changed parameters, phenotype patterns), and each check previews what would happen if you flipped it, e.g. "If applied: 9 animals (−3), 19 changed parameters (+1)". Choices such as which sex are previewed one by one.
- "Apply all switches" and "Reset all" buttons, and a line at the top of the Story listing which refinements are currently applied.

### Changed

- The CatWalk XT 10 synthetic test fixtures moved to a shared module so several test files can use them.

## [1.4.0] - 2026-09-28

### Added

- **Story tab.** Figures are grouped by what they suggest together. Each phenotype pattern with evidence gets a chapter containing:
  - what changed, with its strongest parameters listed;
  - a dot plot for each (and time courses when there are several timepoints);
  - a plain-language "what it might mean";
  - suggested confirmatory tests;
  - a one-click Prism export of just those figures.
  
  It adds a treatment-effect chapter (rescue) when an untreated disease group is set, and a "Before drawing conclusions" chapter covering speed, sex and age confounds.
- **Significance markers in Parameters.** Each parameter in the list shows ★ with the direction (↑/↓) and how many of its measures changed (e.g. 3/8) versus control at the current thresholds and timepoint. There's also an "Only changed" filter, and each parameter page lists which measures changed.
- **Choose exactly which parameters go into the Prism file.** "Choose parameters…" opens a searchable checklist grouped by category, with ★ marking changed parameters and quick "Changed only", "Key set" and "Clear" buttons. A "How the Prism file is organised" explainer covers column vs grouped tables and how to use them in Prism.

## [1.3.0] - 2026-09-26

### Added

- **Saved experiments for serial studies.** Every analysis is now an experiment saved on the device (files, settings and thresholds). The start screen lists your experiments to reopen or delete.
- **Add data over time** (header → *+ Add data*, or the *Experiment & data* tab): add new CatWalk exports, updated re-exports and updated animal keys to an existing experiment.
  - Rows that appear again (same experiment, animal, trial, timepoint/session and run) replace the earlier copy, so re-exporting the whole CatWalk experiment each time is safe.
  - New animals, groups and timepoints join the analysis, and your settings, group order and timepoint order are kept.
  - After adding, a summary reports new rows, new animals, new timepoints, and which key columns were joined.
- **Session labels**: tag the files you add (e.g. "Week 8") when CatWalk's Time_Point is "Undefined". The labels become the timepoints for longitudinal views and Prism grouped tables, and can be edited later.
- **Backups**: export an experiment to a `.gaitlab.json` file and restore it on any device by dropping it on the start screen.
- Experiment name and notes; file list with removal and per-file session labels.

### Changed

- When several CatWalk experiments are combined and their Animal IDs are CatWalk's generic numbers (Animal0001…, which restart in each experiment), the trial name is used to identify animals.
- Newer animal-key entries override older ones for the same animal.

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

[1.5.0]: https://github.com/adamskate123/Catwalkanalysis/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/adamskate123/Catwalkanalysis/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/adamskate123/Catwalkanalysis/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/adamskate123/Catwalkanalysis/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/adamskate123/Catwalkanalysis/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/adamskate123/Catwalkanalysis/releases/tag/v1.0.0
