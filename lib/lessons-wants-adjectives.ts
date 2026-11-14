import type { Lesson } from './lessons';

export const wantsAdjectiveLessons: Lesson[] = [
  {
    id: 'wants', category: 'Grammaire',
    title: 'Exprimer une envie', japanese: '〜たい・〜たくない',
    description: 'Dire ce que tu veux faire, ce que tu ne veux pas faire et demander une envie.',
    rule: [
      'たい exprime l’envie de faire une action. Pars du verbe à la forme en ます, retire ます et ajoute たい : 食べます devient 食べたい, « vouloir manger ». Ajoute です pour parler poliment.',
      'Pour dire « ne pas vouloir faire », remplace le い final de たい par くない : 食べたい devient 食べたくない. Ce n’est pas la même chose que 食べない, « ne pas manger ».',
      'Cette forme sert surtout à parler de tes propres envies ou à demander directement celles de ton interlocuteur. Le sujet « je » est souvent compris sans dire 私は.',
    ],
    steps: [
      'Trouve la forme en ます du verbe : 行く → 行きます.',
      'Retire ます : 行きます → 行き. Ne retire pas simplement la dernière syllabe du dictionnaire.',
      'Ajoute たい pour une envie, ou たくない pour l’absence d’envie : 行きたい / 行きたくない.',
      'Ajoute です pour la politesse et か pour une question : 行きたいですか。',
    ],
    patterns: [
      { label: 'Envie · poli', form: 'Base de ます ＋ たいです。', meaning: 'Je veux… / J’ai envie de…', note: 'Sans です, la forme est neutre ou familière : 食べたい.' },
      { label: 'Pas envie · poli', form: 'Base de ます ＋ たくないです。', meaning: 'Je ne veux pas… / Je n’ai pas envie de…', note: 'たい se conjugue comme un adjectif en い. N’ajoute pas じゃない après たい.' },
      { label: 'Poser une question', form: '何を食べたいですか。', meaning: 'Que voulez-vous manger ?', note: 'Une question directe sur l’envie de la personne à qui tu parles.' },
      { label: 'Deux particules possibles', form: '水を飲みたいです。／水が飲みたいです。', meaning: 'Je veux boire de l’eau.', note: 'Avec たい, を peut être conservé et が est aussi possible pour l’objet. Ce n’est pas un remplacement obligatoire.' },
    ],
    tables: [{
      title: 'De ます à l’envie', columns: ['Forme en ます', 'Vouloir', 'Ne pas vouloir'],
      rows: [
        [{ text: '食べます', reading: 'たべます' }, { text: '食べたい', reading: 'たべたい' }, { text: '食べたくない', reading: 'たべたくない' }],
        [{ text: '行きます', reading: 'いきます' }, { text: '行きたい', reading: 'いきたい' }, { text: '行きたくない', reading: 'いきたくない' }],
        [{ text: '飲みます', reading: 'のみます' }, { text: '飲みたい', reading: 'のみたい' }, { text: '飲みたくない', reading: 'のみたくない' }],
        [{ text: 'します' }, { text: 'したい' }, { text: 'したくない' }],
        [{ text: '来ます', reading: 'きます' }, { text: '来たい', reading: 'きたい' }, { text: '来たくない', reading: 'きたくない' }],
      ],
    }],
    examples: [
      { text: '日本に行きたいです。', reading: 'にほんにいきたいです。', translation: 'Je veux aller au Japon.' },
      { text: '今日はラーメンを食べたいです。', reading: 'きょうはらーめんをたべたいです。', translation: 'Aujourd’hui, j’ai envie de manger des ramen.' },
      { text: '何を飲みたいですか。', reading: 'なにをのみたいですか。', translation: 'Que voulez-vous boire ?' },
      { text: '今はコーヒーを飲みたくないです。', reading: 'いまはこーひーをのみたくないです。', translation: 'Pour le moment, je n’ai pas envie de boire du café.' },
      { text: '今日は勉強したくないです。', reading: 'きょうはべんきょうしたくないです。', translation: 'Aujourd’hui, je n’ai pas envie d’étudier.', note: 'する → します → したくない.' },
      { text: 'また来たいです。', reading: 'またきたいです。', translation: 'Je veux revenir.', note: 'Ici, 来 se lit き, comme dans 来ます.' },
    ],
    reminders: [
      { title: 'La base de ます', explanation: '行く donne 行きたい, pas 行くたい. Pour する, utilise したい ; pour 来る, utilise 来たい, lu きたい.' },
      { title: 'たい → たくない', explanation: 'La négation porte sur l’envie. 食べたくない signifie « ne pas vouloir manger », pas simplement « ne pas manger ». La forme たいじゃない est incorrecte ici.' },
      { title: 'Une action, pas un objet tout seul', explanation: 'たい se rattache à un verbe. Pour vouloir un objet, on emploie généralement 欲しい.', example: { text: '新しい本が欲しいです。', reading: 'あたらしいほんがほしいです。', translation: 'Je voudrais un nouveau livre.' } },
      { title: 'Les envies des autres', explanation: 'Évite d’affirmer une envie intérieure d’une autre personne sans contexte. Pour débuter, utilise たい pour toi et dans les questions adressées à ton interlocuteur.' },
    ],
    sources: [
      { title: 'Fondation du Japon · Grammaire Irodori', url: 'https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf' },
      { title: 'Fondation du Japon · Irodori, découverte, leçon 18', url: 'https://www.irodori.jpf.go.jp/assets/data/starter/pdf/X_L18_au.pdf' },
    ],
  },
  {
    id: 'negative-adjectives', category: 'Conjugaison',
    title: 'Les adjectifs à la forme négative', japanese: '〜くない・〜じゃない',
    description: 'Distinguer les adjectifs en い et en な pour dire « ce n’est pas… ».',
    rule: [
      'Les adjectifs japonais appartiennent à deux familles. Pour un adjectif en い, retire uniquement le い final et ajoute くないです : 高い → 高くないです, « ce n’est pas cher ».',
      'Pour un adjectif en な, garde la base et ajoute じゃないです : 静か → 静かじゃないです, « ce n’est pas calme ». Le な apparaît devant un nom, comme dans 静かな店 ; il ne reste pas devant じゃないです.',
      'Ces constructions décrivent ici quelque chose à la fin d’une phrase polie. Le です donne la politesse ; la négation se trouve dans くない ou じゃない.',
    ],
    steps: [
      'Identifie la famille de l’adjectif : en い ou en な. La dernière lettre seule ne suffit pas toujours.',
      'Adjectif en い : remplace le dernier い par くない, puis ajoute です.',
      'Adjectif en な : utilise la base, sans な ni です, puis ajoute じゃないです.',
      'Pour いい, retiens l’exception よくないです.',
    ],
    patterns: [
      { label: 'Adjectif en い', form: '高い → 高くないです。', meaning: 'Cher → ce n’est pas cher.', note: 'Base sans le い final + くないです. Même logique : 寒い → 寒くないです.' },
      { label: 'Adjectif en な', form: '静か → 静かじゃないです。', meaning: 'Calme → ce n’est pas calme.', note: 'Base de l’adjectif + じゃないです. Ne dis pas 静かなくない ni 静かなじゃない.' },
      { label: 'Exception fréquente', form: 'いい → よくないです。', meaning: 'Bien / bon → ce n’est pas bien / bon.', note: 'La négation utilise la base よ, pas い : いくない est incorrect.' },
      { label: 'Variantes plus formelles', form: '高くありません。／静かではありません。', meaning: 'Ce n’est pas cher. / Ce n’est pas calme.', note: 'くありません et ではありません sont des variantes polies. じゃないです reste très courant à l’oral.' },
    ],
    tables: [{
      title: 'Reconnaître les deux familles', columns: ['Famille', 'Adjectif', 'Négatif poli'],
      rows: [
        ['い · cher / haut', { text: '高い', reading: 'たかい' }, { text: '高くないです', reading: 'たかくないです' }],
        ['い · délicieux', { text: 'おいしい' }, { text: 'おいしくないです' }],
        ['い · grand', { text: '大きい', reading: 'おおきい' }, { text: '大きくないです', reading: 'おおきくないです' }],
        ['い · bon (exception)', { text: 'いい' }, { text: 'よくないです' }],
        ['な · calme', { text: '静か', reading: 'しずか' }, { text: '静かじゃないです', reading: 'しずかじゃないです' }],
        ['な · pratique', { text: '便利', reading: 'べんり' }, { text: '便利じゃないです', reading: 'べんりじゃないです' }],
        ['な · beau / propre', { text: 'きれい' }, { text: 'きれいじゃないです' }],
        ['な · célèbre', { text: '有名', reading: 'ゆうめい' }, { text: '有名じゃないです', reading: 'ゆうめいじゃないです' }],
      ],
    }],
    examples: [
      { text: 'この店は高くないです。', reading: 'このみせはたかくないです。', translation: 'Ce magasin n’est pas cher.' },
      { text: '今日は寒くないです。', reading: 'きょうはさむくないです。', translation: 'Aujourd’hui, il ne fait pas froid.' },
      { text: 'この部屋は大きくないです。', reading: 'このへやはおおきくないです。', translation: 'Cette pièce n’est pas grande.' },
      { text: 'このカフェは静かじゃないです。', reading: 'このかふぇはしずかじゃないです。', translation: 'Ce café n’est pas calme.' },
      { text: 'この駅は便利じゃないです。', reading: 'このえきはべんりじゃないです。', translation: 'Cette gare n’est pas pratique.' },
      { text: 'この部屋はきれいじゃないです。', reading: 'このへやはきれいじゃないです。', translation: 'Cette pièce n’est pas propre.', note: 'きれい est un adjectif en な : son い final reste en place.' },
      { text: '今日は天気がよくないです。', reading: 'きょうはてんきがよくないです。', translation: 'Aujourd’hui, il ne fait pas beau.', note: 'いい devient よくない, jamais いくない.' },
    ],
    reminders: [
      { title: 'Le dernier い seulement', explanation: 'おいしい devient おいしくない : le い à l’intérieur du mot reste. Ne retire que le dernier い.' },
      { title: 'きれい appartient aux adjectifs en な', explanation: 'On dit きれいな部屋 devant un nom, et きれいじゃないです au négatif. 嫌い, « ne pas aimer », est aussi de la famille な malgré son い final.' },
      { title: 'いい utilise よ', explanation: 'Retiens le couple いい / よくない. Le mot かっこいい suit la même logique : かっこよくない.' },
      { title: 'Pas cher ne veut pas forcément dire bon marché', explanation: 'Une négation nie une qualité sans affirmer automatiquement son contraire. 高くない dit « pas cher » ; 安い affirme « bon marché ».', example: { text: '悪くないです。', reading: 'わるくないです。', translation: 'Ce n’est pas mal.' } },
    ],
    sources: [
      { title: 'Fondation du Japon · Grammaire Irodori', url: 'https://www.irodori.jpf.go.jp/assets/data/Grammar_all.pdf' },
      { title: 'Fondation du Japon · Exercices de grammaire corrigés', url: 'https://www.irodori.jpf.go.jp/assets/data/resources/Grammar_Worksheets_Answer.pdf' },
    ],
  },
];
