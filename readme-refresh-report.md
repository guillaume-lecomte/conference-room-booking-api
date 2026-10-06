# Rapport de relecture des dépôts publics (phase 1)

Compte : `guillaume-lecomte`. Date de l'analyse : 2026-10-06. Phase 1 (inventaire et tri) terminée le 2026-10-06. Phase 2 exécutée le même jour sur 4 dépôts (section 7). Phase 3, propositions de métadonnées non appliquées, en section 8.

## 1. Conclusions

1. Sur 11 dépôts publics, 9 sont dans le périmètre (hors `agent-platform` et le README de profil). Aucun n'est un fork ni archivé. Un seul mérite le statut de vitrine (`wealth-api`). Deux sont secondaires (`conference-room-booking-api`, `car-selector-app`). Un est à archiver (`users-timezone`). Cinq sont des exercices d'apprentissage de 2019 à 2021 que je recommande de passer en privé.
2. Le point le plus défavorable : le dépôt `conference-room-booking-api` affiche l'idempotence et la « production-ready » comme arguments, mais le contrôle de conflit de créneau n'est pas atomique. Mesuré sur une vraie base PostgreSQL 16 : avec 20 requêtes simultanées sur le même créneau, plusieurs réservations ont été acceptées dans 99 rounds sur 100 (script en annexe A, non versionné dans le dépôt). Avec la même clé d'idempotence en parallèle, certaines requêtes finissent en erreur 500 (violation de contrainte unique non traduite).
3. Le même dépôt porte des traces d'une génération par un agent : un seul commit, signé `emergent-agent-e1 <github@emergent.sh>`, plus `test_result.md` (protocole d'agent de test), `memory/PRD.md`, `backend_test.py`, `test_reports/`. Je le signale comme un fait constaté, sans jugement de valeur. Pour un profil de CTO, la manière de présenter ce dépôt est une décision qui t'appartient (section 6, décision 2).
4. `wealth-api` a de l'idée (normalisation d'événements hétérogènes, événements d'ajustement en ajout seul), mais le code ne tient pas toutes les promesses de son README : l'index unique dont dépend l'idempotence n'existe nulle part, un événement contradictoire rejoué crée un ajustement à chaque rejeu, une date invalide fait planter la requête (vérifié par exécution), et il n'y a aucun test utile.
5. Secrets : aucun jeton, clé cloud ni clé privée trouvé (recherche par expressions régulières sur l'arbre courant et sur tout l'historique, voir limites). Trois dépôts versionnent des fichiers `.env` contenant des mots de passe de développement triviaux (`supersecret123`, `secret`). Risque faible, mais visible par un recruteur.
6. Confidentialité : rien qui ressemble à des données d'employeur ou de client. Les noms réels BNP, AXA, Coinbase apparaissent comme exemples de fournisseurs dans `wealth-api` (README et payloads). Je ne vois pas de lien avec un employeur, mais tu es le seul à pouvoir le confirmer.
7. Dépendances : `npm audit` (2026-10-06) remonte 1 vulnérabilité critique dans les dépendances de production de trois dépôts actifs (`next` pour `car-selector-app`, `proxy-addr` pour `wealth-api` et `conference-room-booking-api`). Les dépôts React et GraphQL anciens cumulent des centaines d'avis (comptage par chemin de dépendance, voir section 4).

## 2. Méthode et limites

Faits établis par exécution :

- Inventaire par l'outil GitHub du dépôt et `list_repos` (la CLI `gh` n'est pas disponible dans cette session). 29 dépôts au total, 11 publics, 0 fork, 0 archivé.
- Clonage de chacun avec jusqu'à 1000 commits d'historique (tous les dépôts ont moins de 40 commits, l'historique est donc complet).
- `npm ci` ou `npm install` (selon le lockfile), `tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `npm audit` quand c'était pertinent.
- Test de concurrence réel sur PostgreSQL 16 local pour `conference-room-booking-api` (annexe A).
- Exécution de `parseDate` du `wealth-api` compilé sur quatre entrées.

Ce que je n'ai pas pu faire :

- Aucun démon Docker, pas de RabbitMQ, pas de MongoDB dans cet environnement. Les commandes `docker compose up` de tous les README n'ont donc pas été exécutées. Les 28 tests d'intégration de `conference-room-booking-api` et l'application `wealth-api` n'ont pas tourné contre leurs vraies dépendances. En phase 2, les README devront dire « non exécuté » pour ces commandes, sauf si tu me fournis un environnement avec Docker.
- La recherche de secrets repose sur des expressions régulières (mots clés, motifs AWS, `sk-`, clés PEM, URL MongoDB avec identifiants) sur l'arbre courant et sur le diff de tout l'historique. Aucun outil dédié (gitleaks, trufflehog) n'est installé. C'est un contrôle raisonnable, pas une garantie.
- Les comptages d'avis `yarn audit` incluent les dépendances de build et comptent un avis par chemin, ce qui gonfle les chiffres. Ils donnent un ordre de grandeur, pas un nombre de paquets vulnérables.
- Les dépôts privés ne sont pas relus (hors périmètre), mais ils comptent pour la cohérence d'ensemble (phase 3).

Convention de preuve : `chemin:ligne` pour une lecture de code, « exécuté » quand j'ai lancé la commande.

## 3. Tableau de synthèse

| Dépôt | Catégorie proposée | Dernière activité de code | Tests réels | Risques principaux |
| --- | --- | --- | --- | --- |
| `wealth-api` | Vitrine | 2025-12-20 (README 2026-02-05) | aucun (e2e d'échafaudage en échec) | idempotence sans index, ajustements rejoués, crash sur date invalide, 1 critique `npm audit`, licence incohérente |
| `conference-room-booking-api` | Secondaire (décision requise) | 2026-02-05 | 52 unitaires OK, 28 d'intégration non exécutés | double réservation, provenance agent, README qui sur-annonce, 1 critique `npm audit`, 72 erreurs de lint |
| `car-selector-app` | Secondaire | 2025-12-20 | aucun (jest configuré, 0 test) | README périmé et en français, erreurs métier renvoyées en HTTP 200, `.local.env` versionné, 1 critique `npm audit` |
| `users-timezone` | À archiver | 2021-05-06 | aucun | pas de lockfile, `404` sans `return`, `.env` versionné (sans secret) |
| `docker-starter` | À passer en privé ou supprimer | 2020-11-15 | 1 test d'échafaudage | `.env` avec `secret`, 1'472 avis `yarn audit` (front), exercice |
| `starting-reactjs` | À passer en privé ou supprimer | 2020-11-07 | 1 test d'échafaudage | exercice, 900 avis `yarn audit` |
| `react-redux` | À passer en privé ou supprimer | 2020-11-07 | 1 test d'échafaudage | exercice, 738 avis `yarn audit` |
| `react-redux-saga` | À passer en privé ou supprimer | 2020-12-07 | 1 test d'échafaudage | exercice, 718 avis, `debug.log` versionné |
| `graphql-node-mongo` | À passer en privé ou supprimer | 2019-03-09 | aucun | exercice, Apollo Server 2, 114 avis `yarn audit` |

Licences : aucun des 9 dépôts n'a de fichier `LICENSE`. `conference-room-booking-api` déclare MIT dans `package.json` et le README. `wealth-api` pointe vers un `LICENSE` inexistant dans son README et déclare `UNLICENSED` dans `package.json`. Je n'en ajoute aucune (règle du prompt). À toi de décider.

## 4. Fiches par dépôt

### 4.1 `wealth-api` : Vitrine

**Justification.** C'est le seul dépôt hors `agent-platform` où le code porte un raisonnement de domaine : des événements de formats différents (banque, crypto, assurance) sont ramenés à un modèle commun, dédoublonnés, et les contradictions sont absorbées par des écritures d'ajustement qui préservent la trace. Stack NestJS, MongoDB, TypeScript, cohérente avec le profil. Le tri en vitrine suppose que le README affiche honnêtement les limites ci-dessous.

**Risques détectés.**

- Secrets : `.env.example:2` contient `mongodb://admin:admin123@localhost:27017`, même valeur que `docker-compose.yml:10-11`. Identifiants de développement, fichier d'exemple. Aucun `.env` réel versionné.
- Fuite dans les logs : `src/common/mongo.provider.ts:19` journalise l'URL Mongo complète, mot de passe compris, au démarrage.
- Confidentialité : BNP, AXA, Coinbase comme exemples de fournisseurs (README, payloads). Pas de données réalistes de production. À confirmer par toi.
- Image négative : aucun test utile. `test/app.e2e-spec.ts` est l'échafaudage Nest qui attend « Hello World! » sur `/` (exécuté : 1 test en échec, connexion Mongo refusée). `npm audit --omit=dev` : 13 avis (7 modérés, 5 hauts, 1 critique), le critique vient de `proxy-addr` via `express` 4.21.2 / `@nestjs/platform-express` 10 (2026-10-06). `npm run build` passe. `npm run lint` : 1 erreur (le `tsconfig` ne couvre pas `.eslintrc.js`) et 71 avertissements.

**Problématique.** Un utilisateur a des comptes chez plusieurs institutions. Chaque source envoie ses événements dans son propre format, avec des doublons, des retards et parfois des versions contradictoires du même mouvement. Additionner les montants tels quels fausse le solde.

**Solution.** Chaque webhook est normalisé en un `NormalizedEvent` (identifiant stable fournisseur + id, montant signé, date métier, clé de groupe). Le service cherche un événement existant, ignore un rejeu identique, et crée un événement d'ajustement quand le montant ou le type diffère. Le solde est recalculé à la lecture à partir des événements.

**Techniques et preuves.**

| Technique | Preuve |
| --- | --- |
| Normalisation de trois formats vers un modèle unique | `src/wealth/wealth.service.ts:72-152`, `src/wealth/dto/normalized-event.dto.ts` |
| Détection de doublon sur (userId, provider, transactionId) | `wealth.service.ts:154-171`, `:201-230` |
| Contradiction résolue par un événement d'ajustement, l'original reste intact | `wealth.service.ts:173-196`, `:232-251` |
| Gestion du doublon concurrent via le code d'erreur Mongo 11000 | `wealth.service.ts:213-219` (dépend d'un index unique, voir limites) |
| Tri par date métier, pas par date d'ingestion | `wealth.service.ts:407` |
| Parseur de dates multi-formats (ISO, jj/mm/aaaa, timestamps secondes ou millisecondes) | `src/wealth/helpers/date.helper.ts` |
| Validation d'entrée par DTO et `ValidationPipe` global | `src/main.ts:9-14`, `src/wealth/dto/*.ts` |
| Plafond sur la taille de la timeline | `wealth.service.ts:35`, `:395-399` |

**Écarts entre le README actuel et le code (à corriger ou à afficher).**

- Idempotence « automatique » : aucun `createIndex` dans le dépôt (recherche exécutée, 0 résultat), et `docker-compose.yml` monte `./mongo-init` qui n'existe pas dans le dépôt. Sans index unique, la branche 11000 est inatteignable et deux requêtes simultanées peuvent insérer le même événement. Lecture de code, non exécuté faute de MongoDB.
- Un événement contradictoire rejoué crée un nouvel ajustement à chaque livraison : l'identifiant d'ajustement contient `Date.now()` (`wealth.service.ts:182`) et rien ne vérifie qu'un ajustement équivalent existe déjà. Les soldes dérivent. Lecture de code, non exécuté.
- Date invalide ou vide : `parseDate` appelle `logger.warn` sans que le logger soit passé (`wealth.service.ts:83`, `:113`, `:136` appellent `parseDate(x)` sans second argument ; `date.helper.ts:18`, `:32` utilisent `logger.warn`). Exécuté sur le build : `"not-a-date"` et `""` lèvent `Cannot read properties of undefined (reading 'warn')`, ce qui devient une 500 (`wealth.service.ts:296-298`). Le README vend pourtant la gestion des événements « incomplets ».
- Assurance : le montant est toujours négatif (`wealth.service.ts:138`) alors que le README parle de primes et de remboursements.
- Solde : tous les événements de l'utilisateur sont chargés en mémoire (`:328-363`) et les montants de devises différentes sont additionnés sous le nom `totalBalanceEUR` (`:365-369`). Pas de conversion.
- `src/main.ts:17` lève une `TypeError` si `CORS_ORIGINS` n'est pas défini, et le `|| ['*']` qui suit ne peut jamais servir.
- `MongoProvider` est déclaré dans `AppModule` et dans `WealthModule` (`app.module.ts:15`, `wealth.module.ts:10`) : deux clients Mongo.
- Badges du README (TypeScript 5.0, etc.) : décoratifs, TypeScript est en `^5.1.3`. À retirer.
- Section « Testing » du README : instructions Postman, pas de tests. À remplacer par « no automated tests ».

**Compétences du profil mises en avant.** TypeScript, Node.js, NestJS, MongoDB, architecture logicielle (modèle d'événements, pas de CQRS ni d'event sourcing au sens strict : un journal d'événements normalisés, sans rejeu ni projection persistée). Non démontrées ici : Redis, BullMQ, tests, CI.

**Plan du README.** Titre et accroche. The problem (3 phrases). The approach (normalisation, journal en ajout seul, ajustements, solde calculé à la lecture, compromis assumés). Engineering highlights (4 points du tableau, liens vers les fichiers). Architecture : schéma Mermaid à 3 composants (webhooks, service, MongoDB). Tech stack exacte (NestJS 10, MongoDB driver 7, class-validator, date-fns). Getting started : `npm ci`, `npm run build` (testés), démarrage avec Mongo marqué « not run in my verification ». Status : prototype, dernière activité de code 2025-12-20. Known issues : les 8 écarts ci-dessus. License : à trancher.

**Retiré de l'ancien README.** Badges, table des matières, section Postman, section Contact et Contributing génériques, « Real-time balance », « Smart reconciliation » non nuancés, lien `LICENSE` mort.

**Falsifieur.** Si tu m'indiques que ce code est un exercice demandé par un tiers ou qu'il t'a été imposé, la catégorie vitrine tombe. Si l'index unique est créé hors dépôt (script d'infra), l'écart idempotence se réduit.

### 4.2 `conference-room-booking-api` : Secondaire (décision requise)

**Justification.** Le dépôt montre plusieurs mécanismes réels (idempotence par clé, cache-aside Redis, événements RabbitMQ, limitation de débit, arrêt propre, Docker multi-étapes). Mais la correction de la fonction centrale, ne pas réserver deux fois un créneau, est démontrée fausse sous charge, et le README sur-annonce. Il passe vitrine si tu fais corriger le code (hors de mon périmètre) et décides d'assumer la provenance.

**Risques détectés.**

- Correction : voir annexe A. 99 rounds sur 100 avec doublon de réservation (20 requêtes simultanées, PostgreSQL 16 local). Cause : lecture des conflits puis insertion sans transaction, sans verrou, sans contrainte d'exclusion (`BookingService.ts:84-90` (lecture des conflits), `:103` (insertion), `PostgresBookingRepository.ts:172-193`, schéma `connection.ts:60-79`).
- Idempotence en concurrence : la colonne `idempotency_key` est `UNIQUE` (`connection.ts:69`), donc pas de doublon en base, mais la violation de contrainte n'est pas traduite : des requêtes parallèles avec la même clé renvoient 409 `ROOM_UNAVAILABLE` ou une erreur 500 (annexe A). La clé n'est pas liée au contenu : une même clé avec un autre corps renvoie la première réservation sans erreur (annexe A).
- Provenance : commit unique `ff80394`, auteur `emergent-agent-e1`, fichier `.gitconfig` versionné avec cette identité. Fichiers d'agent : `test_result.md`, `memory/PRD.md`, `test_reports/iteration_1.json`, `backend_test.py` (client Python dans un dépôt Node).
- Secrets : `docker-compose.yml:8,69`, `src/config/index.ts:17`, README:47,58 contiennent `apppassword` et `guest/guest` (valeurs de développement, aussi en valeur par défaut dans le code de config).
- Dépendances : `npm audit --omit=dev` : 8 avis (5 modérés, 2 hauts, 1 critique : `proxy-addr`; hauts : `compression`, `path-to-regexp`), 2026-10-06.
- Qualité : `tsc --noEmit` passe. `npm run lint` : 72 erreurs et 2 avertissements (règles `no-unsafe-*` de typescript-eslint, `src/infrastructure/events/EventBus.ts:124`, `PostgresRoomRepository.ts`).

**Problématique.** Réserver une salle de conférence : deux personnes qui cliquent en même temps, un client réseau qui rejoue sa requête après un timeout, des lectures de disponibilité fréquentes.

**Solution.** API Express en trois couches (routes, services, dépôts Postgres), une clé `Idempotency-Key` pour rejouer sans doublon, un cache Redis pour les lectures, des événements publiés sur RabbitMQ pour les effets de bord asynchrones.

**Techniques et preuves.**

| Technique | Preuve |
| --- | --- |
| Idempotence par en-tête, vérification cache puis base, TTL 24 h | `BookingService.ts:62-72`, `:106-112`, `:199-210`, `config/index.ts:29-30` |
| Cache-aside Redis avec TTL | `BookingService.ts:133-146`, `RoomService.ts:55-71`, `RedisCache.ts:80` |
| Événements sur exchange topic durable, messages persistants | `EventBus.ts:67`, `:166-175` |
| Consommateurs avec `ack` et `nack` avec remise en file | `EventBus.ts:143`, `:147` |
| Invalidation de cache pilotée par les événements | `events/handlers.ts` (suppression des clés `booking:` et `availability:`) |
| Limitation de débit à fenêtre glissante, en mémoire | `rateLimitMiddleware.ts:17-27`, `:96-98` |
| Erreurs métier typées, mappées vers des codes HTTP | `BookingService.ts:9-45`, `errorMiddleware.ts` |
| Validation Zod des entrées | `src/api/validators/*.ts`, `validationMiddleware.ts` |
| Sondes `ready` et `live`, arrêt propre | `healthRoutes.ts:42-66`, `app.ts:91-105` |
| Image Docker multi-étapes, utilisateur non root, HEALTHCHECK | `Dockerfile:2`, `:20`, `:35`, `:41` |
| Dépôts derrière des interfaces, services injectés par constructeur | `domain/repositories/*.ts`, `app.ts:50-55` |

**Écarts entre le README actuel et le code.**

- « Clean Architecture » : le domaine importe directement l'infrastructure (`BookingService.ts:4-5` importe `eventBus` et `cache` concrets). La règle de dépendance n'est pas respectée. Je décrirai : trois couches avec des interfaces de dépôt, sans prétendre à Clean Architecture.
- « Coverage 92.7 % (56 tests) » : exécuté, les tests unitaires donnent 52 tests, 92,64 % de lignes et 92,27 % d'instructions. Les 28 tests d'intégration existent (14 + 4 + 10), nécessitent PostgreSQL, Redis et RabbitMQ, et n'ont pas tourné ici. Le chiffre « 56 » n'est reproductible par aucune commande.
- « Rate limiting » : en mémoire et par processus (commentaire du code : « simulates Redis »). Inutilisable tel quel avec plusieurs instances.
- Notifications et analytics : simulées (`handlers.ts`, fonctions `simulateNotification` et `simulateAnalytics`).
- Événements : si RabbitMQ est indisponible, `emit` renvoie `false` et l'événement est perdu sans reprise (`EventBus.ts:157-163`). Un message dont le traitement lève une exception est remis en file sans limite (`:147`), sans file de rebut.
- `deletePattern` utilise `KEYS` (`RedisCache.ts:112`), coûteux sur une grande base Redis.
- `GET /api/bookings` renvoie toutes les réservations, sans pagination (`PostgresBookingRepository.ts` méthode `findAll`).
- `test_reports/iteration_1.json` décrit des 500 au lieu de 404 sur les salles inexistantes. Je n'ai pas pu confirmer l'état actuel sans lancer l'API.
- Noms des salles : README « Einstein Room », code « Salle Einstein » (`connection.ts` insertions initiales).
- Commandes `docker-compose` du README : non exécutées (pas de Docker).

**Compétences du profil mises en avant.** TypeScript, Node.js, PostgreSQL, Redis, Docker, conception orientée événements (RabbitMQ), validation et gestion d'erreurs. Kubernetes : seulement des sondes `ready` et `live`, pas de manifestes, je ne l'affirmerai pas.

**Plan du README (si tu gardes le dépôt public en l'état).** Accroche factuelle. The problem. The approach (3 couches, cache, événements). Highlights : 5 techniques du tableau avec liens. Architecture : schéma Mermaid (API, Postgres, Redis, RabbitMQ). Stack exacte. Getting started : `npm ci`, `npm run build`, `npm run test:unit` (testés), `docker compose up` marqué non exécuté. Status : démonstration, dernière activité 2026-02-05. Known issues : les 9 écarts ci-dessus, dont le double booking en premier. License : MIT déclarée dans `package.json`, pas de fichier `LICENSE`.

**Retiré de l'ancien README.** Emojis dans les titres, « production-ready », « Contributing », « Clean Architecture », le chiffre « 56 tests », le tableau des codes d'erreur à vérifier ligne par ligne (je le garde seulement s'il est exact, voir PR).

**Falsifieur.** Si le script de l'annexe A, relancé sur ta machine avec PostgreSQL, ne produit aucun doublon, mon constat est faux. Si une contrainte d'exclusion est ajoutée au code plus tard, la section Known issues devra être réécrite.

### 4.3 `car-selector-app` : Secondaire

**Justification.** Application complète et propre : Next.js, API Hono, Drizzle, PostgreSQL, validation Zod, pagination, contraintes de schéma. Mais aucun test, un README périmé qui mélange l'existant et une liste de souhaits, et un défaut de contrat HTTP. Utile comme exemple full stack, mineur comme preuve d'ingénierie.

**Risques détectés.**

- Secrets : `.local.env` versionné (`POSTGRES_PASSWORD=supersecret123`, URL de base locale). Le `.gitignore` contient `.env*`, qui ne couvre pas `.local.env`. Mot de passe de développement, mais le même est la valeur de repli dans `docker-compose.yml` (`postgres`).
- Dépendances : `npm audit --omit=dev` : 8 avis (1 modéré, 6 hauts, 1 critique : `next` 16.1.0 ; hauts : `drizzle-orm`, `hono`, `nanoid`, `postcss`, `sharp`, `source-map-js`), 2026-10-06.
- Image négative : `npm test` sort en erreur (0 test trouvé) alors que `jest.config.js` impose 85 % de couverture. `src/__tests__/setup.ts` n'a donc jamais servi. `tsc --noEmit` et `npm run lint` passent (exécutés).

**Problématique.** Choisir une marque, un modèle et une année dans des listes dépendantes et enregistrer la sélection, sans doublons ni modèle rattaché à la mauvaise marque.

**Solution.** Une API Hono montée dans une route fourre-tout de Next.js, des requêtes Drizzle typées, des contraintes d'unicité et de clé étrangère au niveau du schéma, une vérification du rattachement modèle-marque avant insertion.

**Techniques et preuves.**

| Technique | Preuve |
| --- | --- |
| Hono dans un route handler Next.js (`hono/vercel`) | `src/app/api/[[...route]]/route.ts` |
| Validation des paramètres, requêtes et corps par Zod | `src/lib/api/schemas.ts`, `src/lib/api/routes/selections.ts:1,25-60` |
| Schéma typé avec index et contraintes d'unicité | `src/lib/db/schema.ts:14`, `:36`, `:56-66` |
| Pagination avec total en parallèle, bornée à 100 | `src/lib/db/queries/selections.ts` (`getAllSelections`), `src/lib/utils.ts`, `schemas.ts` (`max(100)`) |
| Contrôle de cohérence modèle et marque avant écriture | `queries/selections.ts` (appel `validateModelBrand`), `queries/models.ts` |
| Erreurs applicatives typées | `src/lib/api/errors.ts:4-14` |
| Hook générique de requêtes et contexte de rafraîchissement | `src/hooks/useApi.ts`, `src/contexts/SelectionsContext.tsx` |
| Seed transactionnel | `src/lib/db/seed.ts` |

**Écarts entre le README actuel et le code.**

- Versions fausses : README annonce Next 15.1.3, Zod 3.24, Tailwind 3.4, PostgreSQL 16 ; `package.json` donne Next 16.1.0, React 19.2.3, Zod ^4.2.1, Tailwind ^4 ; `docker-compose.yml` utilise `supabase/postgres:15.1.0.73`.
- L'arborescence du README décrit des fichiers inexistants (`app/selections/page.tsx`, `components/ui/modal.tsx`, `spinner.tsx`, `lib/db/index.ts`, `lib/validations/selection.ts`).
- La section « Optimisations clés à prévoir » liste Redis, k6, Cypress, LaunchDarkly, JWT, canary : rien de cela n'existe. À retirer ou à reformuler en « not implemented ».
- Défaut de contrat : `handleError` renvoie les `AppError` (404, 409, 400) sans code HTTP, donc avec le statut 200 (`src/lib/api/errors.ts:30`, Hono utilise 200 par défaut). Le front s'en sort via `success: false` (`useApi.ts`), mais tout client HTTP standard verra un succès. Lecture de code, non exécuté.
- L'unicité `(brand_id, model_id, year)` ne couvre pas `year = NULL` : PostgreSQL traite les NULL comme distincts. Seule la vérification applicative (`queries/selections.ts:238-246`) protège, et elle est sujette à la même course que le point 4.2.
- `package.json` utilise `pnpm` dans `db:reset` et `pnpm-workspace.yaml`, mais le lockfile est `package-lock.json`.
- `src/lib/db/migrations/` existe, mais `drizzle.config.ts` écrit dans `./drizzle` (ignoré par git) et le README demande `db:push`.
- Le README est en français : je le réécris en anglais (règle du prompt).

**Compétences du profil mises en avant.** TypeScript, React (Next.js App Router, hooks), conception d'API, PostgreSQL. Non démontrées : tests, CI, déploiement.

**Plan du README.** Titre, accroche et capture existante (`public/app-preview.jpg`). The problem (2 phrases). The approach (Next.js + Hono + Drizzle, pourquoi un seul déploiement). Highlights : 4 techniques du tableau. Stack exacte issue de `package.json`. Getting started : `npm install`, `npm run typecheck`, `npm run lint` (testés) ; `docker compose up -d`, `db:push`, `db:seed`, `dev` marqués non exécutés. Status : exemple, 2025-12-20. Known issues : les 7 écarts ci-dessus. License : aucune.

**Retiré de l'ancien README.** La liste de souhaits, les versions et l'arborescence inexactes, les emojis, la partie en français.

**Falsifieur.** Un test `curl` sur `DELETE /api/selections/999999` : si la réponse est un 404 HTTP, mon constat du statut 200 est faux.

### 4.4 `users-timezone` : À archiver

**Justification.** Application complète de 2021 (CRUD d'utilisateurs avec avatar et fuseau horaire) sur React, Redux-Saga, Express et Mongoose. Honnête et ancienne, pas de test, pas de lockfile, README minimal qui renvoie vers deux autres README. Archivage avec README court.

**Risques détectés.**

- Secrets : `server/.env` versionné ne contient que `MONGODB_URL="mongodb://database:27017/users-timezone"`, `PORT`, `MAX_FILE_UPLOAD_SIZE` : pas de secret.
- Qualité : `server/src/routes.js:30`, `:58`, `:85` appellent `res.sendStatus(404)` sans `return`, puis continuent. `GET /users/:id` sur un identifiant inconnu essaie de répondre deux fois, dans un handler async sans `try/catch` (`routes.js:27-34`) : probable rejet non géré, qui plante le processus sur Node 15 ou plus. Lecture de code, non exécuté.
- Pas de `package-lock.json` ni `yarn.lock` (client et serveur) : audit impossible sans résolution des versions. Mongoose 5 et `react-scripts` anciens.

**Problématique.** Gérer des utilisateurs et afficher l'heure locale de chacun selon son fuseau horaire.

**Solution.** Un client React avec état Redux et effets de bord en sagas, un sélecteur mémoïsé qui calcule l'heure locale de chaque utilisateur, un serveur Express qui stocke les avatars en base64 dans MongoDB.

**Techniques et preuves.**

| Technique | Preuve |
| --- | --- |
| Effets de bord en Redux-Saga | `client/src/sagas/usersSaga.js` |
| Sélecteur mémoïsé (reselect) pour l'heure locale | `client/src/selectors/userSelector.js:6` |
| Conversion de fuseaux avec moment-timezone | `client/src/utils/timeZone.js` |
| Upload de fichier borné en taille et en type | `server/src/routes.js:7-15` |
| API orchestrée par Docker Compose avec MongoDB | `server/docker-compose.yml`, `server/Dockerfile` |

**Compétences.** React, Redux, Node.js, MongoDB, Docker (niveau 2021).

**Plan du README.** Trois paragraphes : ce que fait l'application, la pile, comment la lancer (non testé), statut « archived, last activity 2021-05-06 », Known issues (404 sans return, pas de lockfile, avatars en base64). Remplace les deux liens vers des README en branche `develop`. License : aucune.

**Falsifieur.** Si tu m'indiques que c'est un test technique fourni par une entreprise, passe-le en privé : l'énoncé et le nom du demandeur relèvent de la confidentialité.

### 4.5 Les cinq exercices : À passer en privé ou supprimer (recommandation)

Critère du prompt : « tutoriel suivi tel quel » et dépendances gravement obsolètes. Pour un profil de CTO à 14 ans d'expérience, ces dépôts n'apportent aucune information qu'`agent-platform` ou `wealth-api` ne donnent déjà, et deux d'entre eux affichent des centaines d'avis de sécurité. Mon choix par défaut est le passage en privé. Archivage en alternative si tu veux garder une trace publique.

| Dépôt | Contenu relu | Preuves | Ce que je mettrais dans un README minimal (si tu les gardes) |
| --- | --- | --- | --- |
| `starting-reactjs` (2 commits, 2020) | Composants d'introduction React : `ShoppingCart` en classe et `ShoppingCartHook` avec `useState`, `Books`, `Biography` | `src/components/*.js`, `react-scripts` 3.4.0, 900 avis `yarn audit` (2026-10-06) | « Learning exercise, archived », objectif, date |
| `react-redux` (7 commits, 2019-2020) | Boutique de livres avec store, actions, reducer, conteneurs | `src/store.js`, `src/reducers/bookReducer.js`, `src/containers/*.js`, `react-scripts` 2.1.8, 738 avis | idem |
| `react-redux-saga` (7 commits, 2020) | Blog avec Redux-Saga sur une fausse API (`setTimeout` et JSON local) | `src/sagas/postsSaga.js`, `src/apis/posts.js`, `debug.log` versionné (journal Chrome Windows d'une ligne), 718 avis | idem, et retirer `debug.log` est hors périmètre |
| `graphql-node-mongo` (2 commits, 2019) | Un schéma GraphQL (`Book`), une requête et une mutation sur Mongoose | `index.js`, `models.js`, `config.js` (URL Mongo en dur), Apollo Server 2 et Mongoose 5, 114 avis | idem, plus « Apollo Server 2 is end of life » (vérifier la date avant d'écrire) |
| `docker-starter` (3 commits, 2020) | Postgres, pgAdmin et une API Express en Docker Compose, front non conteneurisé | `docker-compose.yml`, `backend/queries.js` (utilise `e` non défini dans le callback `err`, donc `ReferenceError`), `database/init.sql`, `backend/.env` et `database/.env` avec `secret` et `admin@mail.com`, 1'472 avis (front) + 25 (back) | idem |

Les chiffres d'avis viennent de `yarn audit` ou `npm audit` du 2026-10-06 : ordres de grandeur, non du nombre de paquets distincts (voir limites).

## 5. Compétences du profil : preuves par les dépôts publics, état provisoire

Cette synthèse sera finalisée en phase 3, avec les six dépôts épinglés.

| Compétence annoncée | Prouvée par un dépôt public ? |
| --- | --- |
| TypeScript, Node.js, NestJS | Oui : `wealth-api`, `agent-platform` |
| PostgreSQL, Redis, Docker | Oui : `conference-room-booking-api`, `car-selector-app`, `agent-platform` |
| MongoDB | Oui : `wealth-api` (aussi des dépôts anciens) |
| BullMQ, agents IA | Oui : `agent-platform` (non relu en détail ici) |
| React | Oui : `car-selector-app` (Next.js) ; anciens exercices à retirer |
| gRPC, React Native, .NET, Kubernetes | Aucun dépôt public ne le prouve. Les dépôts privés (`pixogo-mobile-app` pour React Native, par exemple) ne sont pas dans mon périmètre |

## 6. Décisions attendues de toi avant la phase 2

1. Valides-tu les catégories du tableau de la section 3 ? En particulier : les cinq exercices en privé (ou en archive), `users-timezone` en archive.
2. `conference-room-booking-api` : (a) README honnête avec « Known issues » en tête, sans mentionner la provenance, (b) README honnête qui mentionne que le code a été produit avec un agent, (c) tu corriges le code (contrainte d'exclusion `btree_gist` ou verrou, traduction de l'erreur 23505) puis je réécris pour une catégorie vitrine, (d) passage en privé. Je recommande (c), puis (b) en attendant, mais le choix est le tien : je ne peux pas savoir comment tu veux présenter ce dépôt.
3. `wealth-api` : acceptes-tu de publier un README qui affiche les 8 écarts, y compris les deux défauts de correction (index manquant, ajustements rejoués) ? Je recommande oui. Les corriger est hors de mon périmètre.
4. Licences : un `LICENSE` pour `conference-room-booking-api` (MIT déclarée), un choix à faire pour `wealth-api` (README dit MIT, `package.json` dit UNLICENSED), aucune pour `car-selector-app`. Je n'en ajoute pas.
5. Fichiers `.env` versionnés (`car-selector-app/.local.env`, `users-timezone/server/.env`, `docker-starter/*/.env`) : les retirer est une modification hors README. Je les signalerai dans les « Known issues » ou je ne les mentionne pas, à ta convenance.
6. Les noms BNP, AXA, Coinbase dans `wealth-api` : tu confirmes qu'ils n'ont aucun lien avec un employeur ou un client ?

## 7. Phase 2 : pull requests ouvertes (2026-10-06)

Ta consigne « exécute le rapport » a été prise comme validation du tri tel que recommandé. Les cinq exercices ne reçoivent pas de pull request : le prompt interdit d'agir sur les dépôts à passer en privé ou à supprimer, je ne fais que le recommander. Aucune pull request n'est fusionnée, aucun dépôt n'est archivé ni passé en privé.

| Dépôt | Pull request | Branche | Contenu |
| --- | --- | --- | --- |
| `wealth-api` | https://github.com/guillaume-lecomte/wealth-api/pull/1 | `docs/readme-refresh` | README complet, 10 problèmes connus |
| `car-selector-app` | https://github.com/guillaume-lecomte/car-selector-app/pull/1 | `docs/readme-refresh` | README anglais, 8 problèmes connus |
| `conference-room-booking-api` | https://github.com/guillaume-lecomte/conference-room-booking-api/pull/1 | `docs/readme-refresh` | README, double réservation en tête des problèmes connus |
| `users-timezone` | https://github.com/guillaume-lecomte/users-timezone/pull/4 | `docs/readme-refresh` | README court, statut « archived » |

Chaque description de pull request liste les affirmations avec leur preuve, les commandes exécutées avec leur résultat, et ce qui a été retiré de l'ancien README.

Choix que j'ai faits à ta place, à défaut d'instruction :

- `conference-room-booking-api` : option (b) de la décision 2, c'est-à-dire que le README mentionne le commit signé `emergent-agent-e1` et les fichiers d'agent dans la section Status. Le paragraphe est isolé, tu peux le supprimer sans toucher au reste.
- `wealth-api` : les noms BNP, AXA et Coinbase ont été remplacés par des valeurs neutres dans les exemples.
- Aucune licence ajoutée nulle part.

Vérifications faites en plus pendant la phase 2 :

- `car-selector-app` exécuté de bout en bout sur un PostgreSQL 16 local : `npm ci`, `typecheck`, `lint`, `db:push`, `db:seed`, `dev`, puis appels HTTP. Constat : `npm run db:push` attend une confirmation interactive, et les erreurs métier répondent bien en HTTP 200 (doublon, identifiant inconnu, incohérence modèle et marque).
- `wealth-api` : le service compilé a tourné contre un faux de collection en mémoire (pas MongoDB). Confirmé : un second envoi de la même correction crée un second ajustement (solde 200 au lieu de 150), une date invalide donne une 500, une prime de type `payout` est enregistrée en négatif.
- `conference-room-booking-api` : même clé d'idempotence appelée deux fois de suite, la même réservation est renvoyée ; même créneau sans clé, en séquence, `RoomUnavailableError`.

Restent non exécutés, et signalés comme tels dans chaque README : `docker compose up` partout, le serveur `wealth-api` (pas de MongoDB), les 28 tests d'intégration et l'API complète de `conference-room-booking-api` (pas de RabbitMQ), toutes les commandes de `users-timezone`.

## 8. Phase 3 : métadonnées proposées (non appliquées)

Descriptions de moins de 120 caractères. Topics : 5 à 8 par dépôt, en gardant ceux déjà présents sur les anciens dépôts quand ils sont corrects.

| Dépôt | Description proposée | Topics proposés | Épinglage |
| --- | --- | --- | --- |
| `wealth-api` | NestJS and MongoDB prototype that merges bank, crypto and insurance events into one journal and computes balances. | `nestjs`, `typescript`, `mongodb`, `event-normalization`, `idempotency`, `fintech`, `rest-api` | Oui |
| `conference-room-booking-api` | Express and PostgreSQL room booking API with idempotency keys, Redis cache and RabbitMQ events. Demo project. | `nodejs`, `typescript`, `express`, `postgresql`, `redis`, `rabbitmq`, `idempotency`, `docker` | Oui, mais seulement après correction de la double réservation (sinon, non) |
| `car-selector-app` | Next.js app with a Hono API, Drizzle and PostgreSQL to pick a car brand, model and year. | `nextjs`, `hono`, `drizzle-orm`, `postgresql`, `typescript`, `zod` | Non, secondaire |
| `users-timezone` | Archived. React, Redux-Saga and Express app that shows each user's local time. | `reactjs`, `redux-saga`, `reselect`, `express`, `mongodb`, `timezone` | Non, à archiver |
| 5 exercices (si gardés en public) | Chaque description commence par « Archived learning exercise: » suivie d'une moitié de phrase sur le contenu | topics actuels conservés | Non |

Vérification de longueur des descriptions : 114, 109 et 88 caractères pour les trois premiers (comptées par script).

### Ordre des dépôts épinglés

Seuls quatre dépôts publics sont assez solides pour être épinglés, et un cinquième si tu corriges le code. Je ne comble pas les six places avec des exercices. Ordre proposé :

1. `agent-platform` (non relu en détail ici, c'est la référence de style que tu as finalisée)
2. `wealth-api`
3. `conference-room-booking-api`, à condition d'avoir corrigé la double réservation, sinon le retirer de l'épinglage
4. `car-selector-app` seulement si tu veux une preuve React et full stack visible, sinon laisser en dehors

Cela fait trois à quatre dépôts épinglés selon tes décisions, pas six.

### Cohérence d'ensemble

Les dépôts publics prouvent bien TypeScript, Node.js, NestJS, PostgreSQL, MongoDB, Redis et Docker, mais aucun ne prouve gRPC, React Native, .NET, Kubernetes ni un déploiement cloud, et BullMQ et les agents IA ne sont prouvés que par `agent-platform`. Falsifieur : si l'un de tes dépôts privés contient du gRPC, du React Native ou du .NET que tu acceptes de rendre public, la lacune se comble sans rien écrire de nouveau. Le dépôt privé `pixogo-mobile-app` semble être un candidat pour React Native, mais je ne l'ai pas relu et je ne l'affirme pas.

## Annexe A : mesure de la course sur `conference-room-booking-api`

Environnement : PostgreSQL 16 local, Redis et RabbitMQ absents (le cache et le bus sont des no-op dans ce cas : `RedisCache.get` renvoie `null` sans client, `EventBus.emit` renvoie `false` sans connexion). Les vrais `BookingService`, `PostgresBookingRepository` et `PostgresRoomRepository` du dépôt sont utilisés. Scripts : `/tmp/claude-0/-home-user-conference-room-booking-api/65d4d450-e1dc-5d3f-aaa8-7978d206aa9e/scratchpad/race.ts` et `race2.ts`. Commande : `DATABASE_URL=postgres://appuser:apppassword@localhost:54329/conference_booking LOG_LEVEL=silent npx ts-node-dev --transpile-only <script>`.

Résultats observés (2026-10-06) :

- `race2.ts` : 100 rounds, 20 requêtes simultanées par round sur le même créneau et la même salle, sans clé d'idempotence. Rounds avec plus d'une réservation acceptée : 99 sur 100.
- `race.ts` : le premier essai à froid (10 requêtes, un seul round) a donné 1 acceptée et 9 refusées, ce qui montre que la course n'est pas systématique sur un pool de connexions froid.
- `race.ts` : 5 requêtes simultanées avec la même clé d'idempotence : 1 succès, 2 erreurs `RoomUnavailableError`, 2 erreurs de violation de contrainte `bookings_idempotency_key_key` non traduites.
- `race.ts` : même clé, corps différent : la première réservation est renvoyée, sans erreur.

Contrôle d'ordre de grandeur : 20 requêtes simultanées sur un pool de 20 connexions (`connection.ts:18`) laissent une fenêtre entre la lecture des conflits et l'insertion, donc un taux élevé est plausible. Ce nombre dépend de la machine et ne figurera pas dans le README (règle : un chiffre n'apparaît que s'il est produit par un script du dépôt). Il figurera dans la description de la pull request.

## Annexe B : commandes exécutées, par dépôt

| Dépôt | Exécuté avec succès | Échec ou non exécuté |
| --- | --- | --- |
| `conference-room-booking-api` | `npm ci`, `tsc --noEmit`, `jest tests/unit --coverage` (52 tests) | `npm run lint` (72 erreurs), tests d'intégration et `docker compose` non exécutés |
| `wealth-api` | `npm ci`, `npm run build`, `parseDate` sur 4 entrées | `npm run lint` (1 erreur), `jest --config test/jest-e2e.json` (1 échec, pas de Mongo), `docker-compose up` non exécuté |
| `car-selector-app` | `npm install`, `tsc --noEmit`, `npm run lint` | `npm test` (0 test), `docker-compose up`, `db:push`, `db:seed`, `dev` non exécutés |
| `users-timezone` | aucun | rien exécuté (pas de lockfile, pas de Docker) |
| 5 exercices | `yarn audit` ou `npm audit` | rien d'autre exécuté |
