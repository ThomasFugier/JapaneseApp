# Histoires japonaises

Une histoire = un fichier JSON autonome dans `stories/`. Le catalogue charge
automatiquement tous les fichiers `.json`, par ordre alphabétique. Utiliser des
noms comme `07-nom-histoire.json` pour choisir l’ordre d’affichage.

Pour ajouter une histoire : générer un nouveau JSON suivant ce format, le déposer
dans `stories/`, puis lancer `npm test` et `npm run build`. Aucun import ni liste
TypeScript à modifier. Redémarrer le serveur de développement après un ajout.

Le schéma lisible par les éditeurs et générateurs est [story.schema.json](story.schema.json).
Les histoires existantes servent d’exemples complets.

## Format v1

```json
{
  "$schema": "../story.schema.json",
  "schemaVersion": 1,
  "language": "ja",
  "definitionLanguage": "fr",
  "id": "identifiant-unique-stable",
  "title": "Titre japonais",
  "reading": "たいとる",
  "subtitle": "Titre en français",
  "level": "N5",
  "theme": "cat",
  "description": "Une courte présentation en français.",
  "paragraphs": [
    [
      { "text": "猫", "reading": "ねこ", "meaning": "Un chat." },
      { "text": "です", "reading": "です", "meaning": "Être ; forme polie." },
      "。"
    ]
  ]
}
```

Cet extrait illustre la structure ; une histoire complète doit contenir **80 à
250 caractères japonais**, ponctuation comprise, sans compter les sauts de ligne.

- `id` : unique, minuscules ASCII/chiffres séparés par des tirets. Le conserver
  lors des corrections : la progression de lecture utilise cet identifiant.
- `level` : `N5` ou `N4`, les niveaux actuellement proposés par la bibliothèque.
- `theme` : `cat`, `rain`, `moon`, `train`, `letter` ou `sea` (couverture existante).
- `paragraphs` : tableau de paragraphes ; chaque paragraphe est un tableau de
  segments dans l’ordre de lecture. L’application les joint sans espaces.
- Chaque mot, expression ou particule possède `text`, `reading` en hiragana et
  `meaning` en français. Donner la lecture et le sens **dans cette phrase**, y
  compris pour les formes conjuguées. Répéter l’objet si le mot revient : chaque
  occurrence peut ainsi avoir son propre sens ou sa propre lecture.
- Une chaîne simple est réservée à la ponctuation japonaise `、。「」！？`.
- Pas de HTML, Markdown, romaji ni furigana encodé dans `text`. Les lectures sont
  séparées pour permettre l’affichage avec ou sans furigana.

Les fichiers sont validés lors du chargement et de la compilation. Une erreur
indique le fichier concerné. Les tests contrôlent aussi les lectures et la longueur.
Après une modification du format dans `lib/story-schema.ts`, régénérer le schéma
avec `npm run stories:schema`.
