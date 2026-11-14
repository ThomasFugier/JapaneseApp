import type { LessonImmersion } from './lesson-immersion';

export const wantsAdjectiveImmersions: Record<'wants' | 'negative-adjectives', LessonImmersion> = {
  wants: {
    kind: 'dialogue', title: 'Une pause à Kyoto',
    setting: 'Aoi et Ren décident quoi faire après une promenade. Chacun exprime ses envies.',
    lines: [
      { speaker: 'Aoi', text: '少し休みたいです。カフェに行きたいですか。', reading: 'すこしやすみたいです。かふぇにいきたいですか。', translation: 'J’ai envie de me reposer un peu. Tu veux aller dans un café ?', focus: '休みたいです', note: '休みます → 休みたいです : l’envie de se reposer.' },
      { speaker: 'Ren', text: 'はい、行きたいです。何を飲みたいですか。', reading: 'はい、いきたいです。なにをのみたいですか。', translation: 'Oui, j’en ai envie. Que veux-tu boire ?', focus: '飲みたいですか', note: 'Le か final transforme l’envie en question.' },
      { speaker: 'Aoi', text: 'お茶を飲みたいです。今はコーヒーを飲みたくないです。', reading: 'おちゃをのみたいです。いまはこーひーをのみたくないです。', translation: 'J’ai envie de boire du thé. Pour le moment, je n’ai pas envie de café.', focus: '飲みたい・飲みたくない', note: 'La même base 飲み reçoit たい ou たくない selon l’envie.' },
      { speaker: 'Ren', text: '私はコーヒーが飲みたいです。ケーキも食べたいです。', reading: 'わたしはこーひーがのみたいです。けーきもたべたいです。', translation: 'Moi, je veux boire du café. J’ai aussi envie de manger du gâteau.', focus: 'コーヒーが飲みたい', note: 'が peut marquer l’objet avec たい. を reste également possible.' },
      { speaker: 'Aoi', text: '私は今、ケーキを食べたくないです。でも、この店で休みたいです。', reading: 'わたしはいま、けーきをたべたくないです。でも、このみせでやすみたいです。', translation: 'Moi, je n’ai pas envie de gâteau maintenant. Mais j’aimerais me reposer dans ce café.', focus: '食べたくないです', note: 'On exprime une absence d’envie, pas une interdiction.' },
      { speaker: 'Ren', text: 'いいですね。ここで少し話したいです。', reading: 'いいですね。ここですこしはなしたいです。', translation: 'Bonne idée. J’aimerais discuter un peu ici.', focus: '話したいです', note: '話します → 話したいです : vouloir parler.' },
      { speaker: 'Aoi', text: 'この店は静かですね。また来たいです。', reading: 'このみせはしずかですね。またきたいです。', translation: 'Ce café est calme. J’ai envie d’y revenir.', focus: '来たいです', note: '来ます se lit きます : 来たい se lit donc きたい.' },
    ],
    takeaway: 'Repère la base du verbe : たい exprime une envie ; たくない exprime l’absence d’envie. Avec ですか, on interroge directement son interlocuteur.',
  },
  'negative-adjectives': {
    kind: 'story', title: 'À la recherche d’un café',
    setting: 'Mika se promène à Kyoto et compare deux cafés. Ses impressions utilisent les deux familles d’adjectifs.',
    lines: [
      { text: '今日は寒くないです。京都の町を歩きます。', reading: 'きょうはさむくないです。きょうとのまちをあるきます。', translation: 'Aujourd’hui, il ne fait pas froid. Je me promène dans les rues de Kyoto.', focus: '寒くないです', note: '寒い est un adjectif en い : 寒い → 寒くない.' },
      { text: '駅の前にカフェがあります。この店は高くないです。', reading: 'えきのまえにかふぇがあります。このみせはたかくないです。', translation: 'Il y a un café devant la gare. Il n’est pas cher.', focus: '高くないです', note: 'On remplace le い final de 高い par くない.' },
      { text: 'でも、店の中は静かじゃないです。別の店に行きます。', reading: 'でも、みせのなかはしずかじゃないです。べつのみせにいきます。', translation: 'Mais l’intérieur n’est pas calme. Je vais dans un autre café.', focus: '静かじゃないです', note: '静か est de la famille な : base + じゃないです.' },
      { text: '近くに小さい店があります。有名じゃないですが、きれいです。', reading: 'ちかくにちいさいみせがあります。ゆうめいじゃないですが、きれいです。', translation: 'Il y a un petit café à proximité. Il n’est pas célèbre, mais il est propre.', focus: '有名じゃないです', note: '有名 est un adjectif en な. きれい, ici à l’affirmatif, appartient aussi à cette famille.' },
      { text: 'この店のコーヒーは苦くないです。おいしいです。', reading: 'このみせのこーひーはにがくないです。おいしいです。', translation: 'Le café servi ici n’est pas amer. Il est bon.', focus: '苦くないです', note: '苦い → 苦くない : encore un adjectif en い.' },
      { text: '天気はよくないです。でも、この店は悪くないです。ここで少し休みます。', reading: 'てんきはよくないです。でも、このみせはわるくないです。ここですこしやすみます。', translation: 'Il ne fait pas beau. Mais ce café n’est pas mal. Je me repose un peu ici.', focus: 'よくない・悪くない', note: 'いい donne l’irrégulier よくない. 悪い suit la règle habituelle : 悪くない.' },
    ],
    takeaway: 'Adjectifs en い : い → くない. Adjectifs en な : base + じゃない. Retiens l’exception いい → よくない.',
  },
};
