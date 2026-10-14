// A mouse seen from above, for the track replay: teardrop body, big round ears
// with pink insides, pointed pink nose, little pink feet and a long thin tail.
// Drawn in its own units with the snout pointing down (+y) and the body centred
// on (0, 0), about 33 units from rump to snout. Body colours are fixed (a grey
// mouse reads on light and dark charts); whiskers take the chart's ink.

interface Props {
  x: number
  y: number
  /** Direction of travel in degrees, measured like Math.atan2(dy, dx) (0 = right, 90 = down). */
  heading: number
  /** Rump-to-snout length in px. */
  length: number
  /** Whisker colour (the chart's secondary ink, so they show on light and dark backgrounds). */
  ink: string
}

const OUTLINE = '#3a3330'
const FUR = '#a39b93'
const FUR_DARK = '#8e867e'
const PINK = '#e9b3ba'
const NOSE = '#e07c8e'

const TAIL = 'M0 -14.5 C0.3 -20 -3.8 -22.5 -3.4 -27.5 C-3 -32 3.5 -32.5 5.5 -37'
const BODY =
  'M0 -15.5 C6.2 -15.5 9.4 -10.5 9.4 -3.5 C9.4 1.5 7.6 4.6 6.2 7 C5 9.6 3.1 14.6 1 17.5 Q0 18.6 -1 17.5 C-3.1 14.6 -5 9.6 -6.2 7 C-7.6 4.6 -9.4 1.5 -9.4 -3.5 C-9.4 -10.5 -6.2 -15.5 0 -15.5 Z'
const BACK = 'M0 -13 C3.5 -13 5.5 -9 5.5 -3.5 C5.5 1 3.5 4 0 5 C-3.5 4 -5.5 1 -5.5 -3.5 C-5.5 -9 -3.5 -13 0 -13 Z'
const WHISKERS = 'M-1.4 16 L-8.2 14.4 M-1.4 16.6 L-8.4 17.4 M-1.2 17.2 L-7 20 M1.4 16 L8.2 14.4 M1.4 16.6 L8.4 17.4 M1.2 17.2 L7 20'

export function MouseIcon({ x, y, heading, length, ink }: Props) {
  const s = length / 33
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(heading - 90).toFixed(1)}) scale(${s.toFixed(3)})`} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* tail: dark edge with a pink core */}
      <path d={TAIL} fill="none" stroke={OUTLINE} strokeWidth={2.3} />
      <path d={TAIL} fill="none" stroke="#d9a3a9" strokeWidth={1.1} />
      {/* hind and front feet peeking out from under the body */}
      {[
        [-8.6, -9.5, 1.9, 2.6],
        [8.6, -9.5, 1.9, 2.6],
        [-6.9, 4.2, 1.5, 2],
        [6.9, 4.2, 1.5, 2],
      ].map(([cx, cy, rx, ry]) => (
        <ellipse key={`${cx},${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill={PINK} stroke={OUTLINE} strokeWidth={0.8} />
      ))}
      <path d={BODY} fill={FUR} stroke={OUTLINE} strokeWidth={1.2} />
      <path d={BACK} fill={FUR_DARK} />
      {/* ears */}
      {[-1, 1].map((side) => (
        <g key={side}>
          <circle cx={6.6 * side} cy={6.6} r={3.9} fill={FUR} stroke={OUTLINE} strokeWidth={1.2} />
          <circle cx={7.1 * side} cy={6.5} r={2.4} fill={PINK} />
        </g>
      ))}
      <ellipse cx={-2.5} cy={11.2} rx={0.95} ry={1.15} fill="#1d1a18" />
      <ellipse cx={2.5} cy={11.2} rx={0.95} ry={1.15} fill="#1d1a18" />
      <circle cx={0} cy={17.6} r={1.25} fill={NOSE} stroke={OUTLINE} strokeWidth={0.6} />
      <path d={WHISKERS} fill="none" stroke={ink} strokeWidth={0.45} />
    </g>
  )
}
