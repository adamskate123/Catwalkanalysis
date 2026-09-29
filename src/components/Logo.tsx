import type { ProgramId } from '../programs'

export function Logo({ size = 26, program = 'catwalk' }: { size?: number; program?: ProgramId }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2a78d6" />
      {program === 'rotarod' ? (
        // A rod seen end-on with rotation arrows and a mouse on top
        <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <circle cx="16" cy="19" r="5" fill="#fff" stroke="none" />
          <path d="M8.5 19a7.5 7.5 0 0 1 3.5-6.4" />
          <path d="M23.5 19a7.5 7.5 0 0 1-3.5 6.4" />
          <path d="M11.2 11.2l1 1.6 1.7-.6" />
          <path d="M20.8 26.8l-1-1.6-1.7.6" />
          <ellipse cx="16" cy="9" rx="4.2" ry="2.4" fill="#fff" stroke="none" />
        </g>
      ) : program === 'cagehang' ? (
        // A grid lid with a mouse hanging underneath
        <g fill="#fff" stroke="#fff" strokeLinecap="round">
          <line x1="6" y1="8" x2="26" y2="8" strokeWidth="2.2" />
          {[8, 12, 16, 20, 24].map((x) => (
            <line key={x} x1={x} y1="8" x2={x} y2="11" strokeWidth="1.4" />
          ))}
          <line x1="13" y1="11" x2="13" y2="15" strokeWidth="1.6" />
          <line x1="19" y1="11" x2="19" y2="15" strokeWidth="1.6" />
          <ellipse cx="16" cy="18" rx="5.5" ry="4" stroke="none" />
          <circle cx="16" cy="23.5" r="2.4" stroke="none" />
          <path d="M11 17c-3 1-4 4-4 7" fill="none" strokeWidth="1.4" />
        </g>
      ) : program === 'openfield' ? (
        // An arena with a centre zone and a track
        <g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="6" width="20" height="20" rx="1.5" strokeWidth="2" />
          <rect x="11.5" y="11.5" width="9" height="9" strokeWidth="1.2" strokeDasharray="2 1.6" />
          <path d="M9 23c2-6 1-10 5-12s6 3 9 1" strokeWidth="1.8" />
          <circle cx="23" cy="12" r="1.8" fill="#fff" stroke="none" />
        </g>
      ) : (
        // Four paw prints in a walking pattern
        [
          [10, 9],
          [21, 13],
          [11, 20],
          [22, 24],
        ].map(([x, y], i) => (
          <g key={i} fill="#fff">
            <ellipse cx={x} cy={y} rx="2.6" ry="2.2" />
            <circle cx={x - 2.4} cy={y - 2.9} r="0.9" />
            <circle cx={x} cy={y - 3.6} r="0.9" />
            <circle cx={x + 2.4} cy={y - 2.9} r="0.9" />
          </g>
        ))
      )}
    </svg>
  )
}
