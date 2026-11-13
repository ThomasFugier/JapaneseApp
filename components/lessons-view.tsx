'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react';
import { lessons, type JapaneseLine, type LessonId } from '@/lib/lessons';
import { JapaneseText } from './furigana';
import './lessons.css';

const categories = ['Grammar', 'Conjugation'] as const;
const japaneseFragment = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー・〜]+)/u;
const sections = [{ id: 'rule', label: 'The rule' }, { id: 'patterns', label: 'Build it' }, { id: 'examples', label: 'Examples' }, { id: 'reminders', label: 'Keep in mind' }];

function InlineJapanese({ text }: { text: string }) {
  return <>{text.split(japaneseFragment).map((part, index) => japaneseFragment.test(part) ? <span lang="ja" key={index}><JapaneseText text={part} /></span> : part)}</>;
}

function Japanese({ text, reading }: JapaneseLine) {
  return <span lang="ja"><JapaneseText text={text} reading={reading} /></span>;
}

export function LessonsView({ lessonId, onSelect }: { lessonId: LessonId | null; onSelect: (id: LessonId | null) => void }) {
  const lesson = lessons.find(item => item.id === lessonId);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (lessonId) heading.current?.focus({ preventScroll: true }); }, [lessonId]);
  function select(id: LessonId | null) { onSelect(id); window.scrollTo({ top: 0, behavior: 'instant' }); }

  if (!lesson) return <div className="lesson-categories">{categories.map(category => <section className="lesson-category" key={category} aria-label={`${category} lessons`}><h2>{category}</h2><div className="lesson-tiles">{lessons.filter(item => item.category === category).map(item => <button type="button" className="lesson-tile" key={item.id} onClick={() => select(item.id)}><span className="lesson-tile-top"><span lang="ja">{item.japanese}</span><ArrowRight size={19} /></span><strong>{item.title}</strong><span className="lesson-tile-description">{item.description}</span></button>)}</div></section>)}</div>;

  return <article className="lesson-article" aria-label={lesson.title}>
    <button type="button" className="text-button lesson-back" onClick={() => select(null)}><ArrowLeft size={15} />All lessons</button>
    <header className="lesson-heading"><span className="lesson-category-label">{lesson.category}</span><h2 ref={heading} tabIndex={-1}>{lesson.title}</h2><p className="lesson-heading-japanese" lang="ja">{lesson.japanese}</p><p className="lesson-description">{lesson.description}</p></header>
    <nav className="lesson-contents" aria-label="Lesson sections">{sections.map(section => <a key={section.id} href={`#lesson-${lesson.id}-${section.id}`}>{section.label}</a>)}</nav>

    <section className="lesson-section" id={`lesson-${lesson.id}-rule`} aria-labelledby="lesson-rule-heading"><h3 id="lesson-rule-heading"><span>01</span>The rule</h3><div className="lesson-rule">{lesson.rule.map(paragraph => <p key={paragraph}><InlineJapanese text={paragraph} /></p>)}</div></section>

    <section className="lesson-section" id={`lesson-${lesson.id}-patterns`} aria-labelledby="lesson-patterns-heading"><h3 id="lesson-patterns-heading"><span>02</span>Build it</h3><ol className="lesson-steps">{lesson.steps.map(step => <li key={step}><InlineJapanese text={step} /></li>)}</ol><div className="lesson-patterns">{lesson.patterns.map(pattern => <div className="lesson-pattern" key={pattern.label}><span className="lesson-pattern-label">{pattern.label}</span><p className="lesson-formula" lang="ja"><JapaneseText text={pattern.form} /></p><p className="lesson-pattern-meaning">{pattern.meaning}</p>{pattern.note && <p className="lesson-pattern-note"><InlineJapanese text={pattern.note} /></p>}</div>)}</div>
      {lesson.tables?.map(table => <details className="lesson-reference" key={table.title} open><summary>{table.title}</summary><table className="lesson-table"><thead><tr>{table.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} data-label={table.columns[cellIndex]}>{typeof cell === 'string' ? <span>{cell}</span> : <Japanese {...cell} />}</td>)}</tr>)}</tbody></table></details>)}
    </section>

    <section className="lesson-section" id={`lesson-${lesson.id}-examples`} aria-labelledby="lesson-examples-heading"><h3 id="lesson-examples-heading"><span>03</span>Examples</h3><div className="lesson-examples">{lesson.examples.map((example, index) => <div className="lesson-example" key={example.text}><span className="lesson-example-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><p className="lesson-example-japanese"><Japanese {...example} /></p><p className="lesson-example-english">{example.english}</p>{example.note && <p className="lesson-example-note"><InlineJapanese text={example.note} /></p>}</div></div>)}</div></section>

    <section className="lesson-section" id={`lesson-${lesson.id}-reminders`} aria-labelledby="lesson-reminders-heading"><h3 id="lesson-reminders-heading"><span>04</span>Keep in mind</h3><div className="lesson-reminders">{lesson.reminders.map(reminder => <div className="lesson-reminder" key={reminder.title}><h4><InlineJapanese text={reminder.title} /></h4><p><InlineJapanese text={reminder.explanation} /></p>{reminder.example && <div className="lesson-reminder-example"><p><Japanese {...reminder.example} /></p><span>{reminder.example.english}</span></div>}</div>)}</div></section>

    <footer className="lesson-footer"><button type="button" className="text-button" onClick={() => select(null)}><ArrowLeft size={15} />All lessons</button><div aria-label="Lesson references">{lesson.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink size={12} /></a>)}</div></footer>
  </article>;
}
