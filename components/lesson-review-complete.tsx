'use client';

import { useRef, useState } from 'react';
import { Check, LoaderCircle } from 'lucide-react';

export function LessonReviewComplete({ onFinish }: { onFinish: () => Promise<void> }) {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function finish() {
    if (locked.current || done) return;
    locked.current = true; setPending(true); setError('');
    try { await onFinish(); setDone(true); }
    catch { setError('Enregistrement impossible. Réessaie.'); }
    finally { locked.current = false; setPending(false); }
  }
  return <div className="lesson-review-complete"><button type="button" className={`button ${done ? 'secondary' : 'primary'}`} disabled={pending || done} onClick={() => void finish()}>{pending ? <LoaderCircle size={16} className="spin" /> : done ? <Check size={16} /> : null}{done ? 'Révision enregistrée' : pending ? 'Enregistrement…' : 'Terminer la révision'}</button>{error && <p role="alert">{error}</p>}</div>;
}
