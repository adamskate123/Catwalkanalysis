# Changelog

All notable changes to Behavior Lab (formerly Gait Lab · CatWalk Analyzer) are recorded here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and version numbers follow [Semantic Versioning](https://semver.org/).

## [2.7.1] - 2026-10-01

### Fixed

- **Exported graphs now carry their title and legend.** Single, per-tab and bulk exports draw these into the image itself (on screen they sit in the card around the chart):
  - the parameter name (e.g. *Coupling LF→RH*, *Print area (LF)*);
  - the timepoint or age window (e.g. *Age 51-55 days*);
  - a group legend with n for dot plots;
  - a caption: bars = mean ± SEM, points = animals, what * / ** / *** and ns mean, the comparison group, the test and its multiple-comparison correction.
- Fingerprint exports name the comparison (e.g. *Per-paw fingerprint: Mut vs WT*).
- Line charts leave room for long group names next to the last point instead of cutting them off.

## [2.7.0] - 2026-10-01

Tested with a real CatWalk XT run-statistics export and its animal key.

### Added

- **Age windows** (Setup → Age windows):
  - **Age at test** is calculated from each animal's date of birth and test date. Dates of birth come from an animal key or are entered or pasted in Setup (one "ID, date" pair per line). Test dates come from:
    - the timepoint column, when it holds dates;
    - a test-date column in the key;
    - a date entered per timepoint or session;
    - a date in the experiment name.
  - **Windows you set**: consecutive bins (≤50, 51-100, … days, named like age-binned Prism sheets for rotarod and open field) or target ages ± days. Runs without an age, or outside every window, are left out and counted in a notice.
  - **Switching timepoints**: the age window is a timepoint like the instrument's own. "Analyse timepoints by" in Setup, and a switch above the results, move between age windows, the data files' timepoints and no timepoints. Every tab, statistic and export follows.

### Fixed

- **Body contacts in CatWalk XT exports are now read.** XT names them `OtherStatistics_AB`, `TA`, `GT`, `NO`, `RK`, `LK`, `RM` and `LM` (%). The order matches the published list (right hip, right knee, left hip, left knee, nose, abdomen, tail, genitalia), so RM/LM are read as right/left hip. Columns that are always zero (contacts not labelled) are not analysed.

### Changed

- The dragging pattern notes that in complete hind-limb paralysis prints shrink rather than lengthen, so labelled abdomen contact is then the better marker (Zheng et al. 2023, which also supports hind ÷ front corrected values).

## [2.6.0] - 2026-09-30

Checked against the CatWalk literature in PubMed (Hamers et al. 2001 and 2006; Koopmans et al. 2005; Timotius et al. 2023; Basso et al. 2006).

### Added

- **Print elongation (length ÷ width)** for each paw, with front, hind, asymmetry and hind ÷ front values. It is a shape measure: it does not scale with paw size or body weight, and it is not adjusted for weight.
- **Hind ÷ front ratios** for print length, print area, max contact area, max and mean intensity, and elongation. They correct for body size (hind/fore ratios of print size and intensity are used after thoracic spinal cord injury) and are shown as an H÷F column in the Gait fingerprint.
- **Body contact parameters.** When abdomen, tail, genitalia, nose, hip or knee contacts are labelled during classification in CatWalk XT, their "% of run" columns are read as a new "Body contact with the glass (dragging)" category.
- **Hind-paw dragging / poor hind-limb clearance** pattern:
  - Key markers: hind elongation ↑, hind ÷ front elongation ↑ and body contact ↑.
  - Supporting markers: hind swing speed ↓, hind stance ↑, hind stride ↓ and regularity index ↓. These are the CatWalk changes reported consistently after spinal cord injury, but they are not specific to dragging.
- **Key markers for patterns.** A pattern can name key markers; it is then shown and reported only when at least one of them changed. The dragging pattern cannot be triggered by slower, shorter hind steps alone.

## [2.5.1] - 2026-09-30

Tested with a real CatWalk XT run-statistics export (two test dates) and a weekly colony weight log.

### Fixed

- **Animal keys no longer join on numbers that happen to overlap.** The key join only considers text ID columns. Previously a weight log could be joined on its *Weigh-ins (n)* count against CatWalk's *StepSequence_NumberOfPatterns*, which attached the wrong sex and genotype to runs and split one animal into several.
- **Compliant-run warning counts animal-timepoints correctly** and says what it counted: runs with speed variation at or under the run-quality threshold (60% by default) and a duration of 0.5–5 s. It lists each animal-timepoint that falls short, e.g. "KX9.2 LFLR @ 9/30/2026: 0 of 4". It no longer counts every run as compliant when the run-quality filter is off.

### Added

- **Two-column animal IDs and word matching.** The key ID can combine two columns (e.g. Tag Number + Toe/Ear Mark → "KX9.1 LF"), and an ID matches when all of its words appear in exactly one key entry ("JAX NM" ↔ "Jax Ctrl" + "NM"). Setup → Animal key says how many IDs were matched by words so they can be checked.
- **Pick the join by hand** under Setup → Animal key: the ID column in the data, the ID column in the key and an optional second key column. The choice is saved with the experiment; *Choose automatically again* undoes it.
- **Weekly weight logs** (date-headed weight columns) supply the weigh-in nearest each test date, within 7 days, as *Body weight (g)*, instead of adding every weekly column. Runs with no weigh-in that close are counted in a notice.
- **Age at test (d)** is calculated from a DOB column and the test date, rather than using ages stored in the key, which depend on the day the spreadsheet was opened.

## [2.5.0] - 2026-09-29

### Added

- **Prism with graphs and statistics (.zip)** on the Data & export tab. It contains:
  - the Prism project with, in addition to the data tables, one "Statistics" table per timepoint holding the app's results exactly as calculated: n, mean, SD and SEM per group, omnibus p, FDR q and, per comparison, % difference, Hedges g, test statistic, df, p and Holm-adjusted p;
  - the graphs of the same parameters (plus fingerprint and progression heatmaps) as SVG and PNG;
  - `statistics.csv`, the written summary, a README and `methods.txt`, which states the settings and the tests run.
  - Prism cannot import the app's graphs as editable Prism graphs, so they are included as image files.
- **Export this tab's graphs**, above every tab with charts: all charts on that tab as PNG, SVG or both.
- **Download every graph (.zip)**: every chart the app can draw for the analysis, in folders by tab and timepoint, in the light theme.

### Changed

- Exported SVG and PNG charts now include the group legend, and heatmaps include their colour scale.
- File names keep age-window signs readable ("≤50 days" → "up_to_50_days").

### Fixed

- Body weight no longer gets "first / last interval" habituation parameters or a trial curve when a weights file is joined to per-interval or per-trial data.

## [2.4.0] - 2026-09-29

Tested with the real open field Prism file that holds within-session interval sheets.

### Added

- **Cage Hang Lab**, a fourth program for the inverted cage-lid / grid hang test.
  - It reads hang time (latency to fall) per trial from Excel, CSV or Prism, and computes best, first and last trial and the change from first to last trial for each animal.
  - With body weights loaded it computes **holding impulse** (weight × hang time, g·s), which is not adjusted for weight again.
  - Phenotype patterns: reduced grip strength and endurance, and fatigue across trials. A **Trials** tab, a tutorial, demo data and references (Deacon 2013; Aartsma-Rus & van Putten 2014) are included.
  - A warning appears when many values sit at the cut-off (as for rotarod latency).
- **Open field: habituation across intervals.**
  - Prism sheets such as "Average Distance vs interval ≤50 day" (groups "Male Jax WT n=3 interval 1…4") are now read as values per interval instead of being skipped. EthoVision time-bin columns are read the same way.
  - A **Habituation** tab plots each group across the intervals of the session.
  - For distance, speed, moving and immobile time, the first interval, last interval and % change first → last are new per-animal parameters, with a "reduced habituation" pattern.

### Changed

- Sheet titles ending in "day"/"week"/"month" and "days"/"weeks"/"months" now give the same timepoint.
- Line charts no longer overlap the last x-axis label with the one before it on narrow screens.
- The "fewer than 3 trials" advice applies only to programs that analyse trials.

## [2.3.0] - 2026-09-28

Tested with real Prism 10 files: body weights, and open field data binned by age (one file with sexes combined, one split by sex).

### Added

- **Body weight as a parameter and a covariate (all programs).**
  - A weights file (Excel or Prism) loaded with rotarod, open field or CatWalk data is matched to each animal by ear tag, age window and sex. Several weighings in one window are averaged.
  - Files that bin ages differently still match: a weight at "100 days" is used for the "51–100 days" window.
  - Body weight is analysed like any parameter, since weight loss can be part of the phenotype.
- **Adjust for body weight** (Setup → Statistics, and a Story switch with preview).
  - It is an ANCOVA-style adjustment. The slope of each parameter on weight is pooled within groups, and values are re-centred on the mean weight at each timepoint.
  - The Story switch appears when groups differ in weight and states how much the main parameter changes per gram.
  - A warning appears when groups differ in weight, and the written summary and Prism notes say when values were adjusted.
- **Weight check tab.** It shows body weight by group and plots any parameter against weight per animal, with the within-group slope.
- **Open field: zone-specific measures.** Resting time, speed and distance in the centre and in the periphery.
  - The zone is read from Prism group titles, e.g. the "Jax WT Periphery" groups of a "Total Center Time" table become "Total Periphery Time".

### Changed

- A file with sexes combined and a file split by sex that describe the same animals are now combined. Sex keeps two rows apart only when both rows state different sexes.
- Sheet titles:
  - "- combined" / "Males and Females combined" are ignored when naming measures;
  - age windows written "301 - 350 days", "50 Days" or "≤50 days-" are recognised and normalised;
  - "… all ages" sheets are treated as repeats of the age-binned sheets.
- Within-session interval sheets ("Resting time v interval …") are skipped with a note, since habituation isn't analysed yet.
- Values in Prism rows without an animal ID are left out, with a note listing them, instead of becoming extra animals.
- Open field summaries say "values" rather than "trials" when repeated values (e.g. two test dates) are averaged.

## [2.2.0] - 2026-09-28

### Added

- **Combine groups** (Setup → Groups, all programs). Tick two or more groups, name the combined group, and they are analysed as one, for example several wild-type cohorts ("Jax WT", "EIF Jax WT", "New Jax WT").
  - A combined group shows its members and has a **Split** button to undo.
  - The original labels stay in the data, and the combination is saved with the experiment.
  - Data added later that belong to a combined group join it automatically.
  - The panel opens automatically when more than one group looks like a control.
- **Story switch: "Combine control cohorts into …"**. It appears when several groups look like controls, with the usual live preview.
  - It shows each cohort's mean and n.
  - It warns when a cohort differs significantly from the main control, since the cohorts may not be interchangeable.
  - It is left out of "Apply all switches" because it is a study-design choice.

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
