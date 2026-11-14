import { useId } from 'react';

type Point = readonly [number, number];
const leafValleys: Point[] = [[-16, 18], [-23, 3], [-17, -12], [-8, -18], [8, -18], [18, -12], [24, 3], [16, 18]];
const leafTips: Point[] = [[-42, 24], [-68, -10], [-45, -58], [0, -88], [47, -62], [70, -13], [43, 25]];

function serratedEdge(from: Point, to: Point) {
  const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy);
  const side = (-dy * (from[0] + to[0]) + dx * (from[1] + to[1])) >= 0 ? 1 : -1;
  return [0.22, 0.3, 0.41, 0.5, 0.62, 0.7, 0.82, 1].map((t, index) => {
    const tooth = index % 2 === 0 ? Math.min(2, length / 22) * side : 0;
    return `L${(from[0] + dx * t - dy / length * tooth).toFixed(2)} ${(from[1] + dy * t + dx / length * tooth).toFixed(2)}`;
  }).join('');
}

const mapleOutline = 'M0 28L-16 18' + leafTips.map((tip, index) => serratedEdge(leafValleys[index], tip) + serratedEdge(tip, leafValleys[index + 1])).join('') + 'Q8 25 0 28Z';
const blossoms = [
  [47, 151, -19, 0.5], [76, 124, 14, 0.36], [129, 181, 6, 0.72],
  [157, 106, -12, 0.53], [181, 153, 28, 0.38], [231, 173, -25, 0.55],
  [274, 96, 9, 0.45], [302, 67, 33, 0.32],
];

function CherryBranch({ id }: { id: string }) {
  return <>
    <g fill="none" stroke="#b6a0aa" strokeLinecap="round">
      <path d="M-23 418C28 344 36 264 100 205" strokeWidth="6.5" />
      <path d="M99 206C160 149 225 129 293 67" strokeWidth="3.1" />
      <path d="M60 261C53 205 55 151 29 107M99 215C147 216 193 204 229 174M152 164C168 113 169 74 155 38M208 132C244 135 279 122 307 96" strokeWidth="1.5" />
    </g>
    <g fill="none" stroke="#b8a1ab" strokeWidth=".8" strokeLinecap="round">
      <path d="M53 209Q66 156 77 125M99 204Q112 185 130 181M159 150Q175 145 181 153M244 118Q259 101 274 96M166 110 157 106M42 165 47 151M281 91 303 67M208 134Q219 128 224 111" />
    </g>
    <g fill="#b9c1ac" opacity=".65">
      <path d="M183 150Q194 130 205 134Q200 150 183 150ZM74 128Q62 110 68 100Q82 110 74 128Z" />
    </g>
    {blossoms.map(([x, y, angle, size], index) => <use key={index} href={`#${id}-blossom`} transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`} />)}
    <use href={`#${id}-bud`} transform="translate(27 104) rotate(-15) scale(.65)" />
    <use href={`#${id}-bud`} transform="translate(223 108) rotate(17) scale(.8)" />
    <use href={`#${id}-bud`} transform="translate(153 50) rotate(8) scale(.6)" />
  </>;
}

function MapleBranch({ id }: { id: string }) {
  const leaves = [[46, 178, -42, .6, 'rust'], [151, 142, 12, .68, 'rust'], [244, 236, 87, .5, 'ochre'], [262, 139, 42, .43, 'rust'], [91, 258, -72, .38, 'ochre']] as const;
  return <>
    <g fill="none" stroke="#bda995" strokeLinecap="round">
      <path d="M-30 381C20 334 39 286 86 258" strokeWidth="5.8" />
      <path d="M85 258C142 220 200 215 263 139" strokeWidth="2.6" />
      <path d="M65 281C76 242 65 210 46 178M108 253C113 206 132 173 151 142M138 233C173 253 210 253 244 236" strokeWidth="1.4" />
    </g>
    <path d="M87 263 91 258" fill="none" stroke="#bda995" strokeWidth=".8" strokeLinecap="round" />
    {leaves.map(([x, y, angle, size, tone], index) => <g key={index} transform={`translate(${x} ${y}) rotate(${angle}) scale(${size})`}><use href={`#${id}-leaf`} transform="translate(0 -56)" fill={`url(#${id}-${tone})`} /></g>)}
  </>;
}

export function SeasonalArt({ theme, side = 'left', preview = false }: { theme: 'sakura' | 'maple'; side?: 'left' | 'right'; preview?: boolean }) {
  const id = useId();
  return <svg className="seasonal-art" xmlns="http://www.w3.org/2000/svg" viewBox={preview ? '0 70 320 250' : '0 0 360 1000'} preserveAspectRatio={preview ? 'xMidYMid slice' : 'xMinYMid meet'} aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id={`${id}-bloom`} cx="50%" cy="85%" r="90%"><stop stopColor="#d4a1b2" /><stop offset=".48" stopColor="#f3e0e5" /><stop offset="1" stopColor="#fffafb" /></radialGradient>
      <path id={`${id}-petal`} d="M0 3C-8-4-24-17-20-29C-17-39-7-40-1-33C4-41 15-37 19-29C25-16 9-3 0 3Z" />
      <g id={`${id}-blossom`}>
        <g fill={`url(#${id}-bloom)`} stroke="#cb9bab" strokeWidth="1.1" strokeLinejoin="round">{[0, 73, 145, 218, 287].map((angle, index) => <use key={angle} href={`#${id}-petal`} transform={`rotate(${angle}) scale(${index % 2 ? .96 : 1})`} />)}</g>
        <g stroke="#bb8196" strokeWidth=".7" strokeLinecap="round">{[8, 53, 98, 143, 188, 233, 278, 323].map((angle, index) => <g key={angle} transform={`rotate(${angle})`}><path d={`M0 0Q2-6 0-${index % 2 ? 13 : 16}`} fill="none" /><circle cy={index % 2 ? -13 : -16} r="1.1" fill="#bb8196" stroke="none" /></g>)}</g>
        <circle r="2.2" fill="#b77c91" />
      </g>
      <g id={`${id}-bud`}><path d="M-3 5C-12-2-7-14 0-13C9-13 12-2 4 5Z" fill="#d6afbc" /><path d="M-4 3 0 10 5 3 0 5Z" fill="#adb69c" /></g>
      <linearGradient id={`${id}-rust`} x1="0" y1="-80" x2="15" y2="35" gradientUnits="userSpaceOnUse"><stop stopColor="#b6655c" /><stop offset=".6" stopColor="#c98e79" /><stop offset="1" stopColor="#d8b69a" /></linearGradient>
      <linearGradient id={`${id}-ochre`} x1="-30" y1="-60" x2="30" y2="25" gradientUnits="userSpaceOnUse"><stop stopColor="#d0b18a" /><stop offset="1" stopColor="#dfcdb0" /></linearGradient>
      <g id={`${id}-leaf`}>
        <path d={mapleOutline} />
        <g fill="none" stroke="#995e4e" strokeWidth=".7" strokeLinecap="round" opacity=".58"><path d="M0 56Q-2 35 0 22Q-3-21 0-77M0 20Q-16-2-39-51M0 21Q-27 9-59-9M0 24-35 24M0 20Q24-13 42-53M0 21Q34 5 61-12M0 24 35 24" /><path d="M0-43-8-55M0-29 9-39M-19-9-31-11M23-8 35-12M-34 11-41 5M37 7 43 1" strokeWidth=".45" /></g>
      </g>
    </defs>
    {theme === 'sakura' ? <>
      <g transform={side === 'right' && !preview ? 'translate(-38 594) rotate(-8 0 300) scale(.9)' : 'translate(-28 30)'}><CherryBranch id={id} /></g>
      {!preview && <g fill="#dcb7c5" opacity=".7"><use href={`#${id}-petal`} transform={side === 'right' ? 'translate(103 224) rotate(106) scale(.2 .3)' : 'translate(206 553) rotate(27) scale(.19 .28)'} /><use href={`#${id}-petal`} transform={side === 'right' ? 'translate(233 415) rotate(-42) scale(.18 .25)' : 'translate(116 742) rotate(113) scale(.16 .25)'} /><use href={`#${id}-petal`} transform={side === 'right' ? 'translate(73 467) rotate(19) scale(.1 .2)' : 'translate(226 901) rotate(-32) scale(.11 .2)'} /></g>}
    </> : <>
      <g transform={side === 'right' && !preview ? 'translate(-35 588) rotate(-10 0 280) scale(.94)' : 'translate(-22 58)'}><MapleBranch id={id} /></g>
      {!preview && <><use href={`#${id}-leaf`} fill={`url(#${id}-ochre)`} transform={side === 'right' ? 'translate(124 258) rotate(122) scale(.26)' : 'translate(216 590) rotate(-26) scale(.25)'} /><use href={`#${id}-leaf`} fill={`url(#${id}-rust)`} opacity=".65" transform={side === 'right' ? 'translate(226 453) rotate(38) scale(.18)' : 'translate(114 826) rotate(125) scale(.18)'} /></>}
    </>}
  </svg>;
}
