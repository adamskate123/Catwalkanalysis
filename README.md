# Gait Lab · CatWalk Analyzer

**Version 1.3.0**. See [CHANGELOG.md](CHANGELOG.md) for release notes; the app also shows them under *What's new* in the footer.

A web app that turns **CatWalk XT** (Noldus) gait-analysis exports into structured graphs, statistics and a written phenotype summary, with a built-in tutorial on how CatWalk works and how its parameters change in models of neurological disease.

It runs in any modern browser on **phones, tablets and desktops**, and can be installed as an app (Add to Home Screen / Install app). It works offline once loaded. **All processing happens on your device; files are never uploaded.**

## Features

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
  - **Gait fingerprint**: an effect-size heatmap for all paws and parameters.
  - **Parameters**: per-paw dot plots with individual animals, mean ± SEM, stats tables and time courses.
  - **Over time**: effect-size progression across timepoints.
  - **Speed check** and **Data & export**: CSV of per-animal values and statistics, a Markdown summary, SVG/PNG charts, and print to PDF.
- **GraphPad Prism export (.pzfx)**: per-animal values laid out as Prism data tables. Column tables group values side by side for each parameter and timepoint. Grouped tables are timepoints × groups, with animals as replicate subcolumns kept in the same position at every timepoint, so repeated-measures two-way ANOVA or mixed-effects analysis runs directly. The file opens in Prism 5–10 via File → Open.

**Learn**: how CatWalk works (illuminated-footprint technology, runs, compliance), running a good experiment (including longitudinal/gene-therapy designs), anatomy of a step, paw prints and weight bearing, interlimb coordination, support and base of support, why speed matters, gait signatures of disease models (SCI, pain/nerve injury, parkinsonism, HD, stroke, ALS, ataxia) with PubMed-verified references, and a searchable parameter glossary.

## Serial experiments

Each analysis is saved as an **experiment** on your device and can grow over time:

1. Load your first CatWalk export (and animal key). An experiment is created and saved automatically.
2. Later, open it from the start screen and choose **+ Add data** to add new or updated exports. Repeated rows replace the old copy, new animals and timepoints are added, and your settings are kept.
3. If CatWalk's Time_Point is left as "Undefined", give each added file a **session label** (e.g. "Week 8") to build a longitudinal dataset.
4. **Export a backup** (`.gaitlab.json`) after each session. Storage is per browser and per device, and some browsers, notably iOS Safari for sites not added to the Home Screen, can clear it. Drop a backup on the start screen to restore it on any device.

## Exporting from CatWalk XT

After classifying runs, export the **run statistics** (one row per run) to Excel or text. Include your independent variables (genotype, treatment, timepoint) and the animal/trial identifier. A demo file with the expected layout can be downloaded from the app's start screen. The **Try with demo data** button loads simulated data from a hypothetical gene-therapy study (WT, Model + Vehicle, Model + AAV at 4, 8 and 12 weeks).

## Development

```bash
npm install
npm run dev        # local dev server (add --host to open it from a phone on the same network)
npm test           # unit tests (statistics are checked against SciPy reference values)
npm run lint
npm run build      # production build in dist/
```

Stack: React + TypeScript + Vite, `read-excel-file` and `papaparse` for parsing, hand-written SVG charts and statistics (no server).

## Versioning

The app follows [Semantic Versioning](https://semver.org/). To release a new version:

1. Bump `version` in `package.json`. The app reads it at build time and shows it in the footer.
2. Add a matching `## [x.y.z] - YYYY-MM-DD` entry at the top of `CHANGELOG.md`.

A unit test checks that the latest changelog entry matches `package.json`.

## Deployment

`.github/workflows/deploy.yml` tests, builds and publishes the app to **GitHub Pages** on every push to `main`. To enable it, go to the repository's **Settings → Pages** and set **Source** to **GitHub Actions**. The app will be served at `https://<user>.github.io/<repo>/`. Open that URL on a phone and choose *Add to Home Screen* to install it.

## Caveats

Automated interpretations are pattern-based aids for orientation, not diagnoses. Confirm them with study-specific hypotheses, histology and complementary behavioural tests. For definitive repeated-measures analyses, export the per-animal CSV and fit mixed models (for example with speed as a covariate).

CatWalk is a trademark of Noldus Information Technology. This project is independent and is not affiliated with Noldus.
