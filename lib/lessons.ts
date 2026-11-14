export type JapaneseLine = { text: string; reading?: string };
export type Lesson = {
  id: 'comparisons' | 'obligation';
  category: 'Grammaire' | 'Conjugaison';
  title: string;
  japanese: string;
  description: string;
  rule: string[];
  steps: string[];
  patterns: { label: string; form: string; meaning: string; note?: string }[];
  tables?: { title: string; columns: string[]; rows: (string | JapaneseLine)[][] }[];
  examples: (JapaneseLine & { translation: string; note?: string })[];
  reminders: { title: string; explanation: string; example?: JapaneseLine & { translation: string } }[];
  sources: { title: string; url: string }[];
};

export const lessons: Lesson[] = [
  {
    id: 'comparisons',
    category: 'Grammaire',
    title: 'Faire des comparaisons',
    japanese: 'ほうが・より',
    description: 'Comparer deux choses, deux actions ou exprimer une préférence.',
    rule: [
      'より indique le point de comparaison : « que ». ほうが désigne ce qui est plus rapide, plus calme ou préféré. Le mot qui suit précise le critère de comparaison.',
      'Dans AのほうがBより…, on décrit A. Inverser l’ordre en BよりAのほうが… conserve le même sens.',
    ],
    steps: [
      'Choisis A, ce que tu veux décrire, et B, le point de comparaison.',
      'Avec des noms, ajoute のほうが après A et より après B.',
      'Ajoute l’adjectif ou l’expression de préférence, puis です pour une phrase polie.',
    ],
    patterns: [
      { label: 'Comparer des noms', form: 'A のほうが B より … です。', meaning: 'A est plus… que B.', note: 'Place の entre le nom et ほうが.' },
      { label: 'Un autre ordre possible', form: 'B より A のほうが … です。', meaning: 'La comparaison reste la même : A est plus… que B.' },
      { label: 'Comparer des actions', form: 'V₁ より V₂ ほうが … です。', meaning: 'Faire V₂ est plus… que faire V₁.', note: 'Utilise les verbes à la forme du dictionnaire, sans ajouter の après le verbe.' },
      { label: 'Demander lequel', form: 'A と B と、どちらのほうが … ですか。', meaning: 'Lequel est le plus… : A ou B ?', note: 'どっち est la variante plus familière de どちら.' },
    ],
    examples: [
      { text: '電車のほうがバスより速いです。', reading: 'でんしゃのほうがばすよりはやいです。', translation: 'Le train est plus rapide que le bus.', note: 'C’est le train qui est décrit comme plus rapide.' },
      { text: 'バスより電車のほうが速いです。', reading: 'ばすよりでんしゃのほうがはやいです。', translation: 'Le train est plus rapide que le bus.', note: 'L’ordre change, mais le sens reste identique.' },
      { text: 'この店のほうがあの店より静かです。', reading: 'このみせのほうがあのみせよりしずかです。', translation: 'Ce magasin est plus calme que celui-là.' },
      { text: '買うより借りるほうが安いです。', reading: 'かうよりかりるほうがやすいです。', translation: 'Louer coûte moins cher qu’acheter.', note: 'Les verbes sont à la forme du dictionnaire, sans の.' },
      { text: 'コーヒーとお茶と、どちらのほうが好きですか。', reading: 'こーひーとおちゃと、どちらのほうがすきですか。', translation: 'Que préférez-vous : le café ou le thé ?' },
      { text: 'お茶のほうが好きです。', reading: 'おちゃのほうがすきです。', translation: 'Je préfère le thé.', note: 'Le point de comparaison peut être omis si le contexte est clair.' },
    ],
    reminders: [
      { title: 'Repérer ほうが', explanation: 'L’élément suivi de ほうが est celui que décrit l’adjectif. Celui suivi de より sert de point de comparaison.' },
      { title: 'Un nom avec の, un verbe sans の', explanation: 'On dit 電車のほうが avec un nom, mais 借りるほうが avec un verbe à la forme du dictionnaire.' },
      { title: 'Ne pas confondre avec un conseil', explanation: 'Un verbe à la forme passée suivi de ほうがいい signifie « tu devrais ». C’est une autre construction.', example: { text: '早く寝たほうがいいです。', reading: 'はやくねたほうがいいです。', translation: 'Tu devrais te coucher tôt.' } },
    ],
    sources: [
      { title: 'Fondation du Japon · Grammaire Irodori', url: 'https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf' },
      { title: 'Fondation du Japon · Notes pédagogiques Marugoto', url: 'https://marugoto.jpf.go.jp/assets/docs/teacher/resource/pre_intermediate/preintermediate_teachers_notes.pdf' },
    ],
  },
  {
    id: 'obligation',
    category: 'Conjugaison',
    title: 'Devoir faire / être obligé de',
    japanese: '〜なければならない',
    description: 'Exprimer une obligation, de la forme polie aux contractions familières.',
    rule: [
      'Pour exprimer une obligation, pars de la forme en ない du verbe. Les constructions complètes expriment l’idée que ne pas faire l’action n’est pas acceptable.',
      'Ces formes courantes expriment toutes une obligation. La terminaison et le contexte déterminent le niveau de politesse.',
    ],
    steps: [
      'Mets le verbe à la forme négative simple, en ない.',
      'Remplace le ない final par une des terminaisons ci-dessous. Conserve tout ce qui précède ない.',
      'Choisis une terminaison polie, neutre ou contractée selon le contexte.',
    ],
    patterns: [
      { label: 'Forme complète · polie', form: 'V なければなりません', meaning: 'Devoir faire / être obligé de.', note: 'Forme neutre : なければならない. On rencontre aussi なければいけない / なければいけません.' },
      { label: 'Autre forme complète · polie', form: 'V なくてはいけません', meaning: 'Devoir faire / être obligé de.', note: 'Forme neutre : なくてはいけない. なくてはならない / なくてはなりません sont également possibles.' },
      { label: 'Courant à l’oral', form: 'V ないといけない', meaning: 'Devoir faire.', note: 'Forme polie : ないといけません. À l’oral familier, on peut s’arrêter à ないと si l’obligation est comprise.' },
      { label: 'Contraction familière', form: 'V なきゃ（いけない）', meaning: 'Il faut que je… / je dois…', note: 'なきゃ est la contraction de なければ. La fin peut être omise à l’oral familier ; なきゃならない est une autre forme complète.' },
      { label: 'Contraction familière', form: 'V なくちゃ（いけない）', meaning: 'Il faut que je… / je dois…', note: 'なくちゃ est la contraction de なくては. La fin peut être omise à l’oral familier ; なくちゃならない est une autre forme complète.' },
    ],
    tables: [
      {
        title: 'Construire à partir de la forme négative',
        columns: ['Dictionnaire', 'Négatif', 'Obligation · neutre'],
        rows: [
          [{ text: '食べる', reading: 'たべる' }, { text: '食べない', reading: 'たべない' }, { text: '食べなければならない', reading: 'たべなければならない' }],
          [{ text: '行く', reading: 'いく' }, { text: '行かない', reading: 'いかない' }, { text: '行かなければならない', reading: 'いかなければならない' }],
          [{ text: '買う', reading: 'かう' }, { text: '買わない', reading: 'かわない' }, { text: '買わなければならない', reading: 'かわなければならない' }],
          [{ text: 'する' }, { text: 'しない' }, { text: 'しなければならない' }],
          [{ text: '来る', reading: 'くる' }, { text: '来ない', reading: 'こない' }, { text: '来なければならない', reading: 'こなければならない' }],
        ],
      },
      {
        title: 'Politesse et formes passées',
        columns: ['Sens', 'Forme neutre', 'Forme polie'],
        rows: [
          ['Devoir y aller', { text: '行かなければならない', reading: 'いかなければならない' }, { text: '行かなければなりません', reading: 'いかなければなりません' }],
          ['Avoir dû y aller', { text: '行かなければならなかった', reading: 'いかなければならなかった' }, { text: '行かなければなりませんでした', reading: 'いかなければなりませんでした' }],
        ],
      },
    ],
    examples: [
      { text: '毎日、薬を飲まなければなりません。', reading: 'まいにち、くすりをのまなければなりません。', translation: 'Je dois prendre un médicament chaque jour.', note: 'Une forme complète et polie.' },
      { text: '明日は早く起きなくてはいけません。', reading: 'あしたははやくおきなくてはいけません。', translation: 'Demain, je dois me lever tôt.', note: 'L’indication de temps donne ici un sens futur à la forme non passée.' },
      { text: '宿題をしないといけない。', reading: 'しゅくだいをしないといけない。', translation: 'Je dois faire mes devoirs.' },
      { text: 'もう帰らなきゃ。', reading: 'もうかえらなきゃ。', translation: 'Je dois rentrer maintenant.', note: 'Forme familière : la fin いけない ou ならない est sous-entendue.' },
      { text: '部屋を掃除しなくちゃ。', reading: 'へやをそうじしなくちゃ。', translation: 'Je dois nettoyer ma chambre.' },
      { text: '昨日は働かなければなりませんでした。', reading: 'きのうははたらかなければなりませんでした。', translation: 'J’ai dû travailler hier.', note: 'Mets la terminaison au passé et conserve la base du verbe.' },
    ],
    reminders: [
      { title: 'Remplacer tout le ない', explanation: '食べない devient 食べなければならない. Retirer seulement い avant d’ajouter なければ répéterait な à tort.' },
      { title: 'La lecture de 来る change', explanation: 'くる devient こない : l’obligation commence donc par こなければ. Pour する, utilise しなければ.' },
      { title: 'Ne pas être obligé', explanation: 'なくてもいい lève l’obligation, sans interdire l’action.', example: { text: '明日は来なくてもいいです。', reading: 'あしたはこなくてもいいです。', translation: 'Vous n’avez pas besoin de venir demain.' } },
      { title: 'Ne pas avoir le droit', explanation: 'てはいけない exprime une interdiction. Il ne signifie pas « ne pas être obligé ».', example: { text: 'ここで写真を撮ってはいけません。', reading: 'ここでしゃしんをとってはいけません。', translation: 'Il est interdit de prendre des photos ici.' } },
    ],
    sources: [
      { title: 'Fondation du Japon · Irodori, leçon 10', url: 'https://www.irodori.jpf.go.jp/assets/data/elementary02/pdf/Z_L10.pdf' },
      { title: 'Fondation du Japon · Grammaire Irodori', url: 'https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf' },
    ],
  },
];

export type LessonId = Lesson['id'];
export const isLessonId = (value: unknown): value is LessonId => lessons.some(lesson => lesson.id === value);
