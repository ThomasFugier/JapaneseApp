'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import type { LessonId } from '@/lib/lessons';
import { lessonImmersions } from '@/lib/lesson-immersion';
import { JapaneseText, JapaneseSentence } from './furigana';
import './lesson-immersion.css';
import { ContextualTranslation } from './contextual-translation';
import { LessonReviewComplete } from './lesson-review-complete';

type Props = { lessonId: LessonId; onFinish: () => Promise<void> };

export function LessonImmersion(props: Props) {
  return <ImmersionSession key={props.lessonId} {...props} />;
}

function ImmersionSession({ lessonId, onFinish }: Props) {
  const immersion = lessonImmersions[lessonId];
  const [step, setStep] = useState(0);
  const [translated, setTranslated] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const dialogue = immersion.kind === 'dialogue';
  const complete = !dialogue || step === immersion.lines.length - 1;
  const speakers = [...new Set(immersion.lines.map(line => line.speaker).filter(Boolean))];
  const current = immersion.lines[step];
  useLayoutEffect(() => {
    if (transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [step, translated]);

  return <section className="lesson-immersion" lang="fr" aria-label={`Immersif : ${immersion.title}`}>
    <ContextualTranslation visible={translated} onChange={setTranslated} />
    <header className="immersion-heading"><div><span className="immersion-format">{dialogue ? 'Conversation' : 'Petite histoire'}</span><h3>{immersion.title}</h3><p>{immersion.setting}</p></div></header>
    {dialogue ? <>
      <div className="immersion-transcript" ref={transcript} role="region" aria-label="Conversation" tabIndex={0}>
        {immersion.lines.slice(0, step + 1).map((line, index) => <div className={`immersion-message${line.speaker === speakers[1] ? ' from-second' : ''}`} key={index}>
          <span className="immersion-avatar" aria-hidden="true">{line.speaker?.slice(0, 1)}</span><div className="immersion-message-content"><span className="immersion-speaker">{line.speaker}</span><div className="immersion-bubble"><p lang="ja"><JapaneseSentence text={line.text} reading={line.reading} /></p>{translated && <p className="immersion-french">{line.translation}</p>}</div></div>
        </div>)}
      </div>
      <p className="immersion-announcement" role="status" aria-live="polite" aria-atomic="true">{current.speaker} : {current.text}{translated ? ` — ${current.translation}` : ''}</p>
      <div className="immersion-dialogue-controls"><button type="button" className="text-button" aria-label="Réplique précédente" disabled={step === 0} onClick={() => setStep(value => Math.max(0, value - 1))}><ArrowLeft size={16} /><span>Précédent</span></button><span className="immersion-position" aria-label={`Réplique ${step + 1} sur ${immersion.lines.length}`}>{step + 1} / {immersion.lines.length}</span>{!complete ? <button type="button" className="button primary" onClick={() => setStep(value => Math.min(immersion.lines.length - 1, value + 1))}>Suivant <ArrowRight size={16} /></button> : <button type="button" className="button secondary" onClick={() => setStep(0)}><RotateCcw size={15} />Rejouer</button>}</div>
      {(current.focus || current.note) && <div className="immersion-focus" key={step}>{current.focus && <span lang="ja"><JapaneseText text={current.focus} /></span>}{current.note && <p>{current.note}</p>}</div>}
    </> : <div className="immersion-story" aria-label="Histoire">{immersion.lines.map((line, index) => <section className="immersion-paragraph" key={index}><span className="immersion-paragraph-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><p lang="ja"><JapaneseSentence text={line.text} reading={line.reading} /></p>{translated && <p className="immersion-french">{line.translation}</p>}{(line.focus || line.note) && <details className="immersion-explanation"><summary>Le point de langue</summary>{line.focus && <span lang="ja"><JapaneseText text={line.focus} /></span>}{line.note && <p>{line.note}</p>}</details>}</div></section>)}</div>}
    {complete && <footer className="immersion-complete"><p>{immersion.takeaway}</p><LessonReviewComplete onFinish={onFinish} /></footer>}
  </section>;
}
