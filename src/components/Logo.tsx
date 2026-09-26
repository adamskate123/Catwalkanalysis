export function Logo({ size = 26 }: { size?: number }) {
  // Four paw prints in a walking pattern.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#2a78d6" />
      {[
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
      ))}
    </svg>
  )
}
