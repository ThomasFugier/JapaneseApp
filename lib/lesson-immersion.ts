import type { LessonId } from './lessons';

export type ImmersionLine = {
  speaker?: string;
  text: string;
  reading: string;
  translation: string;
  focus?: string;
  note?: string;
};

export type LessonImmersion = {
  kind: 'dialogue' | 'story';
  title: string;
  setting: string;
  lines: ImmersionLine[];
  takeaway: string;
};

export const lessonImmersions: Record<LessonId, LessonImmersion> = {
  comparisons: {
    kind: 'dialogue',
    title: 'Un rendez-vous pour demain',
    setting: 'Aoi et Ren organisent leur sortie par messages : le trajet, le café, puis les boissons.',
    lines: [
      {
        speaker: 'Aoi',
        text: '明日、駅で会いませんか。',
        reading: 'あした、えきであいませんか。',
        translation: 'Et si on se retrouvait à la gare demain ?',
      },
      {
        speaker: 'Ren',
        text: 'いいですね。電車とバスと、どちらのほうが速いですか。',
        reading: 'いいですね。でんしゃとばすと、どちらのほうがはやいですか。',
        translation: 'Bonne idée. Lequel est le plus rapide : le train ou le bus ?',
        focus: 'どちらのほうが',
        note: 'どちらのほうが permet de demander lequel des deux est le plus rapide.',
      },
      {
        speaker: 'Aoi',
        text: '電車のほうがバスより速いです。',
        reading: 'でんしゃのほうがばすよりはやいです。',
        translation: 'Le train est plus rapide que le bus.',
        focus: 'のほうが',
        note: '電車のほうが désigne le train, décrit comme plus rapide. バスより donne le point de comparaison.',
      },
      {
        speaker: 'Ren',
        text: 'じゃあ、電車で行きます。駅の近くでお茶を飲みませんか。',
        reading: 'じゃあ、でんしゃでいきます。えきのちかくでおちゃをのみませんか。',
        translation: 'Alors, je prendrai le train. On prend un thé près de la gare ?',
      },
      {
        speaker: 'Aoi',
        text: 'いいですね。この店のほうがあの店より静かです。',
        reading: 'いいですね。このみせのほうがあのみせよりしずかです。',
        translation: 'Bonne idée. Ce café-ci est plus calme que celui-là.',
        focus: 'のほうが',
        note: 'La même construction sert à comparer le calme de deux établissements.',
      },
      {
        speaker: 'Ren',
        text: 'では、この店にしましょう。コーヒーとお茶と、どちらのほうが好きですか。',
        reading: 'では、このみせにしましょう。こーひーとおちゃと、どちらのほうがすきですか。',
        translation: 'Choisissons celui-ci. Que préférez-vous : le café ou le thé ?',
        focus: 'どちらのほうが',
        note: 'Avec 好き, la question porte sur une préférence.',
      },
      {
        speaker: 'Aoi',
        text: 'コーヒーよりお茶のほうが好きです。',
        reading: 'こーひーよりおちゃのほうがすきです。',
        translation: 'Je préfère le thé au café.',
        focus: 'より',
        note: 'Le point de comparaison vient ici en premier. お茶のほうが reste ce qui est préféré.',
      },
      {
        speaker: 'Ren',
        text: '私もお茶のほうが好きです。明日が楽しみです。',
        reading: 'わたしもおちゃのほうがすきです。あしたがたのしみです。',
        translation: 'Moi aussi, je préfère le thé. Vivement demain !',
        focus: 'のほうが',
        note: 'より peut disparaître : le café est déjà connu comme point de comparaison.',
      },
    ],
    takeaway: 'Repère ce qui précède ほうが : c’est l’élément décrit ou préféré. より indique à quoi on le compare.',
  },
  obligation: {
    kind: 'story',
    title: 'La veille du départ',
    setting: 'Mika prépare un petit voyage. Son récit est poli ; ses pensées, entre guillemets, sont familières.',
    lines: [
      {
        text: '明日は旅行です。朝六時に起きなければなりません。',
        reading: 'あしたはりょこうです。あさろくじにおきなければなりません。',
        translation: 'Demain, je pars en voyage. Je dois me lever à six heures du matin.',
        focus: 'なければなりません',
        note: '起きない devient 起きなければなりません : une obligation exprimée poliment.',
      },
      {
        text: '今夜、荷物を準備しなくてはいけません。',
        reading: 'こんや、にもつをじゅんびしなくてはいけません。',
        translation: 'Ce soir, je dois préparer mes bagages.',
        focus: 'なくてはいけません',
        note: 'なくてはいけません est une autre manière polie d’exprimer la même obligation.',
      },
      {
        text: '切符も買わないといけません。',
        reading: 'きっぷもかわないといけません。',
        translation: 'Je dois aussi acheter un billet.',
        focus: 'ないといけません',
        note: '買う devient 買わない. On ajoute といけません à cette forme négative.',
      },
      {
        text: '時計を見ます。「もう九時。早く準備しなきゃ。」',
        reading: 'とけいをみます。「もうくじ。はやくじゅんびしなきゃ。」',
        translation: 'Je regarde l’heure. « Déjà neuf heures. Il faut que je me dépêche de préparer mes affaires. »',
        focus: 'なきゃ',
        note: 'Dans sa pensée, Mika emploie なきゃ, contraction familière de なければ. La fin de l’obligation est sous-entendue.',
      },
      {
        text: '荷物の準備ができました。「お弁当も作らなくちゃ。」',
        reading: 'にもつのじゅんびができました。「おべんとうもつくらなくちゃ。」',
        translation: 'Mes bagages sont prêts. « Je dois aussi préparer mon repas à emporter. »',
        focus: 'なくちゃ',
        note: 'なくちゃ est la contraction familière de なくては. Ici aussi, la fin est omise.',
      },
      {
        text: '準備が終わりました。「もう寝ないと。」明日が楽しみです。',
        reading: 'じゅんびがおわりました。「もうねないと。」あしたがたのしみです。',
        translation: 'Les préparatifs sont terminés. « Maintenant, il faut que je dorme. » Vivement demain !',
        focus: 'ないと',
        note: '寝ないと abrège 寝ないといけない. Le contexte rend l’obligation claire.',
      },
    ],
    takeaway: 'Les formes complètes et les contractions expriment ici le même besoin d’agir. Le registre change entre le récit poli et les pensées familières.',
  },
};
