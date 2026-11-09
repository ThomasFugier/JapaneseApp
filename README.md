# Kotoba — japonais personnel

Application Next.js responsive : accueil, révisions FSRS et bibliothèque consultable comme un dictionnaire. L’édition est séparée de la lecture. Une carte peut être classée dans plusieurs decks avec une seule progression.

## Démarrer

Node.js 22 recommandé.

```sh
npm install
npm run dev
```

Ouvrir http://localhost:3000. Sans configuration, l’application fonctionne sur cet appareil avec IndexedDB, sans compte ni synchronisation. Un jeu d’exemples permet de l’essayer ; ce ne sont pas des données Anki importées.

```sh
npm run typecheck
npm test
npm run build
```

## GitHub depuis les paramètres

Aucun fichier de configuration n’est nécessaire pour le mode personnel.

1. Créer un dépôt GitHub **privé**, initialisé avec un README, réservé aux données Kotoba.
2. Créer une clé fine-grained GitHub limitée à ce dépôt avec **Contents: Read and write**.
3. Dans **Paramètres → GitHub**, renseigner le dépôt (URL ou propriétaire/nom), la branche et la clé, puis cliquer **Connecter**.
4. La synchronisation démarre automatiquement, puis reprend après les modifications et au retour de connexion. Un bouton permet aussi de la lancer manuellement.

La clé est envoyée directement à api.github.com et conservée uniquement en mémoire pendant cette ouverture. Elle n’est stockée ni dans localStorage, ni dans IndexedDB, ni dans un export ou le code. Après rechargement ou fermeture, la ressaisir dans les paramètres. Seuls le nom du dépôt et la branche sont mémorisés. La clé doit être saisie uniquement dans le champ dédié, jamais dans un commit ou une conversation.

La connexion vérifie le caractère privé du dépôt et l’existence de la branche. Les erreurs de droits ou de réseau ne suppriment pas les données locales. Les contenus de démonstration intacts sont remplacés par la bibliothèque distante lors de la première connexion à un dépôt existant.

## Vercel

Importer le dépôt de code dans Vercel, choisir Next.js et définir **Root Directory : kotoba** si le dépôt contient le dossier parent. Si kotoba est la racine du dépôt, garder la racine par défaut. Le mode GitHub personnel fonctionne sans variable d’environnement ; connecter chaque appareil depuis les paramètres. Le dépôt de données reste séparé du dépôt de code.

Aucun dépôt ou déploiement n’a été créé automatiquement. Les offres gratuites et leurs quotas peuvent évoluer.

### Connexion serveur facultative

L’ancien mode OAuth reste disponible pour un déploiement personnel configuré par son propriétaire : renseigner les variables de .env.example dans Vercel, utiliser une OAuth App avec callback https://votre-app.vercel.app/api/auth/callback et un token serveur limité au dépôt privé. Ce mode utilise state, PKCE et un cookie signé HttpOnly, SameSite=Lax, Secure en HTTPS. Il n’est pas nécessaire pour configurer le dépôt depuis les paramètres.

## Lecture et révisions

- Fil d’Ariane cliquable, retour au parent et sous-decks accessibles sur mobile.
- Tri par lecture japonaise, traduction ou date d’ajout. Pour les anciennes fiches sans date de création, la date de dernière modification sert de référence.
- Recherche limitée au deck ou étendue à toute la bibliothèque ; les résultats indiquent leurs decks. Romaji, hiragana et katakana sont rapprochés via les lectures enregistrées, y compris on/kun : ringo retrouve 林檎 si sa lecture りんご ou リンゴ existe. Aucune lecture n’est déduite automatiquement d’un kanji.
- Tolérance aux fautes dans les lectures et traductions : rango retrouve aussi 林檎. Les correspondances exactes et partielles précèdent les résultats approchants, classés par proximité ; le tri choisi départage les égalités. Les mots courts restent stricts pour limiter le bruit. Le mode écriture utilise la même tolérance.
- Traductions masquables et révélables individuellement, sans modifier la progression.
- Dernier deck, recherche, tri, masquage, fiche ouverte et position de lecture mémorisés sur cet appareil.
- Nouvelles cartes et cartes dues distinguées. Une réponse peut être annulée pendant la session, y compris à son écran de fin.
- Une annulation ajoute un événement ; elle ne supprime pas l’historique et reste effective après synchronisation.

## Écriture

Les modes **あ** (hiragana) et **ア** (katakana) convertissent le romaji pendant la frappe : ringo devient りんご, ko-hi- devient コーヒー. Le point et la virgule deviennent 。 et 、 ; les points d’interrogation et d’exclamation deviennent ？ et ！. Le mode **ABC** conserve la saisie latine. Changer de mode ne réécrit pas le texte existant ; le choix est mémorisé sur cet appareil.

Les propositions viennent des cartes enregistrées. Les flèches choisissent une proposition ; Espace en mode japonais, Entrée ou Tab l’insèrent ; Échap ferme les propositions. Le clavier japonais et sa composition native restent utilisables ; le texte collé est conservé tel quel. Ctrl/Cmd+Z annule et Ctrl/Cmd+Maj+Z rétablit les modifications de la session.

Le brouillon est enregistré sur cet appareil, indépendamment des decks et de la synchronisation GitHub. Le bouton de téléchargement l’exporte en texte UTF-8. Il n’est pas inclus dans les sauvegardes de cartes. Les propositions ne créent ni carte ni révision.

## Sauvegarde et fonctionnement hors connexion

- Les modifications sont enregistrées localement avant l’envoi GitHub. L’installation mobile s’effectue depuis le menu du navigateur compatible.
- Ouvrir une première fois l’application en ligne pour préparer les ressources hors connexion. Une application fermée ne garantit aucun envoi ; la synchronisation reprend à l’ouverture ou au retour de connexion.
- L’indicateur de synchronisation permet de distinguer sauvegarde locale et copie distante. Synchroniser avant de changer d’appareil ; un appareil hors connexion ignore les nouvelles données des autres.
- L’export ZIP contient le JSON versionné, le contenu et l’historique. L’export CSV sert à réutiliser les fiches ; il ne remplace pas une sauvegarde complète. Médias non inclus dans cette V1 textuelle.
- Télécharger régulièrement un export séparé. Effacer les données du navigateur supprime la copie locale et les modifications non synchronisées. Les sessions d’un même navigateur et d’un même profil partagent cette copie. Les navigateurs compatibles Web Locks limitent Kotoba à un onglet actif pour éviter les écritures concurrentes locales.
- Les suppressions restent sous forme de marqueurs pour éviter la résurrection des cartes lors des fusions. L’historique Git conserve aussi les versions précédentes ; supprimer une carte dans l’interface n’efface donc pas ses anciennes versions du dépôt.

## Format et synchronisation

`library.json` contient `schemaVersion`, les paramètres `scheduler`, `decks`, `notes` (dont lectures on/kun facultatives), `cards`, `reviews`, `reviewUndos`. Le format v3 importe automatiquement les anciennes sauvegardes v1 et v2. Les identifiants sont stables ; les dates sont ISO. Le schéma est documenté dans DATA_FORMAT.md. Une restauration remplace les contenus en conservant les événements de révision existants. Les liens vers les decks ne dupliquent pas les cartes. La progression est reconstruite depuis les révisions avec FSRS via ts-fsrs v5 (algorithme FSRS-6).

La synchronisation utilise une fusion à trois versions : dernière copie distante connue, copie locale et copie actuelle GitHub. Les événements de révision possèdent des identifiants uniques. Les conflits de contenu sont présentés à l’utilisateur ; aucun choix automatique par date n’efface une modification concurrente. Une révision simultanée hors connexion peut donner une progression différente de celle prédite auparavant : l’historique fusionné est recalculé dans un ordre stable.

Le client valide les relations et les limites avant l’écriture, puis remplace atomiquement un seul fichier via l’API Contents et son SHA. Il relit et recommence si un autre appareil a écrit entre-temps. Les écritures sont regroupées pour réduire les commits. Le fichier distant est limité à 4 Mo en mode personnel. Le mode serveur facultatif limite également la requête HTTP à 4 Mo. Cette V1 convient à une bibliothèque personnelle textuelle ; elle ne vise pas un service multi-utilisateur ou de gros fichiers audio.

## Sécurité et limites

Le mode personnel utilise une clé saisie à l’exécution, uniquement en mémoire. Les requêtes authentifiées vont directement à GitHub. Le dépôt public est refusé et chaque écriture utilise le SHA du fichier pour détecter une modification concurrente.

La copie locale n’est pas chiffrée : utiliser un appareil et un profil navigateur personnels. Ne pas y stocker de secrets. En cas de token expiré ou d’indisponibilité GitHub, l’édition et l’export local restent disponibles. Les offres gratuites et leurs quotas peuvent évoluer.

La validation automatisée teste le moteur, les fusions, les sessions et les erreurs de concurrence. Les appels GitHub sont testés avec des réponses simulées. L’écriture distante réelle attend la connexion de votre dépôt depuis les paramètres.

## Dépendances

Le moteur utilise FSRS via `ts-fsrs` v5 (algorithme FSRS-6, licence MIT), avec ses paramètres fournis par défaut. Next.js, React, IndexedDB (`idb`), `fflate`, Zod, WanaKana et Lucide sont utilisés sous leurs licences respectives. Les versions installées sont figées dans `package-lock.json`.
