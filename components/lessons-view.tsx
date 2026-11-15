'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Check, RotateCcw, Search, X } from 'lucide-react';
import { lessons, type JapaneseLine, type LessonId } from '@/lib/lessons';
import { scrollWorkspaceTo } from '@/lib/workspace-scroll';
import { JapaneseText, JapaneseSentence } from './furigana';
import './lessons.css';
import { LessonImmersion } from './lesson-immersion';
import { lessonImmersions } from '@/lib/lesson-immersion';
import './lesson-dashboard.css';
import './classroom-lessons.css';
import { lessonReviewOrder } from '@/lib/lesson-progress';
import type { LessonProgress } from '@/lib/model';
import { ContextualTranslation } from './contextual-translation';
import { LessonReviewComplete } from './lesson-review-complete';
import { lessonCatalogue, type LessonStatus, type LessonSort } from '@/lib/lesson-catalogue';
import './lesson-catalogue.css';

const categories = [...new Set(lessons.map(lesson => lesson.category))];

function LessonCategoryIcon({ category }: { category: string }) {
  return <span className="lesson-category-icon" aria-hidden="true">{category === 'Grammaire' ? '🧩' : category === 'Conjugaison' ? '🔄' : '📚'}</span>;
}
const japaneseFragment = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々ー・〜]+)/u;
const sections = [{ id: 'rule', label: 'La règle' }, { id: 'patterns', label: 'Construction' }, { id: 'examples', label: 'Exemples' }, { id: 'reminders', label: 'À retenir' }];

function InlineJapanese({ text }: { text: string }) {
  return <>{text.split(japaneseFragment).map((part, index) => japaneseFragment.test(part) ? <span lang="ja" key={index}><JapaneseText text={part} /></span> : part)}</>;
}

function Japanese({ text, reading }: JapaneseLine) {
  return <span lang="ja">{reading ? <JapaneseSentence text={text} reading={reading} /> : <JapaneseText text={text} />}</span>;
}

export function LessonsView({ lessonId, onSelect, validatedIds, onToggleValidated, progress, onFinishReview, classroom = false }: { classroom?: boolean; progress?: LessonProgress[]; onFinishReview: (id: LessonId) => Promise<void>; lessonId: LessonId | null; onSelect: (id: LessonId | null) => void; validatedIds: LessonId[]; onToggleValidated: (id: LessonId) => void }) {
  const [translationsVisible, setTranslationsVisible] = useState(true);
  const [mode, setMode] = useState<'course' | 'immersive'>('course');
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [catalogueQuery, setCatalogueQuery] = useState('');
  const [catalogueCategory, setCatalogueCategory] = useState('all');
  const [catalogueStatus, setCatalogueStatus] = useState<LessonStatus>('all');
  const [catalogueSort, setCatalogueSort] = useState<LessonSort>('course');
  const [cataloguePage, setCataloguePage] = useState(1);
  const catalogueHeading = useRef<HTMLHeadingElement>(null);
  const [coursePage, setCoursePage] = useState<{ id: LessonId | null; step: number }>({ id: null, step: 0 });
  const courseStep = coursePage.id === lessonId ? coursePage.step : 0;
  const reviewOrder = lessonReviewOrder(progress);
  const catalogue = lessonCatalogue(lessons, validatedIds, reviewOrder, { query: catalogueQuery, category: catalogueCategory, status: catalogueStatus, sort: catalogueSort, page: cataloguePage });
  const catalogueFiltered = !!catalogueQuery.trim() || catalogueCategory !== 'all' || catalogueStatus !== 'all' || catalogueSort !== 'course';
  const suggested = lessons.find(item => item.id === reviewOrder[suggestionOffset % reviewOrder.length])!;
  const reviewDate = (id: LessonId) => { const date = progress?.find(item => item.id === id)?.lastReviewedAt; return date ? `Dernière révision : ${new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(date))}` : 'Jamais révisée'; };
  const validated = !!lessonId && validatedIds.includes(lessonId);
  const lesson = lessons.find(item => item.id === lessonId);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (lessonId) heading.current?.focus({ preventScroll: true }); }, [lessonId]);
  function select(id: LessonId | null, nextMode: 'course' | 'immersive' = 'course') { setCoursePage({ id, step: 0 }); setSuggestionOffset(0); setMode(nextMode); onSelect(id); scrollWorkspaceTo(0); }

  function changeCourseStep(step: number, scrollToHeading = false) {
    const next = Math.max(0, Math.min(sections.length - 1, step));
    if (next === courseStep) return;
    setCoursePage({ id: lessonId, step: next });
    // Section tabs keep their focus and scroll position; the bottom pager advances to the heading.
    if (!scrollToHeading) return;
    requestAnimationFrame(() => {
      const target = document.getElementById('lesson-' + sections[next].id + '-heading');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  }
  function changeMode(next: 'course' | 'immersive') {
    if (next === 'course') setCoursePage({ id: lessonId, step: 0 });
    setMode(next);
  }

  function resetCatalogue() { setCatalogueQuery(''); setCatalogueCategory('all'); setCatalogueStatus('all'); setCatalogueSort('course'); setCataloguePage(1); }
  function changeCataloguePage(page: number) {
    setCataloguePage(page);
    requestAnimationFrame(() => { catalogueHeading.current?.focus({ preventScroll: true }); catalogueHeading.current?.closest('.lesson-catalogue')?.scrollIntoView({ block: 'start', behavior: 'instant' }); });
  }

  if (!lesson) return <div className="lesson-dashboard" lang="fr">
    <section className="lesson-revisit" aria-label="Une leçon à revoir"><div><span className="lesson-revisit-label"><LessonCategoryIcon category={suggested.category} />À revoir · {suggested.category}</span><h2>{suggested.title}</h2><p>{lessonImmersions[suggested.id].kind === 'dialogue' ? 'Dialogue' : 'Histoire courte'} · {lessonImmersions[suggested.id].title}</p><p className="lesson-review-date">{reviewDate(suggested.id)}</p></div><div className="lesson-revisit-actions"><button type="button" className="button primary" onClick={() => select(suggested.id, 'immersive')}>Revoir cette leçon <ArrowRight size={16} /></button><button type="button" className="text-button" onClick={() => setSuggestionOffset(value => value + 1)}><RotateCcw size={14} />Une autre leçon</button></div></section>
    <section className="lesson-catalogue" aria-labelledby="lesson-catalogue-title">
      <header className="lesson-catalogue-heading"><h2 id="lesson-catalogue-title" ref={catalogueHeading} tabIndex={-1}>Explorer les leçons</h2><span>{validatedIds.length} / {lessons.length} leçons validées</span></header>
      <div className="lesson-catalogue-controls">
        <div className="lesson-catalogue-search-row">
          <div className="lesson-catalogue-search"><Search size={18} aria-hidden="true" /><input type="search" aria-label="Rechercher une leçon" placeholder="Titre, notion ou japonais…" value={catalogueQuery} onChange={event => { setCatalogueQuery(event.target.value); setCataloguePage(1); }} />{catalogueQuery && <button type="button" aria-label="Effacer la recherche" onClick={() => { setCatalogueQuery(''); setCataloguePage(1); }}><X size={16} /></button>}</div>
          <div className="lesson-catalogue-selects"><select aria-label="Filtrer par validation" value={catalogueStatus} onChange={event => { setCatalogueStatus(event.target.value as LessonStatus); setCataloguePage(1); }}><option value="all">Tous les statuts</option><option value="pending">À valider</option><option value="validated">Validées</option></select><select aria-label="Trier les leçons" value={catalogueSort} onChange={event => { setCatalogueSort(event.target.value as LessonSort); setCataloguePage(1); }}><option value="course">Ordre du cours</option><option value="review">À revoir en priorité</option><option value="title">Titre A–Z</option></select></div>
        </div>
        <div className="lesson-category-filters" role="group" aria-label="Catégories des leçons"><button type="button" aria-pressed={catalogueCategory === 'all'} onClick={() => { setCatalogueCategory('all'); setCataloguePage(1); }}><LessonCategoryIcon category="all" />Toutes<small>{lessons.length}</small></button>{categories.map(category => <button type="button" key={category} aria-pressed={catalogueCategory === category} onClick={() => { setCatalogueCategory(category); setCataloguePage(1); }}><LessonCategoryIcon category={category} />{category}<small>{lessons.filter(item => item.category === category).length}</small></button>)}</div>
      </div>
      <div className="lesson-catalogue-results"><p role="status" aria-live="polite">{catalogue.total > catalogue.items.length ? (catalogue.start + 1) + '–' + (catalogue.start + catalogue.items.length) + ' sur ' : ''}{catalogue.total} leçon{catalogue.total !== 1 ? 's' : ''}</p>{catalogueFiltered && <button type="button" className="text-button" onClick={resetCatalogue}><RotateCcw size={13} />Réinitialiser</button>}</div>
      <div className="lesson-catalogue-grid">{catalogue.items.map(item => <article className="lesson-catalogue-card" key={item.id}>
        <button type="button" className="lesson-catalogue-open" onClick={() => select(item.id)} aria-label={'Ouvrir la leçon : ' + item.title}><span className="lesson-catalogue-card-heading"><LessonCategoryIcon category={item.category} />{item.category}<small>Leçon {String(lessons.findIndex(entry => entry.id === item.id) + 1).padStart(2, '0')}</small><ArrowRight size={15} aria-hidden="true" /></span><strong>{item.title}</strong><span className="lesson-catalogue-japanese" lang="ja">{item.japanese}</span><span className="lesson-catalogue-description">{item.description}</span></button>
        <div className="lesson-catalogue-card-footer"><p className="lesson-review-date">{reviewDate(item.id)}</p><div className="lesson-catalogue-card-actions"><button type="button" className="text-button" aria-label={'Immersif : ' + item.title} onClick={() => select(item.id, 'immersive')}>Immersif <ArrowRight size={14} /></button><button type="button" className="lesson-validation" aria-pressed={validatedIds.includes(item.id)} aria-label={'Valider la leçon : ' + item.title} onClick={() => onToggleValidated(item.id)}><span><Check size={13} /></span>{validatedIds.includes(item.id) ? 'Validée' : 'À valider'}</button></div></div>
      </article>)}</div>
      {!catalogue.total && <div className="lesson-catalogue-empty"><Search size={26} aria-hidden="true" /><h3>Aucune leçon trouvée</h3><p>Essaie un autre mot ou ajuste les filtres.</p><button type="button" className="button secondary" onClick={resetCatalogue}>Voir toutes les leçons</button></div>}
      {catalogue.pageCount > 1 && <nav className="lesson-catalogue-pagination" aria-label="Pages des leçons"><button type="button" className="button secondary" disabled={catalogue.page === 1} onClick={() => changeCataloguePage(catalogue.page - 1)}><ArrowLeft size={16} />Précédent</button><span>Page {catalogue.page} sur {catalogue.pageCount}</span><button type="button" className="button secondary" disabled={catalogue.page === catalogue.pageCount} onClick={() => changeCataloguePage(catalogue.page + 1)}>Suivant <ArrowRight size={16} /></button></nav>}
    </section>
  </div>;

  return <article className={`lesson-article${classroom ? ' classroom-lesson-activity' : ''}`} lang="fr" aria-label={lesson.title}>
    {mode === 'course' && (!classroom || (courseStep === 1 && lesson.patterns.length > 0) || (courseStep === 2 && lesson.examples.length > 0) || (courseStep === 3 && lesson.reminders.some(reminder => reminder.example))) && <ContextualTranslation visible={translationsVisible} onChange={setTranslationsVisible} />}
    <button type="button" className="text-button lesson-back" onClick={() => select(null)}><ArrowLeft size={15} />Toutes les leçons</button>
    <header className="lesson-heading"><span className="lesson-category-label"><LessonCategoryIcon category={lesson.category} />{classroom && <>Chapitre {String(lessons.findIndex(entry => entry.id === lesson.id) + 1).padStart(2, '0')} · </>}{lesson.category}</span><h2 ref={heading} tabIndex={-1}>{lesson.title}</h2><p className="lesson-heading-japanese" lang="ja">{lesson.japanese}</p><p className="lesson-description">{lesson.description}</p></header>
    <div className="lesson-mode-bar"><div role="group" aria-label="Mode de la leçon"><button type="button" aria-pressed={mode === 'course'} onClick={() => changeMode('course')}>Cours</button><button type="button" aria-pressed={mode === 'immersive'} onClick={() => changeMode('immersive')}>Immersif</button></div><button type="button" className="lesson-validation" aria-pressed={validated} onClick={() => onToggleValidated(lesson.id)}><span><Check size={13} /></span>{validated ? 'Validée' : 'Valider la leçon'}</button></div>
    {mode === 'immersive' ? <LessonImmersion key={lesson.id} lessonId={lesson.id} onFinish={() => onFinishReview(lesson.id)} /> : <>
    <nav className="lesson-contents" aria-label="Sommaire de la leçon">{sections.map((section, index) => classroom ? <button type="button" key={section.id} aria-current={courseStep === index ? 'step' : undefined} aria-controls={`lesson-${lesson.id}-${section.id}`} onClick={() => changeCourseStep(index)}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{section.label}</button> : <a key={section.id} href={`#lesson-${lesson.id}-${section.id}`}>{section.label}</a>)}</nav>

    <section className="lesson-section" hidden={classroom && courseStep !== 0} id={`lesson-${lesson.id}-rule`} aria-labelledby="lesson-rule-heading"><h3 id="lesson-rule-heading" tabIndex={classroom ? -1 : undefined}><span>01</span>La règle</h3><div className="lesson-rule">{lesson.rule.map(paragraph => <p key={paragraph}><InlineJapanese text={paragraph} /></p>)}</div></section>

    <section className="lesson-section" hidden={classroom && courseStep !== 1} id={`lesson-${lesson.id}-patterns`} aria-labelledby="lesson-patterns-heading"><h3 id="lesson-patterns-heading" tabIndex={classroom ? -1 : undefined}><span>02</span>Construction</h3><ol className="lesson-steps">{lesson.steps.map(step => <li key={step}><InlineJapanese text={step} /></li>)}</ol><div className="lesson-patterns">{lesson.patterns.map(pattern => <div className="lesson-pattern" key={pattern.form}><span className="lesson-pattern-label">{pattern.label}</span><p className="lesson-formula" lang="ja"><JapaneseText text={pattern.form} /></p>{translationsVisible && <p className="lesson-pattern-meaning">{pattern.meaning}</p>}{pattern.note && <p className="lesson-pattern-note"><InlineJapanese text={pattern.note} /></p>}</div>)}</div>
      {lesson.tables?.map(table => <details className="lesson-reference" key={table.title} open><summary>{table.title}</summary><table className="lesson-table"><thead><tr>{table.columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{table.rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex} data-label={table.columns[cellIndex]}>{typeof cell === 'string' ? <span>{cell}</span> : <Japanese {...cell} />}</td>)}</tr>)}</tbody></table></details>)}
    </section>

    <section className="lesson-section" hidden={classroom && courseStep !== 2} id={`lesson-${lesson.id}-examples`} aria-labelledby="lesson-examples-heading"><h3 id="lesson-examples-heading" tabIndex={classroom ? -1 : undefined}><span>03</span>Exemples</h3><div className="lesson-examples">{lesson.examples.map((example, index) => <div className="lesson-example" key={example.text}><span className="lesson-example-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><p className="lesson-example-japanese"><Japanese {...example} /></p>{translationsVisible && <p className="lesson-example-translation">{example.translation}</p>}{example.note && <p className="lesson-example-note"><InlineJapanese text={example.note} /></p>}</div></div>)}</div></section>

    <section className="lesson-section" hidden={classroom && courseStep !== 3} id={`lesson-${lesson.id}-reminders`} aria-labelledby="lesson-reminders-heading"><h3 id="lesson-reminders-heading" tabIndex={classroom ? -1 : undefined}><span>04</span>À retenir</h3><div className="lesson-reminders">{lesson.reminders.map(reminder => <div className="lesson-reminder" key={reminder.title}><h4><InlineJapanese text={reminder.title} /></h4><p><InlineJapanese text={reminder.explanation} /></p>{reminder.example && <div className="lesson-reminder-example"><p><Japanese {...reminder.example} /></p>{translationsVisible && <span>{reminder.example.translation}</span>}</div>}</div>)}</div></section>

    {classroom && <nav className="classroom-lesson-pager" aria-label="Parcourir le cours"><button type="button" className="button secondary" disabled={courseStep === 0} onClick={() => changeCourseStep(courseStep - 1, true)}><ArrowLeft size={17} />Précédent</button><span aria-label={`Partie ${courseStep + 1} sur ${sections.length}`}>{courseStep + 1} / {sections.length}</span>{courseStep < sections.length - 1 ? <button type="button" className="button primary" onClick={() => changeCourseStep(courseStep + 1, true)}>Suivant <ArrowRight size={17} /></button> : <button type="button" className="button primary" onClick={() => { changeMode('immersive'); heading.current?.focus({ preventScroll: true }); scrollWorkspaceTo(0); }}>Passer à l’immersion <ArrowRight size={17} /></button>}</nav>}
    {(!classroom || courseStep === sections.length - 1) && <div className="lesson-course-complete"><LessonReviewComplete key={lesson.id} onFinish={() => onFinishReview(lesson.id)} /></div>}
    </>}
    <footer className="lesson-footer"><button type="button" className="text-button" onClick={() => select(null)}><ArrowLeft size={15} />Toutes les leçons</button><div aria-label="Références de la leçon">{lesson.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer"><span>{source.title}</span><ExternalLink size={12} /></a>)}</div></footer>
  </article>;
}
