# Format des données Kotoba — version 4

La bibliothèque synchronisée est un fichier UTF-8 `library.json`. L’export ZIP contient la même structure dans `kotoba.json`, plus un fichier explicatif. L’export JSON est indépendant de GitHub et de Vercel.

```json
{
  "schemaVersion": 4,
  "scheduler": { "algorithm": "fsrs", "version": "5", "retention": 0.9 },
  "reviewSettings": {
    "mode": "automatic",
    "againMinutes": 1,
    "hardMinutes": 1440,
    "goodMinutes": 20160,
    "easyMinutes": 86400,
    "growIntervals": true,
    "updatedAt": "1970-01-01T00:00:00.000Z"
  },
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
- `reviews` : `id`, `cardId`, `rating` (1 à 4), `reviewedAt`, `dueAt` facultatif (échéance personnalisée immuable).
- `reviewUndos` : `id`, `reviewId` (révision annulée), `undoneAt`.

Les dates utilisent ISO 8601 avec fuseau horaire ; l’application écrit en UTC. Une note est la fiche unique visible dans la bibliothèque et contient le contenu pédagogique. Chaque note active possède automatiquement deux enregistrements de révision dans `cards`, un par sens, avec des historiques et des échéances indépendants. Les valeurs historiques `ja-fr` et `fr-ja` désignent japonais → sens et sens → japonais ; elles restent inchangées pour préserver les sauvegardes. Les deux sens partagent les mêmes decks. Un tableau `deckIds` vide laisse la fiche accessible dans « All cards ».

Les identifiants sont permanents. Un enregistrement de révision ne change jamais de `noteId` ni de `direction`. Une note active possède exactement un enregistrement actif par direction. La lecture, l’import et la synchronisation complètent automatiquement les sens manquants, avec des identifiants déterministes. Un sens désactivé est réactivé avec son identifiant et son historique existants. Les notes supprimées restent supprimées. Des enregistrements archivés d’un ancien sens peuvent être conservés, mais un seul est actif par direction.

Une suppression utilise `deletedAt` : les objets et leurs révisions restent présents pour éviter une résurrection depuis un appareil ancien. Les références vers ces objets restent valides. Retirer physiquement un objet d’un fichier ne constitue pas une suppression synchronisable.

Les révisions sont des événements immuables : 1 = À revoir, 2 = Difficile, 3 = Bien, 4 = Facile. Elles fusionnent par identifiant. Deux événements différents avec le même identifiant sont rejetés. Les annulations sont aussi des événements immuables. Elles référencent une révision existante, conservée intégralement dans `reviews`. La progression exclut les révisions visées par au moins une annulation, puis rejoue les autres par instant UTC et identifiant. Plusieurs appareils annulant la même réponse produisent le même résultat. Une révision annulée ne réapparaît pas lorsqu’un appareil ancien synchronise.

`scheduler.version` désigne la famille de bibliothèque `ts-fsrs` 5 ; le verrou npm de cette V1 fixe `ts-fsrs` 5.4.2, qui implémente FSRS-6. La rétention est fixée à 0,9 et l’aléa désactivé. Toute évolution du moteur devra conserver la compatibilité ou prévoir une migration explicite.

`reviewSettings.mode` vaut `automatic` (FSRS inchangé) ou `custom`. Les quatre délais sont des entiers en minutes, compris entre 1 minute et 3 650 jours, avec Again ≤ Hard ≤ Good ≤ Easy. Un jour vaut 24 heures. En mode personnalisé, Again et Hard utilisent toujours le délai choisi. Avec `growIntervals`, deux réponses Good consécutives utilisent deux fois le délai Good de base ; deux réponses Easy consécutives utilisent trois fois le délai Easy de base. Ces plafonds restent identiques lorsque la série continue : aucune multiplication composée. Toute réponse différente repart du délai de base de son bouton et interrompt le bonus précédent, y compris Good ↔ Easy, Hard et Again. Le dernier événement effectif du même sens détermine la répétition ; une annulation restaure donc aussi le bonus précédent. Le délai final reste plafonné à 3 650 jours. Sans cette option, tous les délais sont fixes. Les échéances déjà enregistrées ne changent pas.

Une réponse personnalisée enregistre son échéance dans `reviews[].dueAt`. La reconstruction applique FSRS puis cette échéance ; Good/Easy d’au moins un jour quittent la phase d’apprentissage. Les anciens événements sans `dueAt` gardent leur calcul FSRS. Modifier les réglages ne recalcule aucune échéance existante. Une annulation restaure la progression précédente. L’entraînement libre ne crée pas de révision planifiée et ne modifie pas les échéances.

Les réglages sont synchronisés et exportés. La fusion à trois versions conserve le côté modifié si l’autre est inchangé ; en cas de réglages concurrents, le `updatedAt` le plus récent gagne, puis l’ordre canonique du JSON départage une égalité. Les événements de révision conservent leur propre échéance même si les réglages changent ensuite.

La fusion des contenus compare le dernier état synchronisé avec les versions locale et distante. Les changements incompatibles sont présentés à l’utilisateur. Une suppression face à une édition expose aussi les cartes associées dont l’état diffère. Les hiérarchies cycliques et références inconnues sont refusées.

Les sauvegardes de versions 1, 2 et 3 sont migrées automatiquement vers la version 4 avec les réglages automatiques ci-dessus, sans modifier leurs échéances. Les annulations existantes sont conservées ; une ancienne version 1 sans annulations reçoit une liste `reviewUndos` vide. Les lectures on/kun sont facultatives. Les dates d’ajout absentes restent facultatives ; l’interface utilise alors `updatedAt`. Les versions inconnues sont refusées. Une ancienne application doit être rechargée avant d’envoyer une synchronisation (HTTP 426), pour préserver les échéances de version 4.

L’import accepte un JSON ou un ZIP Kotoba. Les fichiers ZIP et le JSON décompressé sont limités à 20 Mo. La synchronisation GitHub possède une limite plus basse de 4 Mo. Aucun média n’est géré dans cette V1. Le CSV exporte seulement les fiches actives et leurs classements : il ne sert pas à restaurer la progression. Pour éviter les formules de tableur, un texte CSV commençant par un caractère de formule est préfixé par une apostrophe ; le ZIP garde le texte exact.
