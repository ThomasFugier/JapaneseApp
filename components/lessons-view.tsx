'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Check, RotateCcw } from 'lucide-react';
import { lessons, type JapaneseLine, type LessonId } from '@/lib/lessons';
import { JapaneseText } from './furigana';
import './lessons.css';
import { LessonImmersion } from './lesson-immersion';
import { lessonImmersions } from '@/lib/lesson-immersion';
import './lesson-dashboard.css';
import { lessonReviewOrder } from '@/lib/lesson-progress';
import type { LessonProgress } from '@/lib/model';
import { LessonReviewComplete } from './lesson-review-complete';

const categories = ['Grammaire', 'Conjugaison'] as const;
const japaneseFragment = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー・〜]+)/u;
const sections = [{ id: 'rule', label: 'La règle' }, { id: 'patterns', label: 'Construction' }, { id: 'examples', label: 'Exemples' }, { id: 'reminders', label: 'À retenir' }];

function InlineJapanese({ text }: { text: string }) {
  return <>{text.split(japaneseFragment).map((part, index) => japaneseFragment.test(part) ? <span lang="ja" key={index}><JapaneseText text={part} /></span> : part)}</>;
}

function Japanese({ text, reading }: JapaneseLine) {
  return <span lang="ja"><JapaneseText text={text} reading={reading} /></span>;
}

export function LessonsView({ lessonId, onSelect, validatedIds, onToggleValidated, progress, onFinishReview }: { progress?: LessonProgress[]; onFinishReview: (id: LessonId) => Promise<void>; lessonId: LessonId | null; onSelect: (id: LessonId | null) => void; validatedIds: LessonId[]; onToggleValidated: (id: LessonId) => void }) {
  const [mode, setMode] = useState<'course' | 'immersive'>('course');
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const reviewOrder = lessonReviewOrder(progress);
  const suggested = lessons.find(item => item.id === reviewOrder[suggestionOffset % reviewOrder.length])!;
  const reviewDate = (id: LessonId) => { const date = progress?.find(item => item.id === id)?.lastReviewedAt; return date ? `Dernière révision : ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))}` : 'Jamais révisée'; };
  const validated = !!lessonId && validatedIds.includes(lessonId);
  const lesson = lessons.find(item => item.id === lessonId);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (lessonId) heading.current?.focus({ preventScroll: true }); }, [lessonId]);
  function select(id: LessonId | null, nextMode: 'course' | 'immersive' = 'course') { setSuggestionOffset(0); setMode(nextMode); onSelect(id); window.scrollTo({ top: 0, behavior: 'instant' }); }

  if (!lesson) return <div className="lesson-dashboard" lang="fr">
    <section className="lesson-revisit" aria-label="Une leçon à revoir"><div><span className="lesson-revisit-label">À revoir</span><h2>{suggested.title}</h2><p>{lessonImmersions[suggested.id].kind === 'dialogue' ? 'Dialogue' : 'Histoire courte'} · {lessonImmersions[suggested.id].title}</p><p className="lesson-review-date">{reviewDate(suggested.id)}</p></div><div className="lesson-revisit-actions"><button type="button" className="button primary" onClick={() => select(suggested.id, 'immersive')}>Revoir cette leçon <ArrowRight size={16} /></button><button type="button" className="text-button" onClick={() => setSuggestionOffset(value => value + 1)}><RotateCcw size={14} />Une autre leçon</button></div></section>
    <div className="lesson-validation-count">{validatedIds.length} / {lessons.length} leçons validées</div>
    <div className="lesson-categories">{categories.map(category => <section className="lesson-category" key={category} aria-label={`Leçons : ${category}`}><h2>{category}</h2><div className="lesson-tiles">{lessons.filter(item => item.category === category).map(item => <div className="lesson-tile" key={item.id}><button type="button" className="lesson-tile-open" onClick={() => select(item.id)}><span className="lesson-tile-top"><span lang="ja">{item.japanese}</span><ArrowRight size={19} /></span><strong>{item.title}</strong><span className="lesson-tile-description">{item.description}</span></button><p className="lesson-review-date">{reviewDate(item.id)}</p><div className="lesson-tile-actions"><button type="button" className="text-button" onClick={() => select(item.id, 'immersive')}>Immersif <ArrowRight size={14} /></button><button type="button" className="lesson-validation" aria-pressed={validatedIds.includes(item.id)} aria-label={`Valider la leçon : ${item.title}`} onClick={() => onToggleValidated(item.id)}><span><Check size={13} /></span>{validatedIds.includes(item.id) ? 'Validée' : 'À valider'}</button></div></div>)}</div></section>)}</div>
  </div>;

  return <article className="lesson-article" lang="fr" aria-label={lesson.title}>
    <button type="button" className="text-button lesson-back" onClick={() => select(null)}><ArrowLeft size={15} />Toutes les leçons</button>
    <header className="lesson-heading"><span className="lesson-category-label">{lesson.category}</span><h2 ref={heading} tabIndex={-1}>{lesson.title}</h2><p className="lesson-heading-japanese" lang="ja">{lesson.japanese}</p><p className="lesson-description">{lesson.description}</p></header>
    <div className="lesson-mode-bar"><div role="group" aria-label="Mode de la leçon"><button type="button" aria-pressed={mode === 'course'} onClick={() => setMode('course')}>Cours</button><button type="button" aria-pressed={mode === 'immersive'} onClick={() => setMode('immersive')}>Immersif</button></div><button type="button" className="lesson-validation" aria-pressed={validated} onClick={() => onToggleValidated(lesson.id)}><span><Check size={13} /></span>{validated ? 'Validée' : 'Valider la leçon'}</button></div>
    {mode === 'immersive' ? <LessonImmersion key={lesson.id} lessonId={lesson.id} onFinish={() => onFinishReview(lesson.id)} /> : <>
    <nav className="lesson-contents" aria-label="Sommaire de la leçon">{sections.map(section => <a key={section.id} href={`#lesson-${lesson.id}-${section.id}`}>{section.label}</a>)}</nav>

    <section className="lesson-section" id={`lesson-${lesson.id}-rule`} aria-labelledby="lesson-rule-heading"><h3 id="lesson-rule-heading"><span>01</span>La règle</h3><div className="lesson-rule">{lesson.rule.map(paragraph => <p key={paragraph}><InlineJapanese text={paragraph} /></p>)}</div></section>

    <section className="lesson-section" id={`lesson-${lesson.id}-patterns`} aria-labelledby="lesson-patterns-heading"><h3 id="lesson-patterns-heading"><span>02</span>Construction</h3><ol className="lesson-steps">{lesson.steps.map(step => <li key={step}><InlineJapanese text={step} /></li>)}</ol><div className="lesson-patterns">{lesson.patterns.map(pattern => <div className="lesson-pattern" key={pattern.form}><span className="lesson-pattern-label">{pattern.label}</span><p className="lesson-formula" lang="ja"><JapaneseText text={pattern.form} /></p><p className="lesson-pattern-meaning">{pattern.meaning}</p>{pattern.note && <p className="lesson-pattern-note"><InlineJapanese text={pattern.note} /></p>}</div>)}</div>
      {lesson.tables?.map(table => <details className="lesson-reference" key={table.title} open><summary>{table.title}</summary><table className="lesson-table"><thead><tr>{table.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} data-label={table.columns[cellIndex]}>{typeof cell === 'string' ? <span>{cell}</span> : <Japanese {...cell} />}</td>)}</tr>)}</tbody></table></details>)}
    </section>

    <section className="lesson-section" id={`lesson-${lesson.id}-examples`} aria-labelledby="lesson-examples-heading"><h3 id="lesson-examples-heading"><span>03</span>Exemples</h3><div className="lesson-examples">{lesson.examples.map((example, index) => <div className="lesson-example" key={example.text}><span className="lesson-example-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><p className="lesson-example-japanese"><Japanese {...example} /></p><p className="lesson-example-translation">{example.translation}</p>{example.note && <p className="lesson-example-note"><InlineJapanese text={example.note} /></p>}</div></div>)}</div></section>

    <section className="lesson-section" id={`lesson-${lesson.id}-reminders`} aria-labelledby="lesson-reminders-heading"><h3 id="lesson-reminders-heading"><span>04</span>À retenir</h3><div className="lesson-reminders">{lesson.reminders.map(reminder => <div className="lesson-reminder" key={reminder.title}><h4><InlineJapanese text={reminder.title} /></h4><p><InlineJapanese text={reminder.explanation} /></p>{reminder.example && <div className="lesson-reminder-example"><p><Japanese {...reminder.example} /></p><span>{reminder.example.translation}</span></div>}</div>)}</div></section>

    <div className="lesson-course-complete"><LessonReviewComplete key={lesson.id} onFinish={() => onFinishReview(lesson.id)} /></div>
    </>}
    <footer className="lesson-footer"><button type="button" className="text-button" onClick={() => select(null)}><ArrowLeft size={15} />Toutes les leçons</button><div aria-label="Références de la leçon">{lesson.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>{source.title}</span><ExternalLink size={12} /></a>)}</div></footer>
  </article>;
}
