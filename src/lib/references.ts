// Every published source behind Behavior Lab: the tutorials, the phenotype
// patterns, the statistics and the file formats. Tutorials cite from here and
// the References & sources page lists it all.
//
// Journal articles in the biomedical groups were verified in PubMed; the
// statistics papers (not indexed in PubMed) were checked against the
// publisher's record.

export interface Reference {
  id: string
  text: string
  doi?: string
  url?: string
}

export interface ReferenceGroup {
  id: string
  title: string
  /** How the sources in this group were used. */
  use: string
  verified: string
  refs: Reference[]
}

export const CATWALK_REFS: Reference[] = [
  { id: 'hamers2006', text: 'Hamers FPT, Koopmans GC, Joosten EAJ. CatWalk-assisted gait analysis in the assessment of spinal cord injury. J Neurotrauma. 2006;23(3-4):537-48.', doi: '10.1089/neu.2006.23.537' },
  { id: 'batka2014', text: 'Batka RJ, Brown TJ, Mcmillan KP, et al. The need for speed in rodent locomotion analyses. Anat Rec. 2014;297(10):1839-64.', doi: '10.1002/ar.22955' },
  { id: 'vrinten2003', text: "Vrinten DH, Hamers FFT. 'CatWalk' automated quantitative gait analysis as a novel method to assess mechanical allodynia in the rat; a comparison with von Frey testing. Pain. 2003;102(1-2):203-9.", doi: '10.1016/s0304-3959(02)00382-2' },
  { id: 'vogelaar2004', text: 'Vogelaar CF, Vrinten DH, Hoekman MFM, et al. Sciatic nerve regeneration in mice and rats: recovery of sensory innervation is followed by a slowly retreating neuropathic pain-like syndrome. Brain Res. 2004;1027(1-2):67-72.', doi: '10.1016/j.brainres.2004.08.036' },
  { id: 'vandeputte2010', text: 'Vandeputte C, Taymans JM, Casteels C, et al. Automated quantitative gait analysis in animal models of movement disorders. BMC Neurosci. 2010;11:92.', doi: '10.1186/1471-2202-11-92' },
  { id: 'hendriks2006', text: 'Hendriks WTJ, Eggers R, Ruitenberg MJ, et al. Profound differences in spontaneous long-term functional recovery after defined spinal tract lesions in the rat. J Neurotrauma. 2006;23(1):18-35.', doi: '10.1089/neu.2006.23.18' },
  { id: 'gensel2006', text: 'Gensel JC, Tovar CA, Hamers FPT, et al. Behavioral and histological characterization of unilateral cervical spinal cord contusion injury in rats. J Neurotrauma. 2006;23(1):36-54.', doi: '10.1089/neu.2006.23.36' },
  { id: 'caballero2017', text: 'Caballero-Garrido E, Pena-Philippides JC, Galochkina Z, et al. Characterization of long-term gait deficits in mouse dMCAO, using the CatWalk system. Behav Brain Res. 2017;331:282-96.', doi: '10.1016/j.bbr.2017.05.042' },
  { id: 'vergouts2015', text: 'Vergouts M, Marinangeli C, Ingelbrecht C, et al. Early ALS-type gait abnormalities in AMP-dependent protein kinase-deficient mice suggest a role for this metabolic sensor in early stages of the disease. Metab Brain Dis. 2015;30(6):1369-77.', doi: '10.1007/s11011-015-9706-9' },
  { id: 'meszaros2021', text: 'Mészáros L, Riemenschneider MJ, Gassner H, et al. Human alpha-synuclein overexpressing MBP29 mice mimic functional and structural hallmarks of the cerebellar subtype of multiple system atrophy. Acta Neuropathol Commun. 2021;9(1):68.', doi: '10.1186/s40478-021-01166-x' },
  { id: 'kopecky2012', text: 'Kopecky B, Decook R, Fritzsch B. Mutational ataxia resulting from abnormal vestibular acquisition and processing is partially compensated for. Behav Neurosci. 2012;126(2):301-13.', doi: '10.1037/a0026896' },
  { id: 'zimmermann2016', text: "Zimmermann T, Remmers F, Lutz B, Leschik J. ESC-derived BDNF-overexpressing neural progenitors differentially promote recovery in Huntington's disease models by enhanced striatal differentiation. Stem Cell Reports. 2016;7(4):693-706.", doi: '10.1016/j.stemcr.2016.08.018' },
  { id: 'salazar2010', text: 'Salazar DL, Uchida N, Hamers FPT, et al. Human neural stem cells differentiate and promote locomotor recovery in an early chronic spinal cord injury NOD-scid mouse model. PLoS One. 2010;5(8):e12272.', doi: '10.1371/journal.pone.0012272' },
]

export const ROTAROD_REFS: Reference[] = [
  { id: 'deacon2013', text: 'Deacon RMJ. Measuring motor coordination in mice. J Vis Exp. 2013;(75):e2609.', doi: '10.3791/2609' },
  {
    id: 'rustay2003a',
    text: 'Rustay NR, Wahlsten D, Crabbe JC. Influence of task parameters on rotarod performance and sensitivity to ethanol in mice. Behav Brain Res. 2003;141(2):237-49.',
    doi: '10.1016/s0166-4328(02)00376-5',
  },
  {
    id: 'rustay2003b',
    text: 'Rustay NR, Wahlsten D, Crabbe JC. Assessment of genetic susceptibility to ethanol intoxication in mice. Proc Natl Acad Sci U S A. 2003;100(5):2917-22.',
    doi: '10.1073/pnas.0437273100',
  },
]

export const OPENFIELD_REFS: Reference[] = [
  {
    id: 'seibenhener2015',
    text: 'Seibenhener ML, Wooten MC. Use of the Open Field Maze to measure locomotor and anxiety-like behavior in mice. J Vis Exp. 2015;(96):e52434.',
    doi: '10.3791/52434',
  },
  {
    id: 'prut2003',
    text: 'Prut L, Belzung C. The open field as a paradigm to measure the effects of drugs on anxiety-like behaviors: a review. Eur J Pharmacol. 2003;463(1-3):3-33.',
    doi: '10.1016/s0014-2999(03)01272-x',
  },
  {
    id: 'bolivar2009',
    text: 'Bolivar VJ. Intrasession and intersession habituation in mice: from inbred strain variability to linkage analysis. Neurobiol Learn Mem. 2009;92(2):206-14.',
    doi: '10.1016/j.nlm.2009.02.002',
  },
]

export const CAGEHANG_REFS: Reference[] = [
  { id: 'deacon2013strength', text: 'Deacon RMJ. Measuring the strength of mice. J Vis Exp. 2013;(76):2610.', doi: '10.3791/2610' },
  {
    id: 'aartsmarus2014',
    text: 'Aartsma-Rus A, van Putten M. Assessing functional performance in the mdx mouse model. J Vis Exp. 2014;(85):51303.',
    doi: '10.3791/51303',
  },
]

export const STATS_REFS: Reference[] = [
  {
    id: 'welch1947',
    text: "Welch BL. The generalization of 'Student's' problem when several different population variances are involved. Biometrika. 1947;34(1-2):28-35.",
    doi: '10.2307/2332510',
  },
  {
    id: 'mann1947',
    text: 'Mann HB, Whitney DR. On a test of whether one of two random variables is stochastically larger than the other. Ann Math Stat. 1947;18(1):50-60.',
    doi: '10.1214/aoms/1177730491',
  },
  {
    id: 'kruskal1952',
    text: 'Kruskal WH, Wallis WA. Use of ranks in one-criterion variance analysis. J Am Stat Assoc. 1952;47(260):583-621.',
    doi: '10.1080/01621459.1952.10483441',
  },
  { id: 'holm1979', text: 'Holm S. A simple sequentially rejective multiple test procedure. Scand J Stat. 1979;6(2):65-70.', url: 'https://www.jstor.org/stable/4615733' },
  {
    id: 'benjamini1995',
    text: 'Benjamini Y, Hochberg Y. Controlling the false discovery rate: a practical and powerful approach to multiple testing. J R Stat Soc Series B Stat Methodol. 1995;57(1):289-300.',
    doi: '10.1111/j.2517-6161.1995.tb02031.x',
  },
  {
    id: 'hedges1981',
    text: "Hedges LV. Distribution theory for Glass's estimator of effect size and related estimators. J Educ Stat. 1981;6(2):107-28.",
    doi: '10.3102/10769986006002107',
  },
  {
    id: 'press2007',
    text: 'Press WH, Teukolsky SA, Vetterling WT, Flannery BP. Numerical Recipes: The Art of Scientific Computing. 3rd ed. Cambridge University Press; 2007.',
  },
  {
    id: 'virtanen2020',
    text: 'Virtanen P, Gommers R, Oliphant TE, et al. SciPy 1.0: fundamental algorithms for scientific computing in Python. Nat Methods. 2020;17(3):261-72.',
    doi: '10.1038/s41592-019-0686-2',
  },
]

export const FORMAT_REFS: Reference[] = [
  {
    id: 'catwalk-manual',
    text: 'Noldus Information Technology. CatWalk XT reference manual (version 10). Parameter names and definitions; run compliance and speed-variation criteria.',
    url: 'https://www.noldus.com',
  },
  {
    id: 'ethovision',
    text: 'Noldus Information Technology. EthoVision XT: statistics export (dependent variable, zone, body point, statistic and unit in each column name).',
    url: 'https://www.noldus.com',
  },
  {
    id: 'sdi-rotorod',
    text: 'San Diego Instruments. Rotor-Rod system: per-lane latency, rpm at fall and distance.',
    url: 'https://sandiegoinstruments.com',
  },
  {
    id: 'prism-pzfx',
    text: 'GraphPad Software. Prism XML project format (.pzfx), used for the Prism export (column and grouped tables with replicate subcolumns).',
    url: 'https://www.graphpad.com',
  },
  {
    id: 'prism-10',
    text: 'Prism 10 project format (.prism): a ZIP archive of JSON sheet/data-set descriptions and CSV data tables. Layout taken from the lab’s own TBCD behavioural-battery parser (reverse-engineered, not a published specification).',
  },
  {
    id: 'catwalk-xt10-files',
    text: 'CatWalk XT 10 Run Statistics, Trial Statistics and animal-key exports supplied by the user. Only the column headers are kept in the repository (as a test fixture); all test values are synthetic.',
  },
]

export const REFERENCE_GROUPS: ReferenceGroup[] = [
  {
    id: 'catwalk',
    title: 'CatWalk gait analysis (Gait Lab)',
    use: 'Tutorial content, parameter descriptions, the speed-dependence warning and speed adjustment, and the gait phenotype patterns and their typical conditions.',
    verified: 'Verified in PubMed',
    refs: CATWALK_REFS,
  },
  {
    id: 'rotarod',
    title: 'Rotarod (Rotarod Lab)',
    use: 'Tutorial content, protocol advice (accelerating vs fixed speed, task parameters, passive rotations) and the rotarod patterns.',
    verified: 'Verified in PubMed',
    refs: ROTAROD_REFS,
  },
  {
    id: 'openfield',
    title: 'Open field (Open Field Lab)',
    use: 'Tutorial content, the activity and centre/periphery measures, within-session habituation, and the anxiety-like, activity and habituation patterns.',
    verified: 'Verified in PubMed',
    refs: OPENFIELD_REFS,
  },
  {
    id: 'cagehang',
    title: 'Cage hang (Cage Hang Lab)',
    use: 'Tutorial content (inverted screen / cage-lid hanging, cut-offs, trials), the holding impulse (body weight × hang time) and the weakness and fatigue patterns.',
    verified: 'Verified in PubMed',
    refs: CAGEHANG_REFS,
  },
  {
    id: 'stats',
    title: 'Statistical methods (all programs)',
    use: 'Welch t-test, Mann–Whitney U, Kruskal–Wallis, Holm adjustment, Benjamini–Hochberg FDR and Hedges g as implemented in the app. Distribution functions follow Numerical Recipes; the unit tests check results against SciPy.',
    verified: 'Checked against the publisher’s record (SciPy verified in PubMed)',
    refs: STATS_REFS,
  },
  {
    id: 'formats',
    title: 'Instruments, software and file formats',
    use: 'Column recognition for each instrument’s exports, and the Prism import and export formats.',
    verified: 'Manufacturer documentation and example files',
    refs: FORMAT_REFS,
  },
]
