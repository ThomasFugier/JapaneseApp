import { emptySnapshot, type Deck, type Note, type Snapshot, type StudyCard } from './model';

const updatedAt = '2026-11-01T00:00:00.000Z';

export function seedSnapshot(): Snapshot {
  const deck = (id: string, name: string, description: string, parentId: string | null, color: Deck['color']): Deck => ({ id, name, description, parentId, color, updatedAt });
  const decks: Deck[] = [
    deck('japonais', 'Japonais', 'Un petit pas chaque jour, un nouvel horizon.', null, 'sage'),
    deck('vocabulaire', 'Vocabulaire', 'Les mots qui donnent vie à vos idées.', 'japonais', 'sage'),
    deck('verbes', 'Verbes', 'Exprimer ce que vous faites, pensez et ressentez.', 'vocabulaire', 'sage'),
    deck('travail', 'Travail', 'Les verbes utiles au bureau et dans vos projets.', 'verbes', 'sky'),
    deck('quotidien', 'Quotidien', 'Les mots des petits moments de tous les jours.', 'vocabulaire', 'amber'),
    deck('cuisine', 'Cuisine', 'À table, aux fourneaux et au restaurant.', 'vocabulaire', 'rose'),
    deck('grammaire', 'Grammaire', 'Des structures simples pour construire vos phrases.', 'japonais', 'sky'),
    deck('kanjis', 'Kanjis', 'Lire les caractères, comprendre leurs nuances.', 'japonais', 'amber'),
  ];
  type Entry = [string, string, string, string, string, string, string, string[], string[]];
  const entries: Entry[] = [
    ['taberu', '食べる', 'たべる', 'Manger', '毎朝、パンを食べます。', 'Tous les matins, je mange du pain.', 'Verbe ichidan. Forme polie : 食べます（たべます）.', ['verbes', 'quotidien', 'cuisine'], ['verbe', 'JLPT N5']],
    ['ringo', '林檎', 'りんご', 'Pomme', 'りんごを食べます。', 'Je mange une pomme.', '林檎 se lit りんご. La graphie en hiragana りんご est aussi très courante.', ['cuisine', 'quotidien'], ['nom', 'JLPT N5']],
    ['nomu', '飲む', 'のむ', 'Boire', '水を飲みます。', 'Je bois de l’eau.', 'Verbe godan en む. Forme polie : 飲みます（のみます）.', ['verbes', 'quotidien', 'cuisine'], ['verbe', 'JLPT N5']],
    ['tsukuru', '作る', 'つくる', 'Faire, fabriquer, préparer', '晩ご飯を作ります。', 'Je prépare le dîner.', 'Verbe godan. S’utilise pour un objet, un plat ou une création.', ['verbes', 'cuisine', 'travail'], ['verbe', 'JLPT N5']],
    ['hataraku', '働く', 'はたらく', 'Travailler', '図書館で働いています。', 'Je travaille dans une bibliothèque.', 'Verbe godan. 働いています décrit ici une activité professionnelle.', ['travail'], ['verbe', 'JLPT N5']],
    ['hajimeru', '始める', 'はじめる', 'Commencer quelque chose', '仕事を始めます。', 'Je commence le travail.', 'Verbe ichidan transitif : on commence une activité. À distinguer de 始まる, « commencer » sans objet.', ['travail'], ['verbe', 'JLPT N4']],
    ['owaru', '終わる', 'おわる', 'Se terminer', '会議は三時に終わります。', 'La réunion se termine à trois heures.', 'Verbe godan. Le sujet est la chose qui se termine.', ['travail'], ['verbe', 'JLPT N5']],
    ['hanasu', '話す', 'はなす', 'Parler', '日本語で話します。', 'Je parle en japonais.', 'Verbe godan en す. Forme polie : 話します（はなします）.', ['travail', 'quotidien'], ['verbe', 'JLPT N5']],
    ['kaku', '書く', 'かく', 'Écrire', '名前を書いてください。', 'Écrivez votre nom, s’il vous plaît.', 'Verbe godan. Forme en て : 書いて（かいて）.', ['travail'], ['verbe', 'JLPT N5']],
    ['yomu', '読む', 'よむ', 'Lire', '毎晩、本を読みます。', 'Tous les soirs, je lis un livre.', 'Verbe godan. Forme polie : 読みます（よみます）.', ['travail', 'quotidien'], ['verbe', 'JLPT N5']],
    ['iku', '行く', 'いく', 'Aller', '明日、学校に行きます。', 'Demain, je vais à l’école.', 'Verbe godan. Attention à la forme en て irrégulière : 行って（いって）.', ['verbes', 'quotidien'], ['verbe', 'JLPT N5']],
    ['kaeru', '帰る', 'かえる', 'Rentrer', '六時に家に帰ります。', 'Je rentre chez moi à six heures.', 'Malgré sa terminaison en える, 帰る est un verbe godan.', ['verbes', 'quotidien'], ['verbe', 'JLPT N5']],
    ['miru', '見る', 'みる', 'Voir, regarder', '映画を見ます。', 'Je regarde un film.', 'Verbe ichidan. Forme polie : 見ます（みます）.', ['verbes', 'quotidien'], ['verbe', 'JLPT N5']],
    ['neru', '寝る', 'ねる', 'Dormir, se coucher', '十一時に寝ます。', 'Je me couche à onze heures.', 'Verbe ichidan. Forme polie : 寝ます（ねます）.', ['verbes', 'quotidien'], ['verbe', 'JLPT N5']],
    ['okiru', '起きる', 'おきる', 'Se lever, se réveiller', '毎朝、七時に起きます。', 'Tous les matins, je me lève à sept heures.', 'Verbe ichidan. Forme polie : 起きます（おきます）.', ['verbes', 'quotidien'], ['verbe', 'JLPT N5']],
    ['mizu', '水', 'みず', 'Eau', '水をください。', 'De l’eau, s’il vous plaît.', 'Nom. Pour l’eau chaude, on dit お湯（おゆ）.', ['cuisine', 'quotidien'], ['nom', 'JLPT N5']],
    ['gohan', 'ご飯', 'ごはん', 'Riz cuit ; repas', 'ご飯を食べましょう。', 'Mangeons.', 'Selon le contexte, ご飯 désigne le riz cuit ou le repas.', ['cuisine'], ['nom', 'JLPT N5']],
    ['ocha', 'お茶', 'おちゃ', 'Thé', '温かいお茶を飲みます。', 'Je bois du thé chaud.', 'お est ici un préfixe courant de politesse.', ['cuisine'], ['nom', 'JLPT N5']],
    ['oishii', 'おいしい', 'おいしい', 'Délicieux, bon', 'このパンはおいしいです。', 'Ce pain est délicieux.', 'Adjectif en い. Négatif : おいしくない.', ['cuisine'], ['adjectif', 'JLPT N5']],
    ['hon', '本', 'ほん', 'Livre', 'この本はおもしろいです。', 'Ce livre est intéressant.', 'Nom. 本 est aussi un compteur d’objets longs, avec des lectures variables.', ['quotidien'], ['nom', 'JLPT N5']],
    ['shigoto', '仕事', 'しごと', 'Travail, emploi', '今日は仕事があります。', 'Aujourd’hui, je travaille.', '仕事をする signifie « travailler » ou « faire son travail ».', ['travail'], ['nom', 'JLPT N5']],
    ['kaigi', '会議', 'かいぎ', 'Réunion', '午後に会議があります。', 'Il y a une réunion cet après-midi.', '会議室（かいぎしつ） : salle de réunion.', ['travail'], ['nom', 'JLPT N4']],
    ['ashita', '明日', 'あした', 'Demain', '明日は休みです。', 'Demain, c’est un jour de repos.', 'あした est la lecture courante. あす existe aussi.', ['quotidien'], ['temps', 'JLPT N5']],
    ['particle-wa', '〜は', 'は（prononcé わ）', 'Particule du thème', '私は学生です。', 'Je suis étudiant.', 'は présente le thème : « en ce qui concerne… ». La particule s’écrit は mais se prononce わ.', ['grammaire'], ['particule', 'JLPT N5']],
    ['particle-o', '〜を', 'を（prononcé お）', 'Particule du complément d’objet direct', '本を読みます。', 'Je lis un livre.', 'を indique l’objet direct de nombreux verbes d’action.', ['grammaire'], ['particule', 'JLPT N5']],
    ['tai', '〜たい', 'たい', 'Vouloir faire quelque chose', '日本に行きたいです。', 'Je veux aller au Japon.', 'Attacher たい à la base en ます du verbe : 行きます → 行きたい.', ['grammaire'], ['structure', 'JLPT N5']],
    ['kanji-hi', '日', 'ひ・にち・じつ', 'Jour ; soleil', '日曜日は休みです。', 'Le dimanche, c’est repos.', 'Lectures selon le mot : 日（ひ）, 日本（にほん）, 休日（きゅうじつ）. 日曜日 se lit にちようび.', ['kanjis'], ['kanji', 'JLPT N5']],
    ['kanji-yama', '山', 'やま・さん', 'Montagne', '山が見えます。', 'On voit la montagne.', 'Lecture japonaise : やま. Lecture sino-japonaise fréquente : さん, comme 富士山（ふじさん）.', ['kanjis'], ['kanji', 'JLPT N5']],
    ['kanji-hito', '人', 'ひと・じん・にん', 'Personne', 'あの人は先生です。', 'Cette personne est professeur.', '人（ひと）, 日本人（にほんじん）, 三人（さんにん）. Les lectures varient selon le mot.', ['kanjis'], ['kanji', 'JLPT N5']],
  ];
  const notes: Note[] = [];
  const cards: StudyCard[] = [];
  for (const [id, japanese, reading, meaning, example, exampleTranslation, explanation, deckIds, tags] of entries) {
    notes.push({ id: `note-${id}`, japanese, reading, meaning, example, exampleTranslation, explanation, tags, updatedAt });
    cards.push({ id: `card-${id}`, noteId: `note-${id}`, direction: 'ja-fr', deckIds, updatedAt });
  }
  return { ...emptySnapshot(), decks, notes, cards };
}
