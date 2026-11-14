import { ArrowRight } from 'lucide-react';
import { ClassroomEmoji } from './classroom-interface';

type Props = {
  ready: number;
  cards: number;
  decks: number;
  canReview: boolean;
  onStart: () => void;
  onOpen: (page: 'review' | 'library' | 'lessons' | 'writing' | 'stats') => void;
};

export function ClassroomHome({ ready, cards, decks, canReview, onStart, onOpen }: Props) {
  return <section className="activity-menu" aria-label="Learning activities">
    <div className="activity-grid">
      <article className="activity-card activity-review">
        <button className="activity-open" onClick={() => onOpen('review')}><ClassroomEmoji>🎴</ClassroomEmoji><span className="activity-copy"><strong>Review</strong><span>Japanese ↔ English</span></span><ArrowRight size={25}/></button>
        <div className="activity-footer"><span>{ready ? `${ready} directions ready` : 'Free practice'}</span><button className="text-button" disabled={!canReview} onClick={onStart}>Review all <ArrowRight size={16}/></button></div>
      </article>
      <article className="activity-card activity-writing"><button className="activity-open" onClick={() => onOpen('writing')}><ClassroomEmoji>✏️</ClassroomEmoji><span className="activity-copy"><strong>Write</strong><span>Kana & kanji notebook</span></span><ArrowRight size={25}/></button></article>
      <article className="activity-card activity-lessons"><button className="activity-open" onClick={() => onOpen('lessons')}><ClassroomEmoji>🎓</ClassroomEmoji><span className="activity-copy"><strong>Lessons</strong><span>Grammar & conjugation</span></span><ArrowRight size={25}/></button></article>
      <article className="activity-card activity-library"><button className="activity-open" onClick={() => onOpen('library')}><ClassroomEmoji>📚</ClassroomEmoji><span className="activity-copy"><strong>My cards</strong><span>{cards} {cards === 1 ? 'card' : 'cards'} · {decks} {decks === 1 ? 'deck' : 'decks'}</span></span><ArrowRight size={25}/></button></article>
    </div>
    <div className="activity-menu-footer"><button className="text-button" onClick={() => onOpen('stats')}><ClassroomEmoji>📊</ClassroomEmoji>My progress <ArrowRight size={16}/></button></div>
  </section>;
}
