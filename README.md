# Behavior Lab · Gait, Rotarod, Open Field, Cage Hang

**Version 2.4.0**. See [CHANGELOG.md](CHANGELOG.md) for release notes; the app also shows them under *What's new* in the footer.

A web app that turns rodent behavioural data into structured graphs, statistics and a written phenotype summary, with a built-in tutorial for each test. It contains four programs; switch between them by clicking the name and icon at the top left:

| Program | Test | Data it reads |
| --- | --- | --- |
| **Gait Lab** | CatWalk XT gait analysis | CatWalk XT run/trial statistics |
| **Rotarod Lab** | Rotarod motor coordination and learning | SDI Rotor-Rod exports; Excel/CSV; Prism 10 `.prism` |
| **Open Field Lab** | Open field activity and anxiety-like behaviour | EthoVision XT statistics exports; Excel/CSV; Prism 10 `.prism` |
| **Cage Hang Lab** | Inverted cage-lid / grid hang (limb strength and endurance) | Excel/CSV; Prism 10 `.prism` |

It runs in any modern browser on **phones, tablets and desktops**, and can be installed as an app (Add to Home Screen / Install app). It works offline once loaded. **All processing happens on your device; files are never uploaded.**

## Programs

- **Rotarod Lab** recognises latency to fall, rod speed at fall, distance and passive rotations. It averages trials per animal and day, and computes best, first and last trial and the first-to-last improvement for each animal. A **Learning curves** tab plots every trial of every day. Prism export adds "by trial" grouped tables for repeated-measures analysis. It flags impaired coordination and balance, reduced motor learning, and gripping instead of walking.
- **Open Field Lab** recognises distance, velocity, time moving and immobile, centre time, entries and latency, periphery time, rearing, grooming, stereotypy and fecal boli, including EthoVision's long column names (`In zone Center / Center-point Cumulative Duration s`). Within-session intervals (EthoVision time bins, or Prism sheets such as "Distance vs interval ≤50 days" with groups "… interval 1", "… interval 2") are read as intervals: a **Habituation** tab plots each group across the session, and the first interval, last interval and % change first → last are tested per animal. It flags hypo- and hyperactivity, anxiety-like centre avoidance, reduced centre avoidance and repetitive behaviour.
- **Cage Hang Lab** recognises hang time (latency to fall), best, first and last trial, the change from first to last trial, number of falls and body weight. It computes **holding impulse** (body weight × hang time, g·s; Deacon 2013) when weights are present; holding impulse is not further adjusted for weight. A **Trials** tab plots every trial, and a warning appears when many values sit at the cut-off. It flags reduced grip strength and endurance, and fatigue across trials.
- **Body weight** (all programs): load a weights file (Excel or Prism) with the behavioural data and each animal's weight is matched by ear tag, age window and sex. Weight is analysed as a parameter, shown in a **Weight check** tab, and can be used as a covariate (Setup → Statistics → Adjust for body weight; pooled within-group slope, ANCOVA-style).
- **Combine groups** under Setup → Groups (e.g. several wild-type cohorts analysed as one control) and split them again; the Story tab offers this as a switch when several groups look like controls.
- Everything below that is not specific to paws or walking speed applies to all four programs: Summary, Story, fingerprint, Parameters, Over time, filters, statistics, Prism export and saved experiments.

## Importing Prism and Excel tables

Besides instrument exports, every program reads:

- **Prism 10 projects (`.prism`)**:
  - The data-table title is the measure. An age or time window in it ("Latency 51-100 days", "P30") becomes the timepoint.
  - Data-set titles are groups; sex and "n=" are read from them ("A477T Affected Males n=19" → group *A477T Affected*, sex *M*).
  - A sex in the sheet title ("Rotarod - Males 50 days") sets the sex of every animal in it.
  - Row titles are animal IDs. Animals are matched across tables by ID, so pooled and per-sex copies are counted once.
  - Replicate subcolumns are averaged as repeated values of the same animal, unless titled "Trial 1", "Trial 2"…, which are read as trials.
  - Tables whose titles lack a window but repeat the binned data ("Males", "Females", "all ages") are skipped.
  - On loading, the app lists stale "n=" in group titles, animals filed under different groups, and Prism's floating notes.
- **Prism-style spreadsheets**: one column (or block of subcolumns) per group, one row per animal; the sheet name is the measure.
- **Long tables**: animal, group, …, a *Measure* column and a *Value* column.
- **Wide tables**: one column per trial, day or time bin (`Trial 1`, `Day 2 Trial 3`, `0-5 min`).

A "Prism tables" setting on the start screen chooses whether table rows are animals (subcolumns = trials) or trials/time bins (subcolumns = animals).

## Gait Lab (CatWalk) features

**Analyze**
- Load one or more `.xlsx`, `.csv`, `.tsv` or `.txt` exports (run statistics, one row per run). Preamble lines and two-row Mean/StDev headers are handled, and ~50 CatWalk parameters are recognised across naming variants (`RF Stand (s)_Mean`, `RF_Stand_(s)_Mean`, `Stand_RF`, `Right Front Stand`…). Unrecognised numeric columns are still analysed.
- Tested against CatWalk XT 10 Run Statistics and Trial Statistics exports. Add an **animal key** spreadsheet (genotype, sex, age…) and it is joined to the gait data automatically by the matching ID column (e.g. trial name).
- **Filters** (e.g. one sex) and a **run-quality** filter on maximum speed variation, plus warnings for sex or age imbalance, inconsistent acquisition settings and animals with too few runs.
- Auto-detects the animal ID, group, timepoint and compliance columns, and guesses the control and untreated-disease groups. Everything can be changed in **Setup**.
- Averages compliant runs per animal, so n = animals and not runs. Adds front/hind means and left–right asymmetry indices for every per-paw parameter.
- Statistics: Welch t-test / one-way ANOVA or Mann–Whitney U / Kruskal–Wallis; Holm adjustment within each parameter; Benjamini–Hochberg FDR across parameters; Hedges' g effect sizes; **rescue %** for treatment studies (control, untreated disease and treated groups).
- Optional **speed adjustment** (pooled within-animal regression on run speed), plus a speed-check view, because most CatWalk parameters depend on walking speed.
- Views:
  - **Summary**: a written narrative, phenotype-pattern scoring (global slowing, ataxia, interlimb coordination, hind- or fore-limb deficit, lateralised deficit, hyperkinesia), largest changes and treatment rescue.
  - **Story**: figures grouped by phenotype pattern, with what each pattern may mean, suggested confirmatory tests and a per-story Prism export. Its "Before drawing conclusions" section has switches (speed-variation filter, speed adjustment, one sex only, minimum runs) with live previews of how each changes the result.
  - **Gait fingerprint**: an effect-size heatmap for all paws and parameters.
  - **Parameters**: per-paw dot plots with individual animals, mean ± SEM, stats tables and time courses.
  - **Over time**: effect-size progression across timepoints.
  - **Speed check** and **Data & export**: CSV of per-animal values and statistics, a Markdown summary, SVG/PNG charts, and print to PDF.
- **GraphPad Prism export (.pzfx)**: choose exactly which parameters to export (or use the key set, or only changed parameters); each becomes its own Prism data table. Column tables group values side by side for each parameter and timepoint. Grouped tables are timepoints × groups, with animals as replicate subcolumns kept in the same position at every timepoint, so repeated-measures two-way ANOVA or mixed-effects analysis runs directly. The file opens in Prism 5–10 via File → Open.

**Learn**: how CatWalk works (illuminated-footprint technology, runs, compliance), running a good experiment (including longitudinal/gene-therapy designs), anatomy of a step, paw prints and weight bearing, interlimb coordination, support and base of support, why speed matters, gait signatures of disease models (SCI, pain/nerve injury, parkinsonism, HD, stroke, ALS, ataxia) with PubMed-verified references, and a searchable parameter glossary.

## Serial experiments

Each analysis is saved as an **experiment** on your device and can grow over time:

1. Load your first CatWalk export (and animal key). An experiment is created and saved automatically.
2. Later, open it from the start screen and choose **+ Add data** to add new or updated exports. Repeated rows replace the old copy, new animals and timepoints are added, and your settings are kept.
3. If CatWalk's Time_Point is left as "Undefined", give each added file a **session label** (e.g. "Week 8") to build a longitudinal dataset.
4. **Export a backup** (`.gaitlab.json`) after each session. Storage is per browser and per device, and some browsers, notably iOS Safari for sites not added to the Home Screen, can clear it. Drop a backup on the start screen to restore it on any device.

## Exporting from CatWalk XT

After classifying runs, export the **run statistics** (one row per run) to Excel or text. Include your independent variables (genotype, treatment, timepoint) and the animal/trial identifier. A demo file with the expected layout can be downloaded from the app's start screen. The **Try with demo data** button loads simulated data from a hypothetical gene-therapy study (WT, Model + Vehicle, Model + AAV at 4, 8 and 12 weeks).

## References

All sources behind the tutorials, phenotype patterns, statistics and file formats are listed in [REFERENCES.md](REFERENCES.md) and in the app under *References & sources* (footer). The list lives in `src/lib/references.ts`; after editing it, run `node scripts/references-md.mjs` to regenerate REFERENCES.md (a unit test checks they match).

## Development

```bash
npm install
npm run dev        # local dev server (add --host to open it from a phone on the same network)
npm test           # unit tests (statistics are checked against SciPy reference values)
npm run lint
npm run build      # production build in dist/
```

Stack: React + TypeScript + Vite, `read-excel-file` and `papaparse` for parsing, `fflate` for Prism 10 files, hand-written SVG charts and statistics (no server).

## Versioning

The app follows [Semantic Versioning](https://semver.org/). To release a new version:

1. Bump `version` in `package.json`. The app reads it at build time and shows it in the footer.
2. Add a matching `## [x.y.z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md`.

A unit test checks that the latest changelog entry matches `package.json`.

## Deployment

`.github/workflows/deploy.yml` tests, builds and publishes the app to **GitHub Pages** on every push to `main`. To enable it, go to the repository's **Settings → Pages** and set **Source** to **GitHub Actions**. The app will be served at `https://<user>.github.io/<repo>/`. Open that URL on a phone and choose *Add to Home Screen* to install it.

If a merge to `main` does not start a deploy (the footer still shows the previous version), open **Actions → Test and deploy to GitHub Pages → Run workflow**, choose `main`, and run it.

## Caveats

Automated interpretations are pattern-based aids for orientation, not diagnoses. Confirm them with study-specific hypotheses, histology and complementary behavioural tests. For definitive repeated-measures analyses, export the per-animal CSV and fit mixed models (for example with speed as a covariate).

CatWalk and EthoVision are trademarks of Noldus Information Technology; Rotor-Rod is a trademark of San Diego Instruments; Prism is a trademark of GraphPad Software. This project is independent and is not affiliated with any of them.
