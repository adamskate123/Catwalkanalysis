// Explanatory diagrams for the tutorial. Colours use CSS variables so they
// follow the light/dark theme.

const T = 'var(--text)'
const T2 = 'var(--text-2)'
const M = 'var(--muted)'
const A = 'var(--accent)'
const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif"

function Paw({ x, y, s = 1, fill = A, rot = 0, opacity = 1 }: { x: number; y: number; s?: number; fill?: string; rot?: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} fill={fill} opacity={opacity}>
      <ellipse cx={0} cy={2} rx={5.5} ry={4.5} />
      <ellipse cx={-6} cy={-4} rx={1.8} ry={2.3} />
      <ellipse cx={-2.2} cy={-7} rx={1.8} ry={2.3} />
      <ellipse cx={2.2} cy={-7} rx={1.8} ry={2.3} />
      <ellipse cx={6} cy={-4} rx={1.8} ry={2.3} />
    </g>
  )
}

export function WalkwayDiagram() {
  return (
    <svg viewBox="0 0 420 210" role="img" aria-label="Schematic of the CatWalk walkway: green light enters the glass plate from the side, reflects internally, and scatters downward where a paw touches the glass; a camera below records the illuminated prints." fontFamily={FONT}>
      {/* rodent silhouette */}
      <g fill={T2} opacity={0.85}>
        <ellipse cx={210} cy={62} rx={62} ry={24} />
        <ellipse cx={268} cy={54} rx={20} ry={14} />
        <circle cx={278} cy={42} r={5} />
        <path d="M148 62 C 110 60, 90 40, 60 44" stroke={T2} strokeWidth={3} fill="none" strokeLinecap="round" />
        <rect x={170} y={78} width={8} height={18} rx={3} />
        <rect x={236} y={76} width={8} height={20} rx={3} />
      </g>
      {/* glass plate */}
      <rect x={20} y={96} width={380} height={14} fill="#1baf7a" opacity={0.18} stroke="#1baf7a" strokeWidth={1} />
      {/* light path zig-zag inside glass */}
      <polyline points="20,103 60,97 100,109 140,97 172,106" fill="none" stroke="#1baf7a" strokeWidth={2} />
      <polyline points="240,103 280,97 320,109 360,97 400,106" fill="none" stroke="#1baf7a" strokeWidth={2} />
      <text x={24} y={128} fontSize={11} fill={M}>
        Light enters the glass edge and stays trapped (total internal reflection)
      </text>
      {/* scatter at paw contacts */}
      {[174, 240].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={110} rx={10} ry={3} fill="#1baf7a" opacity={0.9} />
          {[-10, 0, 10].map((dx) => (
            <line key={dx} x1={x} y1={112} x2={x + dx * 1.6} y2={150} stroke="#1baf7a" strokeWidth={1.5} strokeDasharray="0" opacity={0.7} />
          ))}
        </g>
      ))}
      {/* camera */}
      <g transform="translate(190 160)">
        <rect x={0} y={8} width={40} height={24} rx={4} fill={T2} />
        <rect x={12} y={0} width={16} height={10} rx={2} fill={T2} />
      </g>
      <text x={240} y={182} fontSize={11} fill={M}>
        High-speed camera
      </text>
      <text x={290} y={82} fontSize={11} fill={M}>
        Walkway
      </text>
      <text x={100} y={150} fontSize={11} fill={T2}>
        Paw contact scatters light →
      </text>
      <text x={100} y={163} fontSize={11} fill={T2}>
        brighter = more pressure
      </text>
    </svg>
  )
}

export function FootprintDiagram() {
  // Top view of prints on the walkway, showing stride, BOS and print position.
  const RF = [
    [70, 60],
    [190, 60],
    [310, 60],
  ]
  const RH = [
    [80, 64],
    [200, 64],
    [320, 64],
  ]
  const LF = [
    [130, 140],
    [250, 140],
  ]
  const LH = [
    [140, 136],
    [260, 136],
  ]
  return (
    <svg viewBox="0 0 400 210" role="img" aria-label="Top view of paw prints on the walkway illustrating stride length, base of support and print position." fontFamily={FONT}>
      <rect x={10} y={20} width={380} height={160} rx={6} fill="none" stroke={M} strokeDasharray="4 4" />
      {RF.map(([x, y], i) => (
        <Paw key={`rf${i}`} x={x} y={y} rot={90} fill="#2a78d6" />
      ))}
      {RH.map(([x, y], i) => (
        <Paw key={`rh${i}`} x={x} y={y + 14} rot={90} s={1.2} fill="#eb6834" opacity={0.85} />
      ))}
      {LF.map(([x, y], i) => (
        <Paw key={`lf${i}`} x={x} y={y} rot={90} fill="#2a78d6" />
      ))}
      {LH.map(([x, y], i) => (
        <Paw key={`lh${i}`} x={x} y={y - 14} rot={90} s={1.2} fill="#eb6834" opacity={0.85} />
      ))}
      {/* stride length */}
      <line x1={80} x2={200} y1={36} y2={36} stroke={T} strokeWidth={1.5} markerStart="url(#arr)" markerEnd="url(#arr)" />
      <text x={140} y={31} textAnchor="middle" fontSize={11} fill={T}>
        stride length (RH)
      </text>
      {/* BOS hind */}
      <line x1={355} x2={355} y1={78} y2={122} stroke={T} strokeWidth={1.5} markerStart="url(#arr)" markerEnd="url(#arr)" />
      <text x={360} y={104} fontSize={11} fill={T}>
        BOS
      </text>
      {/* print position */}
      <line x1={190} x2={200} y1={96} y2={96} stroke={T} strokeWidth={1.5} />
      <text x={195} y={110} textAnchor="middle" fontSize={10.5} fill={T2}>
        print position
      </text>
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={T} />
        </marker>
      </defs>
      <g fontSize={11} fill={T2}>
        <circle cx={30} cy={196} r={5} fill="#2a78d6" />
        <text x={40} y={200}>
          front paws
        </text>
        <circle cx={120} cy={196} r={5} fill="#eb6834" />
        <text x={130} y={200}>
          hind paws
        </text>
        <text x={220} y={200} fill={M}>
          direction of travel →
        </text>
      </g>
    </svg>
  )
}

export function StepCycleDiagram() {
  // Gait diagram: stance bars for each paw over time in an alternate (trot-like) pattern.
  const paws = [
    { p: 'RF', phase: 0 },
    { p: 'LF', phase: 0.5 },
    { p: 'RH', phase: 0.5 },
    { p: 'LH', phase: 0 },
  ]
  const x0 = 50
  const w = 330
  const cycle = w / 2.2
  const duty = 0.6
  return (
    <svg viewBox="0 0 400 190" role="img" aria-label="Gait diagram showing stance (bars) and swing (gaps) for each paw over time, with one step cycle marked." fontFamily={FONT}>
      {paws.map((row, i) => {
        const y = 22 + i * 30
        const bars = []
        for (let k = -1; k < 4; k++) {
          const s = x0 + (k + row.phase) * cycle
          const e = s + duty * cycle
          const cs = Math.max(s, x0)
          const ce = Math.min(e, x0 + w)
          if (ce > cs) bars.push(<rect key={k} x={cs} y={y} width={ce - cs} height={16} rx={3} fill={row.p.endsWith('F') ? '#2a78d6' : '#eb6834'} />)
        }
        return (
          <g key={row.p}>
            <text x={x0 - 10} y={y + 12} textAnchor="end" fontSize={12} fontWeight={600} fill={T}>
              {row.p}
            </text>
            <line x1={x0} x2={x0 + w} y1={y + 8} y2={y + 8} stroke={M} strokeDasharray="2 3" />
            {bars}
          </g>
        )
      })}
      {/* annotate RF step cycle */}
      <g>
        <line x1={x0} x2={x0 + cycle} y1={146} y2={146} stroke={T} strokeWidth={1.5} markerStart="url(#arr2)" markerEnd="url(#arr2)" />
        <text x={x0 + cycle / 2} y={160} textAnchor="middle" fontSize={11} fill={T}>
          RF step cycle
        </text>
        <line x1={x0} x2={x0 + duty * cycle} y1={134} y2={134} stroke="#2a78d6" strokeWidth={1.5} />
        <text x={x0 + (duty * cycle) / 2} y={130} textAnchor="middle" fontSize={10.5} fill={T2}>
          stand
        </text>
        <line x1={x0 + duty * cycle} x2={x0 + cycle} y1={134} y2={134} stroke={M} strokeWidth={1.5} />
        <text x={x0 + duty * cycle + ((1 - duty) * cycle) / 2} y={130} textAnchor="middle" fontSize={10.5} fill={T2}>
          swing
        </text>
      </g>
      <text x={x0} y={182} fontSize={11} fill={M}>
        Duty cycle = stand / step cycle × 100 (here 60%). Time runs left → right.
      </text>
      <defs>
        <marker id="arr2" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={T} />
        </marker>
      </defs>
    </svg>
  )
}

const SUPPORTS: { name: string; paws: string[] }[] = [
  { name: 'Single', paws: ['RH'] },
  { name: 'Diagonal', paws: ['RF', 'LH'] },
  { name: 'Girdle', paws: ['LH', 'RH'] },
  { name: 'Lateral', paws: ['RF', 'RH'] },
  { name: 'Three', paws: ['RF', 'LF', 'RH'] },
  { name: 'Four', paws: ['RF', 'LF', 'RH', 'LH'] },
]

export function SupportDiagram() {
  const pos: Record<string, [number, number]> = { LF: [18, 12], RF: [42, 12], LH: [18, 52], RH: [42, 52] }
  return (
    <svg viewBox="0 0 420 110" role="img" aria-label="Support configurations: single, diagonal, girdle, lateral, three and four paws on the glass." fontFamily={FONT}>
      {SUPPORTS.map((s, i) => (
        <g key={s.name} transform={`translate(${8 + i * 69} 10)`}>
          <rect x={4} y={0} width={56} height={70} rx={10} fill="none" stroke={M} strokeDasharray="3 3" />
          {Object.entries(pos).map(([p, [x, y]]) => (
            <circle key={p} cx={x + 2} cy={y + 4} r={7} fill={s.paws.includes(p) ? A : 'none'} stroke={s.paws.includes(p) ? A : M} strokeWidth={1.5} />
          ))}
          <text x={32} y={90} textAnchor="middle" fontSize={11} fill={T}>
            {s.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

const PATTERNS: { id: string; name: string; seq: string[] }[] = [
  { id: 'Ca', name: 'Cruciate', seq: ['RF', 'LF', 'RH', 'LH'] },
  { id: 'Cb', name: 'Cruciate', seq: ['LF', 'RF', 'LH', 'RH'] },
  { id: 'Aa', name: 'Alternate', seq: ['RF', 'RH', 'LF', 'LH'] },
  { id: 'Ab', name: 'Alternate', seq: ['LF', 'RH', 'RF', 'LH'] },
  { id: 'Ra', name: 'Rotary', seq: ['RF', 'LF', 'LH', 'RH'] },
  { id: 'Rb', name: 'Rotary', seq: ['LF', 'RF', 'RH', 'LH'] },
]

export function StepPatternDiagram() {
  const pos: Record<string, [number, number]> = { LF: [14, 10], RF: [40, 10], LH: [14, 50], RH: [40, 50] }
  return (
    <svg viewBox="0 0 420 118" role="img" aria-label="The six normal step-sequence patterns, with numbers showing the order in which the paws land." fontFamily={FONT}>
      {PATTERNS.map((pt, i) => (
        <g key={pt.id} transform={`translate(${8 + i * 69} 8)`}>
          {Object.entries(pos).map(([p, [x, y]]) => {
            const k = pt.seq.indexOf(p) + 1
            return (
              <g key={p}>
                <circle cx={x + 4} cy={y + 4} r={10} fill={p.endsWith('F') ? '#2a78d6' : '#eb6834'} />
                <text x={x + 4} y={y + 4} dy="0.35em" textAnchor="middle" fontSize={11} fontWeight={700} fill="#fff">
                  {k}
                </text>
              </g>
            )
          })}
          <text x={31} y={86} textAnchor="middle" fontSize={11} fontWeight={600} fill={T}>
            {pt.id}
          </text>
          <text x={31} y={100} textAnchor="middle" fontSize={10} fill={M}>
            {pt.name}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function IntensityDiagram() {
  // A print coloured by intensity: loaded (bright) vs guarded (dim).
  return (
    <svg viewBox="0 0 400 130" role="img" aria-label="Comparison of a normally loaded hind paw print and a guarded print with smaller area and lower intensity." fontFamily={FONT}>
      <defs>
        <radialGradient id="hot" cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor="#fff6c7" />
          <stop offset="45%" stopColor="#eda100" />
          <stop offset="100%" stopColor="#eb6834" stopOpacity={0.2} />
        </radialGradient>
        <radialGradient id="dim" cx="50%" cy="55%" r="60%">
          <stop offset="0%" stopColor="#eda100" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#eb6834" stopOpacity={0.1} />
        </radialGradient>
      </defs>
      <g transform="translate(90 64) scale(3.2) rotate(90)">
        <Paw x={0} y={0} fill="url(#hot)" />
      </g>
      <g transform="translate(290 64) scale(2.3) rotate(90)">
        <Paw x={0} y={0} fill="url(#dim)" />
      </g>
      <text x={90} y={122} textAnchor="middle" fontSize={11} fill={T}>
        Normal loading
      </text>
      <text x={290} y={122} textAnchor="middle" fontSize={11} fill={T}>
        Guarded paw: smaller area, lower intensity
      </text>
    </svg>
  )
}
