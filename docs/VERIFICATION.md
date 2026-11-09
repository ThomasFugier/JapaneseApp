# Vérification V1 — 9 novembre 2026

- Build de production Next.js et contrôle TypeScript réussis.
- 20 tests automatisés réussis : FSRS, classements multiples, fusion, suppressions, exports, validation, sessions, origine des requêtes et concurrence GitHub simulée.
- Navigateur ordinateur et viewport mobile 390 × 844 : navigation, lecture d’une fiche, recherche, création d’un sous-deck, ajout d’une fiche à deux decks et création de sa carte inverse.
- Session de deux cartes terminée ; données et historique conservés après rechargement.
- Bibliothèque rouverte après arrêt du serveur, grâce au cache hors connexion.
- Export ZIP réel puis import : aperçu de 9 decks, 29 fiches et 2 révisions. Import annulé après vérification de l’aperçu ; le test automatisé vérifie la restauration du contenu ZIP.
- Second onglet bloqué pour protéger les écritures locales.
- Aperçu final : `preview.jpg`.

La connexion OAuth et l’écriture sur un dépôt GitHub réel ne sont pas configurées ni testées avec un compte réel. Le déploiement Vercel reste à effectuer selon le README.

## Refonte visuelle

- Fond blanc, accents rouge #bc002d, navigation supérieure en onglets sur ordinateur.
- Suppression des slogans, citations, grand visuel et pied de page décoratif.
- Bibliothèque en lecture, recherche, éditeur et carte de révision vérifiés sans modifier les données.
- Mise en page vérifiée à 390 px et 680 px, sans débordement horizontal.
- Build de production et contrôle TypeScript réussis.
- Cache de présentation versionné pour renouveler les ressources ; IndexedDB inchangé.
- Aperçu : preview-white-red.jpg.

## Bibliothèque, révisions et connexion dans les paramètres

- 37 tests passent et build de production avec TypeScript réussi.
- Recherche globale sans accents, masquage réel des réponses, révélation individuelle et tri vérifiés dans le navigateur.
- Contexte conservé après rechargement ; position de lecture identique après aller-retour entre onglets avec un clic sur le bandeau fixe.
- Retour Cuisine → Vocabulaire vérifié sur mobile, sans débordement horizontal à 390 px.
- Réponse Facile : compteur 28 → 27 ; annulation : compteur 27 → 28 et retour à la carte précédente.
- Sauvegarde ZIP réelle du format v1 relue au format v2 avec 29 fiches et ses 2 révisions intactes.
- Paramètres GitHub disponibles : dépôt privé, branche, clé limitée à la session. Aucun secret enregistré dans les données.
- Connexion GitHub directe et concurrence vérifiées par tests simulés ; aucun token réel fourni, aucune écriture distante effectuée.
- Aperçus : preview-library-tools.jpg et preview-github-settings.jpg.

## Écriture et recherche romaji

- 50 tests passent ; build de production et TypeScript validés.
- Recherche réelle ringo : retrouve la fiche 林檎 dont la lecture est enregistrée en katakana リンゴ.
- Fiche 林檎 de l’exemple ajoutée dans Cuisine et Quotidien, sans double carte.
- Autocomplétion clavier : ringo + Tab insère 林檎 ; Entrée ensuite ajoute une nouvelle ligne.
- Insertion au milieu : 私はringoを食べる。 devient 私は林檎を食べる。 sans supprimer le texte autour du curseur.
- Insertion à la souris et brouillon conservé après rechargement vérifiés.
- Écriture sur viewport mobile 390 × 844 : aucune largeur débordante, propositions visibles et navigation à quatre onglets.
- Lectures on/kun facultatives conservées par validation, export ZIP et CSV. Migration des formats v1/v2 vers v3 testée, annulations préservées.
- ZIP réel ancien relu au format v3 : 29 fiches et 2 révisions conservées.
- Brouillon local exportable séparément en TXT ; les suggestions reposent uniquement sur les fiches enregistrées.
- Aperçus : preview-romaji-search.jpg et preview-writing.jpg.

## Recherche tolérante aux fautes

- 54 tests passent ; build de production et TypeScript validés.
- Remplacement, omission, ajout et inversion de lettres testés ; correspondances exactes et partielles avant les résultats approchants.
- Recherche réelle rango dans Cuisine : retrouve 林檎 / リンゴ. Même résultat dans les suggestions du mode écriture.
- Lectures on/kun, portée du deck, dédoublonnage et exclusions des fiches supprimées testés.
- Tolérance limitée à une faute dès quatre lettres, deux dès huit lettres, pour limiter les résultats sans rapport.
- Aperçu : preview-fuzzy-search.jpg.

## Saisie japonaise directe

- 61 tests passent ; build de production et TypeScript validés.
- Saisie réelle ringo → りんご, puis Espace → 林檎 et point → 。.
- Modes hiragana, katakana (ko-hi- → コーヒー) et latin vérifiés ; mode restauré après rechargement.
- Double n testé pendant la frappe : konnichiha → こんにちは, konnyaku → こんにゃく.
- Insertion réelle au milieu de 私はを食べる。 → 私は林檎を食べる。 sans perdre le texte autour.
- Ctrl+Z restaure 私はりんごを食べる。 ; Ctrl+Maj+Z rétablit le kanji.
- Vue mobile à 390 px : barre d’outils sur deux lignes, sans débordement horizontal.
- Les tests du convertisseur couvrent le texte collé, les événements de composition native, la suppression et les changements de curseur. Aucun test d’IME système sur appareil physique effectué.
