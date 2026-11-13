import './review-counts.css';

export function ReviewDirectionCounts({ counts }: { counts: { newCount: number; dueCount: number } }) {
  return <span className="review-direction-counts"><span><b>{counts.newCount}</b> new {counts.newCount === 1 ? 'direction' : 'directions'}</span><span><b>{counts.dueCount}</b> due {counts.dueCount === 1 ? 'direction' : 'directions'}</span></span>;
}

export function ReviewDirectionHint() {
  return <p className="review-count-note">Each card has two review directions: JP → EN and EN → JP.</p>;
}
