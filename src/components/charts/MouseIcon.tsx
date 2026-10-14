// A mouse seen from above (after a sketch by the lab): tail, body, head with ear
// bumps, eyes and whiskers. Drawn in its own units with the snout pointing down
// (+y) and the body centred on (0, 0), about 33 units from rump to snout.

interface Props {
  x: number
  y: number
  /** Direction of travel in degrees, measured like Math.atan2(dy, dx) (0 = right, 90 = down). */
  heading: number
  /** Rump-to-snout length in px. */
  length: number
  ink: string
  fill: string
}

export const MOUSE_BODY = 'M-4.6 -15.2 Q0 -16.6 4.6 -15.2 Q7.6 -13.8 7.9 -9 L8 -3.2 Q8 -0.9 9.6 0.1 Q12.2 1.3 12.2 4.6 Q12.2 8.4 9.2 10.1 L4.2 14.6 Q2.4 17.6 0 17.8 Q-2.4 17.6 -4.2 14.6 L-9.2 10.1 Q-12.2 8.4 -12.2 4.6 Q-12.2 1.3 -9.6 0.1 Q-8 -0.9 -8 -3.2 L-7.9 -9 Q-7.6 -13.8 -4.6 -15.2 Z'
export const MOUSE_TAIL = 'M0 -15 L0 -19 C0.5 -23 3.5 -26.5 8 -28.5 C11 -29.8 14 -30.3 16.5 -29.6'
export const MOUSE_WHISKERS = 'M-2.6 15.2 L-8.6 18.6 M-1.6 16.6 L-4.4 21.4 M2.6 15.2 L8.6 18.6 M1.6 16.6 L4.4 21.4'

export function MouseIcon({ x, y, heading, length, ink, fill }: Props) {
  const s = length / 33
  return (
    <g transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(heading - 90).toFixed(1)}) scale(${s.toFixed(3)})`} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* Outlines stay the same width in px however large the mouse is drawn. */}
      <path d={MOUSE_TAIL} fill="none" stroke={ink} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      <path d={MOUSE_BODY} fill={fill} stroke={ink} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      <circle cx={-2.6} cy={9.4} r={1.15} fill={ink} />
      <circle cx={2.6} cy={9.4} r={1.15} fill={ink} />
      <path d={MOUSE_WHISKERS} fill="none" stroke={ink} strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </g>
  )
}
