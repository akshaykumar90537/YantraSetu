import React from 'react';

export function TractorArt({ large = false }) {
  return (
    <svg
      viewBox="0 0 520 300"
      role="img"
      aria-label="Illustration of a tractor in cultivated fields"
      className={large ? 'tractor-art large' : 'tractor-art'}
    >
      <defs>
        <pattern
          id={large ? 'linesL' : 'linesS'}
          width="36"
          height="36"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(28)"
        >
          <path d="M0 0V36" stroke="#bdd09d" strokeWidth="12" />
        </pattern>
      </defs>
      <path d="M0 180 Q140 100 290 150 T520 110 V300H0Z" fill="#dbe6c7" />
      <path
        d="M0 220 Q160 130 330 195 T520 165V300H0Z"
        fill={`url(#${large ? 'linesL' : 'linesS'})`}
      />
      <g transform="translate(80,20)">
        <path d="M110 160v-68h82l20 68" fill="#3e7050" stroke="#254c38" strokeWidth="7" />
        <path d="M121 104h58l16 50h-74z" fill="#dcebe3" />
        <path d="M87 171h192l29 30v25H87z" fill="#b85635" />
        <path d="M213 162h69l17 48h-86z" fill="#cd714c" />
        <path d="M256 163v-45h9v45" fill="#2e453a" />
        <path d="M271 182h20m-16 9h19m-13 9h18" stroke="#704735" strokeWidth="4" />
        <circle cx="125" cy="226" r="48" fill="#293c34" />
        <circle cx="125" cy="226" r="29" fill="#e9dfc8" />
        <circle cx="125" cy="226" r="13" fill="#64735a" />
        <circle cx="277" cy="233" r="31" fill="#293c34" />
        <circle cx="277" cy="233" r="17" fill="#e9dfc8" />
        <path d="M72 181q40-34 85 0" fill="none" stroke="#d48157" strokeWidth="12" />
        <path d="M98 89h102" stroke="#254c38" strokeWidth="12" strokeLinecap="round" />
      </g>
      <circle cx="415" cy="58" r="25" fill="#edcc73" />
    </svg>
  );
}

