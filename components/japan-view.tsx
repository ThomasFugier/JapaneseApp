'use client';

import { useState } from 'react';
import { ArrowUpRight, Plus, TrainFront, Utensils, CupSoda } from 'lucide-react';
import type { Note, Snapshot } from '@/lib/model';
import { JapaneseText } from './furigana';
import './japan.css';

export type JapanWord = { japanese: string; reading: string; meaning: string; french?: string };
type SceneId = 'ticket' | 'menu' | 'drinks';
const scenes = [
  { id: 'ticket' as const, title: 'At the station', icon: TrainFront, caption: 'Sur un billet, repère le type de trajet et le tarif voyageur.', words: [
    { japanese: '乗車券', reading: 'じょうしゃけん', meaning: 'train ticket', french: 'Billet de transport' },
    { japanese: '片道', reading: 'かたみち', meaning: 'one way', french: 'Aller simple' },
    { japanese: '大人', reading: 'おとな', meaning: 'adult', french: 'Adulte' },
    { japanese: '当日限り', reading: 'とうじつかぎり', meaning: 'valid only on the day of issue', french: 'Valable uniquement le jour de l’émission' },
  ] },
  { id: 'menu' as const, title: 'A small restaurant', icon: Utensils, caption: 'Un repas simple : un plat, du riz, de la soupe et du thé.', words: [
    { japanese: 'お品書き', reading: 'おしながき', meaning: 'menu', french: 'La carte du restaurant' },
    { japanese: '定食', reading: 'ていしょく', meaning: 'set meal', french: 'Menu composé de plusieurs éléments' },
    { japanese: 'ご飯', reading: 'ごはん', meaning: 'cooked rice; meal', french: 'Riz cuit ; repas selon le contexte' },
    { japanese: '味噌汁', reading: 'みそしる', meaning: 'miso soup', french: 'Soupe miso' },
    { japanese: 'お茶', reading: 'おちゃ', meaning: 'tea', french: 'Thé' },
  ] },
  { id: 'drinks' as const, title: 'A drink on the way', icon: CupSoda, caption: 'Les étiquettes indiquent la boisson, sa température et sa disponibilité.', words: [
    { japanese: 'つめたい', reading: 'つめたい', meaning: 'cold (to the touch)', french: 'Froid — ici, une boisson fraîche' },
    { japanese: 'あたたかい', reading: 'あたたかい', meaning: 'warm', french: 'Chaud, tiède' },
    { japanese: '水', reading: 'みず', meaning: 'water', french: 'Eau' },
    { japanese: 'お茶', reading: 'おちゃ', meaning: 'tea', french: 'Thé' },
    { japanese: '売り切れ', reading: 'うりきれ', meaning: 'sold out', french: 'Épuisé' },
  ] },
];

type HitProps = { word: JapanWord; x: number; y: number; width: number; size?: number; selected: string; onSelect: (word: JapanWord) => void };
function WordHit({ word, x, y, width, size = 22, selected, onSelect }: HitProps) {
  return <g className={`japan-hotspot${selected === word.japanese ? ' is-selected' : ''}`} role="button" tabIndex={0} aria-label={`Read ${word.japanese}`} aria-pressed={selected === word.japanese} onClick={() => onSelect(word)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(word); } }}>
    <rect x={x - width / 2} y={y - 28} width={width} height={42} rx={5} />
    <text x={x} y={y} textAnchor="middle" fontSize={size} lang="ja">{word.japanese}</text>
  </g>;
}

function Scene({ id, words, selected, onSelect }: { id: SceneId; words: JapanWord[]; selected: string; onSelect: (word: JapanWord) => void }) {
  const hit = (index: number, x: number, y: number, width: number, size?: number) => <WordHit word={words[index]} x={x} y={y} width={width} size={size} selected={selected} onSelect={onSelect} />;
  return <svg className={`japan-scene japan-scene-${id}`} viewBox="0 0 640 440" role="group" aria-label={`${scenes.find(scene => scene.id === id)?.title}: interactive illustration`}>
    <rect width="640" height="440" fill="#f5f3ed" />
    <path d="M0 356H640M0 360H640" stroke="#e6e1d7" />
    {id === 'ticket' && <>
      <g fill="none" stroke="#dcd7ca" strokeWidth="2"><path d="M52 64H588M52 70H588M68 48V86M158 48V86M248 48V86M338 48V86M428 48V86M518 48V86M578 48V86" /><circle cx="54" cy="390" r="3" /><circle cx="586" cy="390" r="3" /></g>
      <rect x="94" y="120" width="452" height="248" rx="7" fill="#e7e1d4" />
      <path d="M96 106H544V153A10 10 0 0 0 544 173V350H96V173A10 10 0 0 0 96 153Z" fill="#eee5cf" stroke="#c9bda4" />
      <path d="M108 118H532V338H108Z" fill="none" stroke="#d7cbb3" strokeDasharray="2 5" />
      <path d="M122 178H518M122 278H518" stroke="#cdbfa6" />
      {hit(0, 320, 153, 146, 27)}
      {hit(1, 162, 220, 80)}
      <text x="320" y="235" textAnchor="middle" fontSize="40" fill="#383c38">180</text><text x="377" y="235" fontSize="19" fill="#383c38">円</text>
      {hit(2, 476, 220, 70)}
      {hit(3, 247, 314, 160, 19)}
      <g stroke="#6b6c60" strokeWidth="2">{Array.from({ length: 19 }, (_, i) => <path key={i} d={`M${414 + i * 4} 293v26`} strokeWidth={i % 3 === 0 ? 2.5 : 1} />)}</g>
      <text x="320" y="393" textAnchor="middle" fontSize="10" letterSpacing="4" fill="#8e8c7f">01 / STATION</text>
    </>}
    {id === 'menu' && <>
      <path d="M48 40H592V95H48Z" fill="#56655b" /><path d="M223 40V95M418 40V95" stroke="#f5f3ed" strokeWidth="5" />
      <text x="320" y="76" textAnchor="middle" fill="#f5f3ed" fontSize="22" letterSpacing="8" lang="ja">食堂</text>
      <rect x="82" y="134" width="224" height="244" rx="3" fill="#e4dfd3" transform="rotate(-3 194 256)" />
      <rect x="76" y="123" width="224" height="244" rx="3" fill="#fffdf5" stroke="#d3cdbf" />
      {hit(0, 188, 165, 165, 26)}<path d="M102 187H274" stroke="#cebd98" />
      {hit(1, 145, 221, 75)}<text x="251" y="221" textAnchor="end" fontSize="16" fill="#6e6b60">850</text>
      {hit(2, 145, 269, 80)}<text x="251" y="269" textAnchor="end" fontSize="16" fill="#6e6b60">150</text>
      {hit(3, 145, 317, 100)}<text x="251" y="317" textAnchor="end" fontSize="16" fill="#6e6b60">100</text>
      <ellipse cx="450" cy="345" rx="130" ry="28" fill="#e7e1d4" />
      <ellipse cx="432" cy="285" rx="89" ry="37" fill="#e5e4d9" stroke="#697b79" strokeWidth="2" /><ellipse cx="432" cy="282" rx="71" ry="27" fill="#fffdf7" stroke="#a8b4a7" />
      <path d="M376 286Q388 265 399 279Q411 255 422 276Q435 260 448 276Q462 261 479 281Q490 285 487 295H378Z" fill="#eee7d2" />
      <path d="M495 214L507 263Q532 278 554 262L565 214" fill="#b9c5ad" stroke="#6e8068" strokeWidth="2" /><ellipse cx="530" cy="214" rx="35" ry="10" fill="#f5f1dc" stroke="#6e8068" strokeWidth="2" /><ellipse cx="530" cy="215" rx="28" ry="6" fill="#a4ac72" />
      {hit(4, 530, 190, 86, 20)}
      <path d="M340 334L546 355M341 341L546 361" stroke="#9a7250" strokeWidth="4" strokeLinecap="round" />
      <text x="320" y="410" textAnchor="middle" fontSize="10" letterSpacing="4" fill="#8e8c7f">02 / SHOKUDŌ</text>
    </>}
    {id === 'drinks' && <>
      <path d="M64 0V354M576 0V354M0 107H64M576 107H640M0 214H64M576 214H640" stroke="#e5e0d5" />
      <rect x="164" y="38" width="312" height="372" rx="9" fill="#d9d4c7" />
      <rect x="153" y="28" width="312" height="372" rx="9" fill="#b64343" stroke="#913333" strokeWidth="2" />
      <rect x="177" y="51" width="264" height="233" rx="5" fill="#fffdf5" />
      <rect x="190" y="65" width="237" height="84" rx="3" fill="#eef1e9" />
      {[218, 278, 338, 398].map((x, i) => <g key={x}><rect x={x - 14} y="85" width="28" height="53" rx="7" fill={i % 2 ? '#adbba1' : '#c6d6d7'} stroke="#7a8b80" /><rect x={x - 9} y="78" width="18" height="10" rx="2" fill="#f9f8f1" stroke="#7a8b80" /><path d={`M${x - 12} 107h24`} stroke="#fffdf5" strokeWidth="13" /></g>)}
      {hit(2, 218, 121, 40, 18)}{hit(3, 338, 121, 58, 16)}
      {hit(0, 308, 174, 154, 19)}
      <rect x="190" y="190" width="237" height="43" rx="3" fill="#eee2d1" />
      {[218, 278, 338, 398].map(x => <g key={x}><rect x={x - 14} y="196" width="28" height="31" rx="4" fill="#b79c77" stroke="#8a735d" /><path d={`M${x - 9} 202h18`} stroke="#f8f3e7" strokeWidth="3" /></g>)}
      {hit(1, 308, 261, 154, 19)}
      <rect x="177" y="303" width="160" height="65" rx="5" fill="#983737" /><rect x="186" y="313" width="142" height="24" rx="4" fill="#512d2b" /><path d="M188 339H326" stroke="#cc8580" />
      {hit(4, 380, 327, 92, 15)}<rect x="358" y="347" width="58" height="5" rx="2" fill="#61312d" />
      <path d="M130 400H487" stroke="#d9d1c1" strokeWidth="3" />
    </>}
  </svg>;
}

export function JapanView({ data, onOpenNote, onAddWord }: { data: Snapshot; onOpenNote: (note: Note) => void; onAddWord: (word: JapanWord) => void }) {
  const [sceneId, setSceneId] = useState<SceneId>('ticket');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const scene = scenes.find(item => item.id === sceneId)!;
  const word = scene.words[selectedIndex] ?? scene.words[0];
  const normalize = (value: string) => value.normalize('NFKC').trim();
  const existing = data.notes.find(note => !note.deletedAt && normalize(note.japanese) === normalize(word.japanese))
    ?? data.notes.find(note => !note.deletedAt && normalize(note.japanese) === normalize(word.reading));
  return <section className="japan-view" aria-label="Everyday Japan">
    <div className="japan-scene-tabs" role="group" aria-label="Choose a scene">{scenes.map(item => <button key={item.id} type="button" aria-pressed={item.id === sceneId} onClick={() => { setSceneId(item.id); setSelectedIndex(0); }}><item.icon size={17} /><span>{item.title}</span></button>)}</div>
    <div className="japan-explore">
      <div className="japan-illustration"><Scene id={sceneId} words={scene.words} selected={word.japanese} onSelect={next => setSelectedIndex(scene.words.findIndex(item => item.japanese === next.japanese))} /><div className="japan-scene-caption"><p lang="fr">{scene.caption}</p><span>Illustrated scene · Tap a word</span></div></div>
      <aside className="japan-word-panel" aria-label="Selected word">
        <div className="japan-word-detail" aria-live="polite" aria-atomic="true"><span className="japan-word-number">{String(selectedIndex + 1).padStart(2, '0')} / {String(scene.words.length).padStart(2, '0')}</span><h2 lang="ja"><JapaneseText text={word.japanese} reading={word.reading} /></h2><p className="japan-word-reading" lang="ja">{word.reading}</p><p className="japan-word-meaning" lang="fr">{word.french}</p></div>
        <button type="button" className="button secondary japan-card-action" onClick={() => existing ? onOpenNote(existing) : onAddWord(word)}>{existing ? <><ArrowUpRight size={16} />Open my card</> : <><Plus size={16} />Add card</>}</button>
        <div className="japan-word-list" aria-label="Words in this scene">{scene.words.map((item, index) => <button type="button" key={item.japanese} className={item.japanese === word.japanese ? 'is-selected' : ''} aria-pressed={item.japanese === word.japanese} onClick={() => setSelectedIndex(index)}><span>{String(index + 1).padStart(2, '0')}</span><span lang="ja"><JapaneseText text={item.japanese} reading={item.reading} /></span><ArrowUpRight size={13} /></button>)}</div>
      </aside>
    </div>
    <p className="japan-scene-note" lang="fr">Illustrations pédagogiques. Les prix et les billets sont fictifs.</p>
  </section>;
}
