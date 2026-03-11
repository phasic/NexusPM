import { useId } from 'react'

type NexusIconProps = {
  className?: string
}

export function NexusIcon({ className }: NexusIconProps) {
  const id = useId().replace(/:/g, '')
  const bgGrad = `bgGrad-${id}`
  const accentGrad = `accentGrad-${id}`
  const nodeGrad = `nodeGrad-${id}`
  const glow = `glow-${id}`
  const softGlow = `softGlow-${id}`
  const roundedRect = `roundedRect-${id}`

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={bgGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#0F1117', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#1A1D2E', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={accentGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#4F8EF7', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#7B5FF5', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={nodeGrad} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#60A5FA', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#818CF8', stopOpacity: 1 }} />
        </linearGradient>
        <filter id={glow}>
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={softGlow}>
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id={roundedRect}>
          <rect width="100" height="100" rx="22" ry="22" />
        </clipPath>
      </defs>

      <rect width="100" height="100" rx="22" ry="22" fill={`url(#${bgGrad})`} />

      <g opacity="0.06" clipPath={`url(#${roundedRect})`}>
        <line x1="25" y1="0" x2="25" y2="100" stroke="#ffffff" strokeWidth="0.5" />
        <line x1="50" y1="0" x2="50" y2="100" stroke="#ffffff" strokeWidth="0.5" />
        <line x1="75" y1="0" x2="75" y2="100" stroke="#ffffff" strokeWidth="0.5" />
        <line x1="0" y1="25" x2="100" y2="25" stroke="#ffffff" strokeWidth="0.5" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="#ffffff" strokeWidth="0.5" />
        <line x1="0" y1="75" x2="100" y2="75" stroke="#ffffff" strokeWidth="0.5" />
      </g>

      <line x1="32" y1="34" x2="50" y2="50" stroke={`url(#${accentGrad})`} strokeWidth="1.8" opacity="0.6" filter={`url(#${glow})`} />
      <line x1="68" y1="34" x2="50" y2="50" stroke={`url(#${accentGrad})`} strokeWidth="1.8" opacity="0.6" filter={`url(#${glow})`} />
      <line x1="50" y1="50" x2="33" y2="67" stroke={`url(#${accentGrad})`} strokeWidth="1.8" opacity="0.6" filter={`url(#${glow})`} />
      <line x1="50" y1="50" x2="67" y2="67" stroke={`url(#${accentGrad})`} strokeWidth="1.8" opacity="0.6" filter={`url(#${glow})`} />

      <rect x="22" y="42" width="18" height="3" rx="1.5" fill="#4F8EF7" opacity="0.18" />
      <rect x="60" y="42" width="18" height="3" rx="1.5" fill="#7B5FF5" opacity="0.18" />
      <rect x="22" y="56" width="12" height="3" rx="1.5" fill="#4F8EF7" opacity="0.18" />
      <rect x="66" y="56" width="12" height="3" rx="1.5" fill="#7B5FF5" opacity="0.18" />

      <circle cx="32" cy="33" r="6.5" fill="#0F1117" stroke={`url(#${nodeGrad})`} strokeWidth="1.8" filter={`url(#${glow})`} />
      <circle cx="32" cy="33" r="2.5" fill={`url(#${nodeGrad})`} opacity="0.9" />
      <circle cx="68" cy="33" r="6.5" fill="#0F1117" stroke={`url(#${nodeGrad})`} strokeWidth="1.8" filter={`url(#${glow})`} />
      <circle cx="68" cy="33" r="2.5" fill={`url(#${nodeGrad})`} opacity="0.9" />
      <circle cx="33" cy="67" r="6.5" fill="#0F1117" stroke={`url(#${nodeGrad})`} strokeWidth="1.8" filter={`url(#${glow})`} />
      <circle cx="33" cy="67" r="2.5" fill={`url(#${nodeGrad})`} opacity="0.9" />
      <circle cx="67" cy="67" r="6.5" fill="#0F1117" stroke={`url(#${nodeGrad})`} strokeWidth="1.8" filter={`url(#${glow})`} />
      <circle cx="67" cy="67" r="2.5" fill={`url(#${nodeGrad})`} opacity="0.9" />

      <circle cx="50" cy="50" r="10" fill="#0F1117" stroke={`url(#${accentGrad})`} strokeWidth="2.2" filter={`url(#${softGlow})`} />
      <circle cx="50" cy="50" r="5" fill={`url(#${accentGrad})`} opacity="0.95" filter={`url(#${glow})`} />
      <circle cx="50" cy="50" r="2" fill="#ffffff" opacity="0.6" />
    </svg>
  )
}
