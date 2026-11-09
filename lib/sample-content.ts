import type { Deck, Note, Snapshot, StudyCard } from './model';
import legacy from './legacy-sample-content.json';

const updatedAt = '2026-11-01T00:00:00.000Z';
const translatedAt = '2026-11-09T00:00:00.000Z';

export function sampleContent(): Pick<Snapshot, 'decks' | 'notes' | 'cards'> {
  const deck = (id: string, name: string, description: string, parentId: string | null, color: Deck['color']): Deck => ({ id, name, description, parentId, color, updatedAt });
  const decks: Deck[] = [
    deck("japonais", "Japanese", "", null, "sage"),
    deck("vocabulaire", "Vocabulary", "", "japonais", "sage"),
    deck("verbes", "Verbs", "", "vocabulaire", "sage"),
    deck("travail", "Work & study", "", "verbes", "sky"),
    deck("quotidien", "Everyday life", "", "vocabulaire", "amber"),
    deck("cuisine", "Food & drink", "", "vocabulaire", "rose"),
    deck("grammaire", "Grammar", "", "japonais", "sky"),
    deck("kanjis", "Kanji", "", "japonais", "amber"),
  ];
  type Entry = [string, string, string, string, string, string, string, string[], string[]];
  const entries: Entry[] = [
    ["taberu","食べる","たべる","to eat","毎朝、パンを食べます。","I eat bread every morning.","Ichidan verb. Polite form: 食べます（たべます）.",["cuisine","quotidien","verbes"],["verb","JLPT N5"]],
    ["ringo","林檎","りんご","apple","りんごを食べます。","I eat an apple.","林檎 is read りんご. The hiragana spelling りんご is also common.",["cuisine","quotidien"],["noun","JLPT N5"]],
    ["nomu","飲む","のむ","to drink","水を飲みます。","I drink water.","Godan verb ending in む. Polite form: 飲みます（のみます）.",["cuisine","quotidien","verbes"],["verb","JLPT N5"]],
    ["tsukuru","作る","つくる","to make; to prepare","晩ご飯を作ります。","I make dinner.","Godan verb used for making objects, meals, or other creations.",["cuisine","travail","verbes"],["verb","JLPT N5"]],
    ["hataraku","働く","はたらく","to work","図書館で働いています。","I work at a library.","Godan verb. 働いています describes working at a job here.",["travail"],["verb","JLPT N5"]],
    ["hajimeru","始める","はじめる","to start something","仕事を始めます。","I start work.","Transitive ichidan verb. Compare 始まる, which means to begin without a direct object.",["travail"],["verb","JLPT N4"]],
    ["owaru","終わる","おわる","to end; to finish","会議は三時に終わります。","The meeting ends at three.","Godan verb. The subject is the thing that ends.",["travail"],["verb","JLPT N5"]],
    ["hanasu","話す","はなす","to speak","日本語で話します。","I speak Japanese.","Godan verb ending in す. Polite form: 話します（はなします）.",["quotidien","travail"],["verb","JLPT N5"]],
    ["kaku","書く","かく","to write","名前を書いてください。","Please write your name.","Godan verb. Te-form: 書いて（かいて）.",["travail"],["verb","JLPT N5"]],
    ["yomu","読む","よむ","to read","毎晩、本を読みます。","I read a book every evening.","Godan verb. Polite form: 読みます（よみます）.",["quotidien","travail"],["verb","JLPT N5"]],
    ["iku","行く","いく","to go","明日、学校に行きます。","I am going to school tomorrow.","Godan verb with an irregular te-form: 行って（いって）.",["quotidien","verbes"],["verb","JLPT N5"]],
    ["kaeru","帰る","かえる","to return home","六時に家に帰ります。","I return home at six.","帰る is a godan verb despite ending in える.",["quotidien","verbes"],["verb","JLPT N5"]],
    ["miru","見る","みる","to see; to watch","映画を見ます。","I watch a movie.","Ichidan verb. Polite form: 見ます（みます）.",["quotidien","verbes"],["verb","JLPT N5"]],
    ["neru","寝る","ねる","to sleep; to go to bed","十一時に寝ます。","I go to bed at eleven.","Ichidan verb. Polite form: 寝ます（ねます）.",["quotidien","verbes"],["verb","JLPT N5"]],
    ["okiru","起きる","おきる","to wake up; to get up","毎朝、七時に起きます。","I get up at seven every morning.","Ichidan verb. Polite form: 起きます（おきます）.",["quotidien","verbes"],["verb","JLPT N5"]],
    ["mizu","水","みず","water","水をください。","Water, please.","Noun. Hot water is お湯（おゆ）.",["cuisine","quotidien"],["noun","JLPT N5"]],
    ["gohan","ご飯","ごはん","cooked rice; meal","ご飯を食べましょう。","Let's eat.","ご飯 can mean cooked rice or a meal, depending on context.",["cuisine"],["noun","JLPT N5"]],
    ["ocha","お茶","おちゃ","tea","温かいお茶を飲みます。","I drink warm tea.","お is a common polite prefix here.",["cuisine"],["noun","JLPT N5"]],
    ["oishii","おいしい","おいしい","delicious; tasty","このパンはおいしいです。","This bread is delicious.","I-adjective. Negative form: おいしくない.",["cuisine"],["adjective","JLPT N5"]],
    ["hon","本","ほん","book","この本はおもしろいです。","This book is interesting.","Noun. 本 is also a counter for long objects, with different readings.",["quotidien"],["noun","JLPT N5"]],
    ["shigoto","仕事","しごと","work; job","今日は仕事があります。","I have work today.","仕事をする means to work or do your job.",["travail"],["noun","JLPT N5"]],
    ["kaigi","会議","かいぎ","meeting","午後に会議があります。","There is a meeting this afternoon.","会議室（かいぎしつ） means meeting room.",["travail"],["noun","JLPT N4"]],
    ["ashita","明日","あした","tomorrow","明日は休みです。","Tomorrow is a day off.","あした is the usual reading. あす is also used.",["quotidien"],["time","JLPT N5"]],
    ["particle-wa","〜は","わ","topic particle","私は学生です。","I am a student.","は marks the topic: as for something. It is written は but pronounced わ.",["grammaire"],["particle","JLPT N5"]],
    ["particle-o","〜を","お","direct object particle","本を読みます。","I read a book.","を marks the direct object of many action verbs.",["grammaire"],["particle","JLPT N5"]],
    ["tai","〜たい","たい","to want to do something","日本に行きたいです。","I want to go to Japan.","Add たい to the verb stem before ます: 行きます → 行きたい.",["grammaire"],["pattern","JLPT N5"]],
    ["kanji-hi","日","ひ・にち・じつ","day; sun","日曜日は休みです。","Sunday is a day off.","Readings depend on the word: 日（ひ）, 日本（にほん）, 休日（きゅうじつ）. 日曜日 is read にちようび.",["kanjis"],["kanji","JLPT N5"]],
    ["kanji-yama","山","やま・さん","mountain","山が見えます。","I can see a mountain.","Kun reading: やま. A common on reading is さん, as in 富士山（ふじさん）.",["kanjis"],["kanji","JLPT N5"]],
    ["kanji-hito","人","ひと・じん・にん","person","あの人は先生です。","That person is a teacher.","人（ひと）, 日本人（にほんじん）, 三人（さんにん）. The reading depends on the word.",["kanjis"],["kanji","JLPT N5"]],
  ];
  const notes: Note[] = [];
  const cards: StudyCard[] = [];
  for (const [id, japanese, reading, meaning, example, exampleTranslation, explanation, deckIds, tags] of entries) {
    notes.push({ id: `note-${id}`, japanese, reading, meaning, example, exampleTranslation, explanation, tags, updatedAt });
    cards.push({ id: `card-${id}`, noteId: `note-${id}`, direction: 'ja-fr', deckIds, updatedAt });
  }
  return { decks, notes, cards };
}

// Translate only known French sample values; user edits and scheduling records stay intact.
export function migrateSampleLanguage(data: Snapshot): void {
  const english = sampleContent();
  const notes = new Map(english.notes.map(note => [note.id, note]));
  const decks = new Map(english.decks.map(deck => [deck.id, deck]));
  const legacyNotes = new Map(legacy.notes.map(note => [note.id, note]));
  const legacyDecks = new Map(legacy.decks.map(deck => [deck.id, deck]));
  for (const note of data.notes) {
    const before = legacyNotes.get(note.id), after = notes.get(note.id);
    if (note.deletedAt || !before || !after || note.japanese !== before.japanese) continue;
    let changed = false;
    for (const field of ['reading', 'meaning', 'exampleTranslation', 'explanation'] as const) {
      if (note[field] === before[field] && note[field] !== after[field]) { note[field] = after[field]; changed = true; }
    }
    const tags = note.tags.map(tag => { const index = before.tags.indexOf(tag); return index < 0 ? tag : after.tags[index]; });
    if (JSON.stringify(tags) !== JSON.stringify(note.tags)) { note.tags = [...new Set(tags)]; changed = true; }
    if (changed) note.updatedAt = new Date(Math.max(Date.parse(note.updatedAt), Date.parse(translatedAt))).toISOString();
  }
  for (const deck of data.decks) {
    const before = legacyDecks.get(deck.id), after = decks.get(deck.id);
    if (deck.deletedAt || !before || !after) continue;
    let changed = false;
    for (const field of ['name', 'description'] as const) {
      if (deck[field] === before[field] && deck[field] !== after[field]) { deck[field] = after[field]; changed = true; }
    }
    if (changed) deck.updatedAt = new Date(Math.max(Date.parse(deck.updatedAt), Date.parse(translatedAt))).toISOString();
  }
}
