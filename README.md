# Japonais

Application Next.js responsive : accueil, révisions FSRS et bibliothèque consultable comme un dictionnaire. L’édition est séparée de la lecture. Une carte peut être classée dans plusieurs decks avec une seule progression.

## Démarrer

Node.js 22 recommandé.

```sh
npm install
npm run dev
```

Ouvrir http://localhost:3000. Sans configuration, l’application fonctionne sur cet appareil avec IndexedDB, sans compte ni synchronisation. Un nouvel appareil récupère la bibliothèque privée après connexion ; aucun deck de démonstration n’est ajouté.

```sh
npm run typecheck
npm test
npm run build
```

## Bibliothèque privée intégrée

Le serveur utilise directement **ThomasFugier/NihongoData**, branche **main**, fichier **library.json**. Le dépôt reste privé et séparé du code. L’interface propose seulement **Continue with GitHub** ; aucun dépôt, branche ou token n’est à renseigner dans le navigateur.

La connexion personnelle est réservée à **ThomasFugier** et mémorisée pendant 90 jours avec un cookie signé HttpOnly, Secure en HTTPS, SameSite=Lax. La lecture et l’écriture du dépôt passent uniquement par le serveur après authentification. Les cartes locales restent utilisables hors ligne et après déconnexion.

### Configuration unique sur Vercel

1. Créer une clé GitHub fine-grained limitée à NihongoData avec **Contents: Read and write**.
2. Créer une OAuth App GitHub, homepage **https://japanese-srs-two.vercel.app**, callback **https://japanese-srs-two.vercel.app/api/auth/callback**. Elle sert uniquement à vérifier l’identité du propriétaire avec read:user.
3. Ajouter les secrets serveur **GITHUB_DATA_TOKEN**, **GITHUB_CLIENT_ID**, **GITHUB_CLIENT_SECRET** et **SESSION_SECRET** dans les variables du projet Vercel. SESSION_SECRET doit être aléatoire, au moins 32 caractères et indépendant des clés GitHub. Ne jamais utiliser de préfixe NEXT_PUBLIC_ pour ces valeurs ni les commiter.
4. Publier la version après configuration. Une modification des variables Vercel s’applique au prochain déploiement ; aucun déploiement n’est lancé automatiquement par ce projet.

Les valeurs non secrètes sont déjà prédéfinies. .env.example permet de les remplacer pour un autre environnement, notamment APP_URL pour le développement local. Sur Vercel, garder Next.js, Root Directory vide et **prod** comme branche de production.

La synchronisation reprend après connexion, modification et retour en ligne. Un nouvel appareil charge toutes les fiches, tous les decks et l’historique du dépôt. Les anciennes démonstrations intactes sont remplacées ; les données personnelles sont fusionnées avec contrôle des conflits. Une indisponibilité GitHub ne supprime aucune donnée locale. Les anciens tokens enregistrés dans le navigateur sont effacés au passage à la connexion serveur.

## Lecture et révisions

- Bibliothèque : recherche centrée en haut, fiches compactes et arborescence à droite. Les chevrons replient les branches sans changer le deck sélectionné ; leur état est mémorisé localement. Sur téléphone, le bouton Decks ouvre l’arborescence au-dessus des fiches.
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
- Télécharger régulièrement un export séparé. Effacer les données du navigateur supprime la copie locale et les modifications non synchronisées. Les sessions d’un même navigateur et d’un même profil partagent cette copie. Les navigateurs compatibles Web Locks limitent Japonais à un onglet actif pour éviter les écritures concurrentes locales.
- Les suppressions restent sous forme de marqueurs pour éviter la résurrection des cartes lors des fusions. L’historique Git conserve aussi les versions précédentes ; supprimer une carte dans l’interface n’efface donc pas ses anciennes versions du dépôt.

## Format et synchronisation

`library.json` contient `schemaVersion`, les paramètres `scheduler` et `reviewSettings`, `decks`, `notes` (dont lectures on/kun facultatives), `cards`, `reviews`, `reviewUndos`. Le format v4 importe automatiquement les anciennes sauvegardes v1, v2 et v3. Les identifiants sont stables ; les dates sont ISO. Le schéma est documenté dans DATA_FORMAT.md. Une restauration remplace les contenus en conservant les événements de révision existants. Les liens vers les decks ne dupliquent pas les cartes. La progression est reconstruite depuis les révisions avec FSRS via ts-fsrs v5 (algorithme FSRS-6), puis les échéances personnalisées enregistrées avec chaque réponse. Settings → Review spacing permet de régler les délais Again/Hard/Good/Easy et leur progression ; les changements concernent les réponses futures uniquement.

La synchronisation utilise une fusion à trois versions : dernière copie distante connue, copie locale et copie actuelle GitHub. Les événements de révision possèdent des identifiants uniques. Les conflits de contenu sont présentés à l’utilisateur ; aucun choix automatique par date n’efface une modification concurrente. Une révision simultanée hors connexion peut donner une progression différente de celle prédite auparavant : l’historique fusionné est recalculé dans un ordre stable.

Le client valide les relations et les limites avant l’écriture, puis remplace atomiquement un seul fichier via l’API Contents et son SHA. Il relit et recommence si un autre appareil a écrit entre-temps. Les écritures sont regroupées pour réduire les commits. Le fichier distant est limité à 4 Mo en mode personnel. Le mode serveur facultatif limite également la requête HTTP à 4 Mo. Cette V1 convient à une bibliothèque personnelle textuelle ; elle ne vise pas un service multi-utilisateur ou de gros fichiers audio.

## Sécurité et limites

La clé du dépôt et le secret de session restent côté serveur. Les API de synchronisation exigent une session du propriétaire ; les écritures refusent les origines étrangères. Le dépôt public est refusé et chaque écriture utilise le SHA du fichier pour détecter une modification concurrente.

La copie locale des cartes n’est pas chiffrée par l’application : utiliser un appareil et un profil navigateur personnels. Aucune clé de dépôt n’est enregistrée dans le navigateur, les exports ou les cartes. En cas de token expiré ou d’indisponibilité GitHub, l’édition et l’export local restent disponibles. Les offres gratuites et leurs quotas peuvent évoluer.

La validation automatisée teste le moteur, les fusions, les sessions et les erreurs de concurrence. Les appels GitHub sont testés avec des réponses simulées. La connexion distante réelle demande la configuration initiale des secrets Vercel et l’autorisation GitHub du propriétaire.

## Dépendances

Le moteur utilise FSRS via `ts-fsrs` v5 (algorithme FSRS-6, licence MIT), avec ses paramètres fournis par défaut. Next.js, React, IndexedDB (`idb`), `fflate`, Zod, WanaKana et Lucide sont utilisés sous leurs licences respectives. Les versions installées sont figées dans `package-lock.json`.
