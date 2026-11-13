export type JapaneseLine = { text: string; reading?: string };
export type Lesson = {
  id: 'comparisons' | 'obligation';
  category: 'Grammar' | 'Conjugation';
  title: string;
  japanese: string;
  description: string;
  rule: string[];
  steps: string[];
  patterns: { label: string; form: string; meaning: string; note?: string }[];
  tables?: { title: string; columns: string[]; rows: (string | JapaneseLine)[][] }[];
  examples: (JapaneseLine & { english: string; note?: string })[];
  reminders: { title: string; explanation: string; example?: JapaneseLine & { english: string } }[];
  sources: { title: string; url: string }[];
};

export const lessons: Lesson[] = [
  {
    id: 'comparisons',
    category: 'Grammar',
    title: 'Making comparisons',
    japanese: 'ほうが・より',
    description: 'Compare two things, actions or preferences.',
    rule: [
      'より marks the reference point: “than”. ほうが marks the side described as more, faster, quieter, or better liked. The adjective tells you what is being compared.',
      'In AのほうがBより…, you are describing A. Changing the order to BよりAのほうが… keeps the same meaning.',
    ],
    steps: [
      'Choose A, the thing you want to describe, and B, the reference point.',
      'For nouns, attach のほうが to A and より to B.',
      'Add the adjective or preference, then です for a polite sentence.',
    ],
    patterns: [
      { label: 'Compare nouns', form: 'A のほうが B より … です。', meaning: 'A is more … than B.', note: 'Use の between a noun and ほうが.' },
      { label: 'Another word order', form: 'B より A のほうが … です。', meaning: 'The same comparison: A is more … than B.' },
      { label: 'Compare actions', form: 'V₁ より V₂ ほうが … です。', meaning: 'Doing V₂ is more … than doing V₁.', note: 'Use dictionary-form verbs. Do not add の after the verb.' },
      { label: 'Ask which one', form: 'A と B と、どちらのほうが … ですか。', meaning: 'Which is more …, A or B?', note: 'どっち is the more casual alternative to どちら.' },
    ],
    examples: [
      { text: '電車のほうがバスより速いです。', reading: 'でんしゃのほうがばすよりはやいです。', english: 'The train is faster than the bus.', note: 'The train is the side described as faster.' },
      { text: 'バスより電車のほうが速いです。', reading: 'ばすよりでんしゃのほうがはやいです。', english: 'The train is faster than the bus.', note: 'The order changes; the meaning stays the same.' },
      { text: 'この店のほうがあの店より静かです。', reading: 'このみせのほうがあのみせよりしずかです。', english: 'This shop is quieter than that shop.' },
      { text: '買うより借りるほうが安いです。', reading: 'かうよりかりるほうがやすいです。', english: 'Renting is cheaper than buying.', note: 'Dictionary-form verbs, without の.' },
      { text: 'コーヒーとお茶と、どちらのほうが好きですか。', reading: 'こーひーとおちゃと、どちらのほうがすきですか。', english: 'Which do you prefer, coffee or tea?' },
      { text: 'お茶のほうが好きです。', reading: 'おちゃのほうがすきです。', english: 'I prefer tea.', note: 'You can leave out the comparison point when it is already clear.' },
    ],
    reminders: [
      { title: 'Follow ほうが', explanation: 'The side with ほうが is the one described by the adjective. The side with より is the reference point.' },
      { title: 'Noun + の; verb without の', explanation: 'Use 電車のほうが with a noun, but 借りるほうが with a dictionary-form verb.' },
      { title: 'Advice is a different pattern', explanation: 'A past-form verb followed by ほうがいい means “you should”. Keep it separate from a simple comparison.', example: { text: '早く寝たほうがいいです。', reading: 'はやくねたほうがいいです。', english: 'You should go to bed early.' } },
    ],
    sources: [
      { title: 'Japan Foundation · Irodori grammar reference', url: 'https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf' },
      { title: 'Japan Foundation · Marugoto teacher notes', url: 'https://marugoto.jpf.go.jp/assets/docs/teacher/resource/pre_intermediate/preintermediate_teachers_notes.pdf' },
    ],
  },
  {
    id: 'obligation',
    category: 'Conjugation',
    title: 'Must / have to',
    japanese: '〜なければならない',
    description: 'Express obligation, from polite forms to casual speech.',
    rule: [
      'To say you must do something, start from the verb’s ない form. The full patterns express the idea that not doing it is not acceptable.',
      'The obligation stays the same across these common forms. The ending and the situation determine how polite or casual the sentence sounds.',
    ],
    steps: [
      'Make the plain negative form of the verb: the ない form.',
      'Replace the final ない with an ending below. Keep everything before ない.',
      'Choose a polite, plain or contracted ending for the situation.',
    ],
    patterns: [
      { label: 'Full form · polite', form: 'V なければなりません', meaning: 'Must / have to.', note: 'Plain: なければならない. You will also encounter なければいけない / なければいけません.' },
      { label: 'Another full form · polite', form: 'V なくてはいけません', meaning: 'Must / have to.', note: 'Plain: なくてはいけない. なくてはならない / なくてはなりません are also possible.' },
      { label: 'Common in conversation', form: 'V ないといけない', meaning: 'Have to.', note: 'Polite: ないといけません. In casual speech, the sentence may end at ないと when the obligation is understood.' },
      { label: 'Casual contraction', form: 'V なきゃ（いけない）', meaning: 'Gotta / have to.', note: 'なきゃ contracts なければ. The ending can be left out in casual speech; なきゃならない is another complete form.' },
      { label: 'Casual contraction', form: 'V なくちゃ（いけない）', meaning: 'Gotta / have to.', note: 'なくちゃ contracts なくては. The ending can be left out in casual speech; なくちゃならない is another complete form.' },
    ],
    tables: [
      {
        title: 'Build from the negative form',
        columns: ['Dictionary', 'Negative', 'Must · plain'],
        rows: [
          [{ text: '食べる', reading: 'たべる' }, { text: '食べない', reading: 'たべない' }, { text: '食べなければならない', reading: 'たべなければならない' }],
          [{ text: '行く', reading: 'いく' }, { text: '行かない', reading: 'いかない' }, { text: '行かなければならない', reading: 'いかなければならない' }],
          [{ text: '買う', reading: 'かう' }, { text: '買わない', reading: 'かわない' }, { text: '買わなければならない', reading: 'かわなければならない' }],
          [{ text: 'する' }, { text: 'しない' }, { text: 'しなければならない' }],
          [{ text: '来る', reading: 'くる' }, { text: '来ない', reading: 'こない' }, { text: '来なければならない', reading: 'こなければならない' }],
        ],
      },
      {
        title: 'Politeness and past forms',
        columns: ['Meaning', 'Plain', 'Polite'],
        rows: [
          ['Have to go', { text: '行かなければならない', reading: 'いかなければならない' }, { text: '行かなければなりません', reading: 'いかなければなりません' }],
          ['Had to go', { text: '行かなければならなかった', reading: 'いかなければならなかった' }, { text: '行かなければなりませんでした', reading: 'いかなければなりませんでした' }],
        ],
      },
    ],
    examples: [
      { text: '毎日、薬を飲まなければなりません。', reading: 'まいにち、くすりをのまなければなりません。', english: 'I have to take medicine every day.', note: 'A full polite form.' },
      { text: '明日は早く起きなくてはいけません。', reading: 'あしたははやくおきなくてはいけません。', english: 'I have to get up early tomorrow.', note: 'The time word gives this non-past sentence a future meaning.' },
      { text: '宿題をしないといけない。', reading: 'しゅくだいをしないといけない。', english: 'I have to do my homework.' },
      { text: 'もう帰らなきゃ。', reading: 'もうかえらなきゃ。', english: 'I have to head home now.', note: 'Casual; the final いけない or ならない is understood.' },
      { text: '部屋を掃除しなくちゃ。', reading: 'へやをそうじしなくちゃ。', english: 'I have to clean my room.' },
      { text: '昨日は働かなければなりませんでした。', reading: 'きのうははたらかなければなりませんでした。', english: 'I had to work yesterday.', note: 'Put the ending into the past; keep the verb stem unchanged.' },
    ],
    reminders: [
      { title: 'Replace the whole ない', explanation: '食べない becomes 食べなければならない. Replacing only い and then adding なければ would incorrectly repeat な.' },
      { title: '来る changes its reading', explanation: 'くる becomes こない, so the obligation starts with こなければ. For する, use しなければ.' },
      { title: '“Don’t have to” is permission to skip', explanation: 'なくてもいい removes the obligation. It does not forbid the action.', example: { text: '明日は来なくてもいいです。', reading: 'あしたはこなくてもいいです。', english: 'You do not have to come tomorrow.' } },
      { title: '“Must not” is a prohibition', explanation: 'てはいけない forbids an action. It is different from not having to do it.', example: { text: 'ここで写真を撮ってはいけません。', reading: 'ここでしゃしんをとってはいけません。', english: 'You must not take photos here.' } },
    ],
    sources: [
      { title: 'Japan Foundation · Irodori, Lesson 10', url: 'https://www.irodori.jpf.go.jp/assets/data/elementary02/pdf/Z_L10.pdf' },
      { title: 'Japan Foundation · Irodori grammar reference', url: 'https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf' },
    ],
  },
];

export type LessonId = Lesson['id'];
export const isLessonId = (value: unknown): value is LessonId => lessons.some(lesson => lesson.id === value);
