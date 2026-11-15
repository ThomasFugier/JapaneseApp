'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, Download, LoaderCircle, MessageCircle, RotateCcw, X } from 'lucide-react';
import type { WebWorkerMLCEngine } from '@mlc-ai/web-llm';
import type { Snapshot } from '@/lib/model';
import { CONVERSATION_LIMIT, cleanConversationReply, ConversationResponseError, conversationHelpInstruction, conversationProfile, conversationPrompt, hasJapaneseReply, isJapaneseMessage, recentConversation, repeatsConversationReply, type ConversationMessage } from '@/lib/conversation';
import { loadConversation, saveConversation } from '@/lib/conversation-storage';
import { conversationModelForDevice, isMobileConversationDevice, LIGHT_CONVERSATION_MODEL, QUALITY_CONVERSATION_MODEL, MOBILE_CONVERSATION_MODEL_KEY, markConversationRunning, wasConversationInterrupted } from '@/lib/conversation-runtime';
import { JapaneseText } from './furigana';
import { JapaneseChatInput } from './japanese-chat-input';
import './conversation-chat.css';

const models = [
  { id: LIGHT_CONVERSATION_MODEL, label: 'Léger · Qwen3 1.7B', size: 'environ 1 Go à télécharger · 2 Go de mémoire GPU' },
  { id: QUALITY_CONVERSATION_MODEL, label: 'Qualité · Qwen3 4B', size: 'environ 2,5 Go à télécharger · 3,5 Go de mémoire GPU' },
];
function markRunning(running: boolean) {
  try { markConversationRunning(window.sessionStorage, running); } catch { /* Session storage can be blocked. */ }
}
const message = (role: ConversationMessage['role'], content: string): ConversationMessage => ({ id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() });

const previewText = (text: string) => {
  const characters = Array.from(text);
  return characters.length > 64 ? characters.slice(0, 64).join('') + '…' : text;
};

export function ConversationChat({ data, active, onOpen, displayTools }: { data: Snapshot; active: boolean; onOpen: () => void; displayTools?: ReactNode }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const history = useRef(messages);
  const [hydrated, setHydrated] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [modelId, setModelId] = useState(models[1].id);
  const [mobile, setMobile] = useState(false);
  const [needsResume, setNeedsResume] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ progress: 0, text: '' });
  const [draft, setDraft] = useState('');
  const [partial, setPartial] = useState('');
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [canRetry, setCanRetry] = useState(false);
  const [cache, setCache] = useState<{ modelId: string; available: boolean } | null>(null);
  const lastInstruction = useRef<string | undefined>(undefined);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewport, setViewport] = useState<{ height: number; offset: number; keyboard: boolean; top: number; bottom: number } | null>(null);
  const settingsPanel = useRef<HTMLDivElement>(null);
  const engine = useRef<WebWorkerMLCEngine | null>(null);
  const worker = useRef<Worker | null>(null);
  const epoch = useRef(0);
  const mounted = useRef(false);
  const locked = useRef(false);
  const stopped = useRef(false);
  const cancelOperation = useRef<((error: Error) => void) | null>(null);
  const output = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const latestData = useRef(data); latestData.current = data;

  useEffect(() => {
    mounted.current = true;
    setSupported(window.isSecureContext && 'gpu' in navigator);
    const mobileDevice = isMobileConversationDevice(navigator);
    setMobile(mobileDevice);
    let interrupted = false;
    try { interrupted = wasConversationInterrupted(window.sessionStorage); } catch { /* Keep manual recovery optional. */ }
    if (interrupted) {
      setNeedsResume(true);
      setError('La préparation ou la réponse précédente a été interrompue. Le modèle léger est sélectionné. Reprends la discussion manuellement pour éviter une boucle de rechargements.');
    }
    let savedModel: string | null = null;
    let mobileModel: string | null = null;
    try {
      const savedDraft = localStorage.getItem('kotoba-conversation-draft-v1');
      if (savedDraft) setDraft(savedDraft.slice(0, 1000));
      savedModel = localStorage.getItem('kotoba-conversation-model');
      mobileModel = localStorage.getItem(MOBILE_CONVERSATION_MODEL_KEY);
      if (interrupted && mobileDevice) localStorage.setItem(MOBILE_CONVERSATION_MODEL_KEY, LIGHT_CONVERSATION_MODEL);
    } catch { /* A blocked preference store does not prevent conversation. */ }
    setModelId(conversationModelForDevice(mobileDevice, savedModel, mobileModel, interrupted));
    let live = true;
    void loadConversation().then(saved => {
      if (live) { history.current = saved; setMessages(saved); }
    }).catch(() => { if (live) setStorageError('La mémoire locale est indisponible. Les échanges de cette session restent visibles.'); })
      .finally(() => { if (live) setHydrated(true); });
    return () => {
      live = false; mounted.current = false; epoch.current++;
      cancelOperation.current?.(new Error('cancelled'));
      worker.current?.terminate(); worker.current = null; engine.current = null;
    };
  }, []);

  useEffect(() => {
    if (nearBottom.current && output.current) output.current.scrollTop = output.current.scrollHeight;
  }, [messages, partial, busy, active]);

  useEffect(() => {
    if (hydrated) { try { localStorage.setItem('kotoba-conversation-draft-v1', draft); } catch { /* Draft remains editable. */ } }
  }, [draft, hydrated]);

  useLayoutEffect(() => {
    if (!active) { setSettingsOpen(false); return; }
    const header = document.querySelector<HTMLElement>('.topbar');
    const navigation = document.querySelector<HTMLElement>('.mobile-nav');
    const shell = document.querySelector<HTMLElement>('.app-shell');
    const resize = () => {
      const view = window.visualViewport;
      const keyboard = !!view && view.height < window.innerHeight - 150;
      const fixedFrame = document.documentElement.classList.contains('stable-mobile-shell') ? shell?.getBoundingClientRect() : null;
      setViewport({ height: fixedFrame?.height ?? view?.height ?? window.innerHeight, offset: fixedFrame?.top ?? view?.offsetTop ?? 0, keyboard,
        top: header?.getBoundingClientRect().height ?? 76,
        bottom: keyboard ? 0 : navigation?.getBoundingClientRect().height ?? 0 });
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (header) observer.observe(header);
    if (navigation) observer.observe(navigation);
    if (shell) observer.observe(shell);
    window.visualViewport?.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.visualViewport?.removeEventListener('resize', resize); window.visualViewport?.removeEventListener('scroll', resize); window.removeEventListener('resize', resize); };
  }, [active]);

  useEffect(() => {
    if (!active || !hydrated || !supported || state !== 'idle' || locked.current) return;
    let live = true;
    void import('@mlc-ai/web-llm').then(async ({ hasModelInCache }) => {
      const available = await hasModelInCache(modelId);
      if (!live) return;
      setCache({ modelId, available: available || !!engine.current });
      if (available && !needsResume) void start();
    }).catch(() => { /* An uncached model can still be started explicitly. */ });
    return () => { live = false; };
    // Starting follows entering Discussion or choosing a cached model, not pausing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hydrated, supported, modelId, needsResume]);

  useEffect(() => {
    if (!settingsOpen) return;
    settingsPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || settingsPanel.current?.contains(event.target) || event.target.closest('[aria-controls="discussion-settings"]')) return;
      setSettingsOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSettingsOpen(false); document.querySelector<HTMLElement>('[aria-controls="discussion-settings"]')?.focus(); } };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [settingsOpen]);

  async function persist(next: ConversationMessage[]) {
    history.current = next.slice(-CONVERSATION_LIMIT);
    if (mounted.current) setMessages(history.current);
    try { await saveConversation(history.current); if (mounted.current) setStorageError(''); }
    catch { if (mounted.current) setStorageError('Cet échange n’a pas pu être sauvegardé. Garde cette page ouverte pour le conserver.'); }
  }

  async function operation<T,>(task: () => Promise<T>, milliseconds: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([task(), new Promise<never>((_, reject) => {
        cancelOperation.current = reject;
        timer = setTimeout(() => reject(new Error('Le modèle met trop de temps à répondre. Relance-le ou choisis le modèle léger.')), milliseconds);
      })]);
    } finally { clearTimeout(timer); cancelOperation.current = null; }
  }

  function release() {
    markRunning(false);
    epoch.current++;
    worker.current?.terminate(); worker.current = null; engine.current = null;
    if (mounted.current) setState('idle');
  }

  async function generate(current: ConversationMessage[], instruction?: string) {
    const ai = engine.current;
    if (!ai) return;
    const request = epoch.current;
    lastInstruction.current = instruction; setCanRetry(false);
    markRunning(true);
    stopped.current = false; setBusy(true); setPartial(''); setError(''); nearBottom.current = true;
    let answer = '';
    try {
      await operation(async () => {
        const context = recentConversation(current);
        const modelMessages = [
            { role: 'system', content: conversationPrompt(latestData.current, current, new Date(), current.at(-1)?.content) },
            ...context,
            ...(instruction ? [{ role: 'user' as const, content: instruction }] : []),
          ] as { role: 'system' | 'user' | 'assistant'; content: string }[];
        const response = await ai.chat.completions.create({
          messages: modelMessages,
          stream: true, extra_body: { enable_thinking: false }, temperature: 0.65, top_p: 0.9,
          max_tokens: 280, repetition_penalty: 1.08,
        });
        for await (const chunk of response) {
          if (!mounted.current || request !== epoch.current) return;
          answer += chunk.choices[0]?.delta.content ?? '';
          const visible = cleanConversationReply(answer);
          setPartial(hasJapaneseReply(visible) && !repeatsConversationReply(visible, current) ? visible : '');
        }
        answer = cleanConversationReply(answer);
        if (!stopped.current && (!hasJapaneseReply(answer) || repeatsConversationReply(answer, current))) {
          setPartial('');
          // Restart with a small, focused context instead of reinforcing a failed loop.
          const repeated = repeatsConversationReply(answer, current);
          const revised = await ai.chat.completions.create({
            messages: [
              { role: 'system', content: `あなたは親しい友達のようなＡＩです。やさしい日本語だけで１〜３文。外国語やローマ字は禁止です。食事など実際にはしていない体験は作らないでください。下の学習済み文法と基本の「です・ます」、カードの単語を中心に使ってください。質問はしなくていいです。学習データ（参照用）: ${JSON.stringify(conversationProfile(latestData.current, current.at(-1)?.content))}${conversationHelpInstruction(current)}` },
              { role: 'user', content: repeated
                ? `次の説明ではわかりませんでした。別の簡単な言葉で説明し、身近な具体例を一つ示してください。同じ文を繰り返さないでください。\n前の説明（引用）: ${JSON.stringify(answer.slice(0, 400))}`
                : `相手の発言（引用）: ${JSON.stringify(current.at(-1)?.content || instruction || '日本語で話しましょう。')}\n次の下書きを、自然でやさしい日本語だけに直してください。説明の前置きは不要です。\n下書き（引用）: ${JSON.stringify(answer.slice(0, 600))}` },
            ],
            stream: false, extra_body: { enable_thinking: false }, temperature: 0.4, max_tokens: 280,
          });
          answer = cleanConversationReply(revised.choices[0]?.message.content ?? '');
          if (!hasJapaneseReply(answer) || repeatsConversationReply(answer, current)) {
            console.warn(`Conversation response rejected: japanese=${hasJapaneseReply(answer)}, repeated=${repeatsConversationReply(answer, current)}`);
            throw new ConversationResponseError();
          }
        }
      }, 180000);
      if (!mounted.current || request !== epoch.current) return;
      const clean = cleanConversationReply(answer);
      if (clean && hasJapaneseReply(clean)) await persist([...current, message('assistant', clean)]);
      else if (!stopped.current) throw new ConversationResponseError();
    } catch (cause) {
      if (mounted.current && request === epoch.current) {
        setError(cause instanceof Error ? cause.message : 'La réponse a échoué. Relance le modèle pour réessayer.');
        if (cause instanceof ConversationResponseError) setCanRetry(true);
        else { setCanRetry(false); release(); }
      }
    } finally {
      if (mounted.current && request === epoch.current) markRunning(false);
      if (mounted.current) { setBusy(false); setPartial(''); }
    }
  }

  async function start() {
    if (locked.current || !hydrated || !supported) return;
    const request = ++epoch.current;
    locked.current = true; setNeedsResume(false); markRunning(true); setError(''); setState('loading'); setProgress({ progress: 0, text: 'Préparation du modèle…' });
    try {
      await operation(async () => {
        const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
        if (!mounted.current || request !== epoch.current) throw new Error('cancelled');
        const nextWorker = new Worker('/ai/conversation.worker.js', { type: 'module' });
        worker.current = nextWorker;
        nextWorker.onerror = () => cancelOperation.current?.(new Error('Le moteur local a rencontré un problème. Vérifie la compatibilité WebGPU et essaie le modèle léger.'));
        const ai = await CreateWebWorkerMLCEngine(nextWorker, modelId, {
          initProgressCallback: report => { if (mounted.current) setProgress(report); },
        });
        if (!mounted.current || request !== epoch.current || worker.current !== nextWorker) { nextWorker.terminate(); throw new Error('cancelled'); }
        engine.current = ai;
      }, 900000);
      if (!mounted.current) return;
      setCache({ modelId, available: true });
      setState('ready');
      markRunning(false);
      if (history.current.at(-1)?.role === 'user') await generate(history.current);
      else if (!history.current.length || Date.now() - Date.parse(history.current.at(-1)!.createdAt) > 4 * 60 * 60 * 1000) await generate(history.current, history.current.length
        ? '日本語で会話を再開してください。前の会話と今の時間帯を参考に、やさしい質問を一つしてください。私の今日の予定や天気はわかりません。'
        : 'やさしい日本語だけで、短いあいさつと、今の時間帯に合う質問を一つ書いてください。私の予定や天気はわかりません。');
    } catch (cause) {
      if (mounted.current) {
        if (!(cause instanceof Error && cause.message === 'cancelled')) setError(cause instanceof Error ? cause.message : 'Impossible de charger le modèle. Vérifie ta connexion et la mémoire disponible.');
        release();
      }
    } finally { locked.current = false; }
  }

  async function send(text: string) {
    if (locked.current || !engine.current || !text.trim()) return;
    if (!isJapaneseMessage(text)) { setError('Écris ton message en japonais avant de l’envoyer.'); return; }
    locked.current = true; setDraft(''); setClearConfirm(false);
    try {
      const next = [...history.current, message('user', text.trim().slice(0, 1000))];
      await persist(next);
      if (mounted.current) await generate(history.current);
    } finally { locked.current = false; }
  }

  async function clear() {
    if (locked.current) return;
    locked.current = true;
    try { await persist([]); setClearConfirm(false); setError(''); setCanRetry(false); lastInstruction.current = undefined; }
    finally { locked.current = false; }
  }

  async function retryResponse() {
    if (locked.current || !engine.current) return;
    locked.current = true;
    try { await generate(history.current, lastInstruction.current); }
    finally { locked.current = false; }
  }

  const selected = models.find(model => model.id === modelId)!;
  const cached = cache?.modelId === modelId && cache.available;
  if (!active) return <button type="button" className="discussion-preview" onClick={() => { nearBottom.current = true; onOpen(); }} aria-label="Ouvrir la discussion en japonais">
    <span className="discussion-preview-heading"><span className="discussion-preview-avatar"><MessageCircle size={20} /></span><span><strong>Discussion</strong><small>Ton japonais, dans la vraie vie</small></span><ArrowRight size={18} /></span>
    <span className="discussion-preview-thread" aria-hidden="true">{messages.length ? messages.slice(-2).map(item => <span key={item.id} className={`discussion-preview-bubble is-${item.role}`} lang="ja"><JapaneseText text={previewText(item.content)} /></span>) : <span className="discussion-preview-bubble is-assistant" lang="ja"><JapaneseText text="日本語で話しませんか。" /></span>}{busy && <span className="discussion-preview-bubble discussion-dots">•••</span>}</span>
    <span className="discussion-preview-footer">{state === 'loading' ? 'Préparation de la conversation…' : 'Ouvrir la conversation'}<span>日本語で話そう</span></span>
  </button>;

  const style = viewport ? { '--discussion-viewport': `${viewport.height}px`, '--discussion-offset': `${viewport.offset}px`, '--discussion-top': `${viewport.top}px`, '--discussion-bottom': `${viewport.bottom}px` } as CSSProperties : undefined;
  return <section className={`discussion-view${viewport?.keyboard ? ' keyboard-open' : ''}`} style={style} aria-labelledby="discussion-title">
    <header className="discussion-header"><span className="discussion-preview-avatar"><MessageCircle size={18} /></span><div><h2 id="discussion-title">Discussion</h2><span>{state === 'loading' ? 'Préparation…' : busy ? 'Écrit…' : state === 'ready' ? 'IA locale · prête à discuter' : 'Japonais · sur cet appareil'}</span></div><i className={state === 'ready' ? 'is-ready' : ''} aria-hidden="true" /></header>
    <div ref={output} className="discussion-messages" role="log" aria-label="Conversation japonaise" aria-busy={busy} onScroll={event => { const el = event.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 90; }}>
      {!messages.length && !busy && <div className="discussion-empty"><span lang="ja">話そう</span><p>Un peu de japonais, simplement.</p><small>La conversation suit tes leçons et tes cartes.</small></div>}
      {messages.map(item => <article key={item.id} className={`discussion-message is-${item.role}`} aria-label={item.role === 'assistant' ? 'Partenaire' : 'Toi'}><p lang="ja">{item.role === 'assistant' ? <JapaneseText text={item.content} /> : item.content}</p></article>)}
      {busy && <article className="discussion-message is-assistant" aria-label="Partenaire">{partial ? <p lang="ja">{partial}</p> : <span className="discussion-dots" aria-label="Réfléchit">•••</span>}</article>}
    </div>
    <div className="discussion-bottom">
      {error && <div className="discussion-warning"><p role="alert">{error}</p>{canRetry && state === 'ready' && <button className="text-button" disabled={busy} onClick={() => void retryResponse()}>Réessayer la réponse</button>}</div>}
      {storageError && <p className="discussion-warning" role="alert">{storageError}</p>}
      {state === 'loading' && <div className="discussion-loading"><LoaderCircle size={14} className="spin" /><span role="status">Chargement · {Math.round(Math.min(1, Math.max(0, progress.progress)) * 100)} %</span><progress max={1} value={Math.min(1, Math.max(0, progress.progress))} /><button className="icon-button" aria-label="Annuler le chargement" onClick={() => { cancelOperation.current?.(new Error('cancelled')); release(); }}><X size={15} /></button></div>}
      {state === 'idle' && <div className="discussion-activate">{supported === false ? <span role="status">Un navigateur compatible WebGPU est nécessaire pour l’IA locale.</span> : <><button className="text-button" onClick={() => void start()} disabled={!hydrated || !supported}><Download size={14} />{cached ? 'Charger le modèle téléchargé' : messages.length ? 'Reprendre la discussion' : 'Activer la conversation'}</button><small>{cached ? 'Modèle conservé sur cet appareil' : cache?.modelId !== modelId ? 'Vérification du cache…' : `Premier téléchargement · ${modelId === models[1].id ? '≈ 2,5 Go' : '≈ 1 Go'}`}</small></>}</div>}
      {settingsOpen && <div ref={settingsPanel} id="discussion-settings" className="discussion-settings" role="dialog" aria-label="Réglages de discussion">
        <div className="discussion-settings-heading"><h3>Réglages</h3><button className="icon-button" aria-label="Fermer les réglages" onClick={() => setSettingsOpen(false)}><X size={16} /></button></div>
        <label htmlFor="conversation-model">Modèle IA<select id="conversation-model" value={modelId} disabled={state !== 'idle'} onChange={event => { setModelId(event.target.value); try { localStorage.setItem(mobile ? MOBILE_CONVERSATION_MODEL_KEY : 'kotoba-conversation-model', event.target.value); } catch { /* Keep selection for this session. */ } }}>{models.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}</select></label>
        <p>{selected.size}. Le cache est réutilisé lorsque le navigateur le conserve.</p>
        {mobile && <p>Le modèle léger est recommandé sur téléphone. Le modèle Qualité peut provoquer la fermeture de l’onglet par manque de mémoire.</p>}
        {state === 'ready' && <button className="text-button" disabled={busy} onClick={release}>Mettre le modèle en pause</button>}
        <div className="discussion-settings-tools">{displayTools}</div>
        <div className="discussion-settings-actions"><button className="text-button" disabled={busy || state !== 'ready' || !messages.length} onClick={() => { setSettingsOpen(false); void send('もっとやさしい日本語でお願いします。'); }}>Plus simple</button><button className="text-button" disabled={busy || state !== 'ready' || !messages.length} onClick={() => { setSettingsOpen(false); void send('やさしい日本語で説明してください。'); }}>Expliquer simplement</button></div>
        <p>Le niveau est guidé par tes acquis ; l’IA peut se tromper. L’historique est conservé uniquement sur cet appareil.</p>
        {messages.length > 0 && <button className="text-button" disabled={busy || state === 'loading'} onClick={() => setClearConfirm(value => !value)}><RotateCcw size={13} />Effacer l’historique</button>}
        {clearConfirm && <div className="discussion-clear"><span>Effacer les échanges sur cet appareil ?</span><button className="text-button" onClick={() => setClearConfirm(false)}>Annuler</button><button className="text-button" onClick={() => void clear()}>Effacer</button></div>}
      </div>}
      <JapaneseChatInput data={data} value={draft} onChange={setDraft} onSend={text => void send(text)} onSettings={() => setSettingsOpen(value => !value)} settingsOpen={settingsOpen} busy={busy} ready={state === 'ready'} onStop={() => { stopped.current = true; engine.current?.interruptGenerate(); }} />
    </div>
  </section>;
}
