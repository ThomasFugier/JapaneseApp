# Format des données Kotoba — version 3

La bibliothèque synchronisée est un fichier UTF-8 `library.json`. L’export ZIP contient la même structure dans `kotoba.json`, plus un fichier explicatif. L’export JSON est indépendant de GitHub et de Vercel.

```json
{
  "schemaVersion": 3,
  "scheduler": { "algorithm": "fsrs", "version": "5", "retention": 0.9 },
  "decks": [],
  "notes": [],
  "cards": [],
  "reviews": [],
  "reviewUndos": []
}
```

- `decks` : `id`, `name`, `description`, `parentId` (identifiant ou `null`), `color` (`sage`, `amber`, `rose`, `sky`), `updatedAt`, `deletedAt` facultatif.
- `notes` : `id`, `createdAt` facultatif (date d’ajout), `japanese`, `reading`, `onReadings` et `kunReadings` facultatifs (tableaux de lectures), `meaning`, `example`, `exampleTranslation`, `explanation`, `tags` (tableau), `updatedAt`, `deletedAt` facultatif.
- `cards` : `id`, `noteId`, `direction` (`ja-fr` ou `fr-ja`), `deckIds` (tableau), `updatedAt`, `deletedAt` facultatif.
- `reviews` : `id`, `cardId`, `rating` (1 à 4), `reviewedAt`.
- `reviewUndos` : `id`, `reviewId` (révision annulée), `undoneAt`.

Les dates utilisent ISO 8601 avec fuseau horaire ; l’application écrit en UTC. Une note contient le contenu pédagogique. Une carte définit un sens de question et possède son propre historique. Une carte peut appartenir à plusieurs decks. Un tableau `deckIds` vide laisse la fiche accessible dans « Toutes les fiches ».

Les identifiants sont permanents. Une carte ne change jamais de `noteId` ni de `direction`. Une note peut avoir au maximum une carte active par direction. Deux cartes supprimées et actives peuvent partager une direction pour conserver un ancien historique, mais une seule peut être active.

Une suppression utilise `deletedAt` : les objets et leurs révisions restent présents pour éviter une résurrection depuis un appareil ancien. Les références vers ces objets restent valides. Retirer physiquement un objet d’un fichier ne constitue pas une suppression synchronisable.

Les révisions sont des événements immuables : 1 = À revoir, 2 = Difficile, 3 = Bien, 4 = Facile. Elles fusionnent par identifiant. Deux événements différents avec le même identifiant sont rejetés. Les annulations sont aussi des événements immuables. Elles référencent une révision existante, conservée intégralement dans `reviews`. La progression exclut les révisions visées par au moins une annulation, puis rejoue les autres par instant UTC et identifiant. Plusieurs appareils annulant la même réponse produisent le même résultat. Une révision annulée ne réapparaît pas lorsqu’un appareil ancien synchronise.

`scheduler.version` désigne la famille de bibliothèque `ts-fsrs` 5 ; le verrou npm de cette V1 fixe `ts-fsrs` 5.4.2, qui implémente FSRS-6. La rétention est fixée à 0,9 et l’aléa désactivé. Toute évolution du moteur devra conserver la compatibilité ou prévoir une migration explicite.

La fusion des contenus compare le dernier état synchronisé avec les versions locale et distante. Les changements incompatibles sont présentés à l’utilisateur. Une suppression face à une édition expose aussi les cartes associées dont l’état diffère. Les hiérarchies cycliques et références inconnues sont refusées.

Les sauvegardes de versions 1 et 2 sont migrées automatiquement vers la version 3. Les annulations existantes sont conservées ; une ancienne version 1 sans annulations reçoit une liste `reviewUndos` vide. Les lectures on/kun sont facultatives. Les dates d’ajout absentes restent facultatives ; l’interface utilise alors `updatedAt`. Les versions inconnues sont refusées.

L’import accepte un JSON ou un ZIP Kotoba. Les fichiers ZIP et le JSON décompressé sont limités à 20 Mo. La synchronisation GitHub possède une limite plus basse de 4 Mo. Aucun média n’est géré dans cette V1. Le CSV exporte seulement les fiches actives et leurs classements : il ne sert pas à restaurer la progression. Pour éviter les formules de tableur, un texte CSV commençant par un caractère de formule est préfixé par une apostrophe ; le ZIP garde le texte exact.
