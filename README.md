# Veille hôtels — Bagnères-de-Luchon

Un classeur **Google Sheets** avec un script **Apps Script** qui, chaque jour, va chercher sur **Google Hotels** (via le service **SerpApi**) :

- le **prix par nuit** de chaque hôtel, **site par site** (Booking, Expedia, site de l'hôtel…), pour quelques dates de séjour ;
- la **note clients** et le **nombre d'avis** ;
- les infos de **restauration** (restaurant sur place, petit-déjeuner).

Tout est enregistré dans le classeur, qui sert de base de données. Une **page web** (facultative) affiche un graphique, un tableau comparatif et un comparateur.

Le classeur : **Veille hôtels Luchon – base de données**, dans votre Google Drive.

---

## Pourquoi une clé SerpApi ?

Vos autres scripts Apps Script travaillent sur **vos** données Google (classeurs, Gmail, Agenda) : pas besoin de clé.
Les prix de Booking, Expedia ou Google Hotels ne sont pas vos données, et Google ne les donne pas à Apps Script.
SerpApi les récupère pour nous : c'est la **seule** clé de l'outil, et elle se colle une seule fois dans le menu du classeur.

---

## Ce que contient ce dépôt

| Fichier | Rôle |
|---|---|
| `apps-script/Code.gs` | Le **chargeur**, collé **une seule fois** dans Apps Script : il lit le programme sur GitHub |
| `apps-script/Programme.gs` | Le programme : collecte, automatisation, actions du menu, tableau de bord |
| `apps-script/appsscript.json` | Réglages du projet Apps Script ; sert aussi à mettre à jour les toutes premières installations |
| `index.html` | **La page web** (tableau de bord), publiée sur GitHub Pages et aussi ouverte dans le classeur |

Le dépôt garde le code et son historique. Le chargeur du classeur lit le programme et la page dans la branche `main`.
Les installations plus anciennes (programme collé directement, premier chargeur) passent toutes seules au chargeur actuel au premier clic sur « Mettre à jour » du menu.

---

## Le classeur

| Onglet | Contenu |
|---|---|
| **Synthèse** | Une ligne par hôtel : étoiles, dernier prix, site le moins cher, prix le plus bas et sa date, évolution, note sur 10, avis, restauration. Choisissez le séjour dans la cellule jaune. |
| **Réglages** | Hôtels suivis, dates de séjour, fréquence, heure, quota. **C'est le seul onglet à modifier.** |
| **Prix**, **Avis**, **Hôtels**, **Compteur** | Les relevés bruts, ajoutés par le script à chaque collecte. Rien n'est jamais effacé. |
| **Établissements** | Tous les établissements renvoyés par Google à chaque collecte (suivis ou non), avec position GPS, prix et note : ils alimentent la carte. |
| **Avis par site** | Note et nombre d'avis de chaque hôtel sur Google, Booking, Tripadvisor, Expedia… (relevés dans les fiches détaillées). |
| **Thèmes des avis** | Mentions positives / négatives par thème (chambres, petit-déjeuner, service…). |
| **Avis clients** | Avis récents : note, sous-notes, réponse de l'hôtel, extrait (sans le nom des auteurs). |
| **Journal** | Le compte rendu de chaque collecte (hôtels trouvés ou « non trouvé », requêtes utilisées), le plus récent en haut. |
| **Sources** | D'où viennent les données. |

---

## Installation (une seule fois, environ 5 minutes)

Comme pour vos autres applications, on colle dans Apps Script un petit **chargeur**, une seule fois.
Il va lire le vrai programme sur GitHub et prend tout seul chaque nouvelle version.

### 1. La clé SerpApi

1. Créez un compte gratuit sur <https://serpapi.com/users/sign_up> (offre **Free** : 250 requêtes par mois ; le réglage de départ en utilise ~210).
2. Copiez votre clé sur <https://serpapi.com/manage-api-key>.
3. Dans le classeur, onglet **Réglages**, collez-la dans la cellule jaune **Clé SerpApi**
   (le script la rangera en lieu sûr et effacera la cellule).

### 2. Coller le chargeur

1. Dans le classeur : menu **Extensions → Apps Script**.
2. Ouvrez <https://raw.githubusercontent.com/p69gp84gk7-arch/83nchm4Luch0N-/main/apps-script/Code.gs>, sélectionnez tout, copiez.
3. Dans `Code.gs` : effacez **tout**, collez, puis **enregistrez** (icône disquette).

### 3. Exécuter « installer »

1. En haut de l'éditeur, la liste des fonctions affiche **installer** (c'est la première du fichier). Cliquez **Exécuter**.
2. Google demande d'autoriser le script : **Examiner les autorisations → votre compte → Paramètres avancés → Accéder à … (non sécurisé) → Autoriser**.
3. En une minute : la clé est rangée, la collecte est programmée **chaque jour** (7 h) et **à l'ouverture du classeur**, et la **première collecte** remplit les onglets.

Le journal en bas de l'éditeur doit finir par « Collecte enregistrée : … ».
Les cases **Dernière collecte** et **Mise à jour du script** des Réglages montrent le résultat. Rechargez le classeur pour voir le menu **Veille hôtels**.

---

## Les mises à jour

Plus jamais de copier-coller :

1. Je propose une modification dans une **pull request** sur GitHub.
2. Vous la relisez et cliquez **Merge** : c'est votre feu vert.
3. Au plus tard **10 minutes** après, le chargeur prend la nouvelle version tout seul.
   Pour la prendre tout de suite : menu **Veille hôtels → Mettre à jour le programme depuis GitHub**.

Sécurités : un programme qui contient une erreur n'est jamais pris (l'ancien reste en service), et une copie
du dernier programme est gardée dans le script : si GitHub ne répond pas, tout continue.
La case **Mise à jour du script** des Réglages indique quand une nouvelle version a été prise.

La page web, elle aussi, est lue sur GitHub à chaque ouverture : **pas besoin de la redéployer** après une mise à jour.

---

### 4. La page web sur GitHub Pages (une fois)

L'adresse de la page : **<https://p69gp84gk7-arch.github.io/83nchm4Luch0N-/>** (sur ordinateur et téléphone).
Pour qu'elle lise les données du classeur, il faut **déployer l'application Web** du script, une seule fois :

1. Dans le classeur : **Extensions → Apps Script**.
2. En haut à droite : **Déployer → Nouveau déploiement**. Roue dentée « Sélectionner le type » → **Application Web**.
3. « Exécuter en tant que » : **Moi**. « Qui a accès » : **Tout le monde**. Cliquez **Déployer**, autorisez si demandé.
4. Copiez l'**adresse de l'application Web** (elle finit par `/exec`).
5. Ouvrez la page GitHub, collez l'adresse dans « Relier la page au classeur », cliquez **Relier**
   (ou envoyez-la pour qu'elle soit inscrite une fois pour toutes dans `index.html`, ligne `const URL_API`).

Plus jamais besoin de redéployer : le chargeur prend toujours la dernière version du programme et de la page.

**Sécurité** : lire les prix est libre (ce sont des informations publiques). Relancer une collecte, faire un essai ou
toutes les fiches depuis la page demande le **code d'accès** de l'onglet Réglages (demandé une fois, puis mémorisé
sur l'appareil). La collecte du jour, lancée à l'ouverture de la page, n'en demande pas : elle respecte la fréquence
et le garde-fou du quota, donc elle ne coûte rien de plus. Changez le code quand vous voulez dans les Réglages.

---

## Le menu « Veille hôtels »

| Menu | Ce qu'il fait | Coût |
|---|---|---|
| Ouvrir le tableau de bord | Aperçu, évolution, comparaison, pilotage (voir plus bas) | gratuit |
| Lancer la collecte maintenant | Collecte complète | ~6 requêtes |
| Essai | 1 hôtel, 1 date, n'enregistre rien | 2 requêtes |
| Collecte + fiches détaillées | Collecte complète + fiches de tous les hôtels | ~12 requêtes |
| Enregistrer la clé SerpApi | Remplace la clé (ou collez-la dans Réglages) | gratuit |
| Activer / Désactiver l'automatisation | Collecte quotidienne et à l'ouverture | — |
| Mettre à jour le programme depuis GitHub | Prend tout de suite la dernière version | gratuit |

---

## Le budget de requêtes

- **Chaque jour** : 1 requête par date de séjour (elle donne les prix de **tous** les hôtels de Luchon pour cette date) → 4 dates × 30 jours = **120/mois**.
- **Chaque jour, 2 fiches détaillées** (réglage « Fiches détaillées par jour ») : le prix **site par site** (Booking, Expedia, site de l'hôtel…), le petit-déjeuner inclus, les étoiles et les notes détaillées, pour un couple hôtel + date. Les hôtels et les dates passent **à tour de rôle** (le plus ancien d'abord) : avec 8 hôtels, chacun est détaillé tous les 4 jours environ → 2 × 30 = **60/mois**.
- **Chaque jour, 1 relevé d'avis récents** (réglage « Avis récents par jour ») : les derniers avis d'un hôtel, à tour de rôle → **30/mois**.
- **Total ≈ 210/mois** sur 250 (réserve de 15 comprise, le garde-fou réduit d'abord les avis récents, puis les fiches, puis les dates).

### Que se passe-t-il si on dépasse 250 ?

SerpApi refuse simplement les recherches suivantes jusqu'au mois suivant (message « plus de recherches disponibles »).
L'offre gratuite ne demande pas de carte bancaire : rien n'est facturé. Mais il n'y aurait plus de relevés jusqu'à la remise à zéro.

### Pourquoi ça n'arrivera pas

Avant **chaque** collecte (automatique, à l'ouverture, bouton, menu ou essai), le script :

1. lit les requêtes restantes sur le compte SerpApi (gratuit) ; si SerpApi ne répond pas, il les estime avec l'onglet **Compteur** ;
2. garde toujours la **Réserve de requêtes** des Réglages (15) : elle n'est jamais entamée ;
3. calcule le **besoin d'ici la fin du mois** avec les réglages actuels ; si le rythme ne tient pas, il réduit tout seul :
   d'abord les **fiches détaillées**, puis le **nombre de dates** (celles du **haut** de la liste des Réglages passent en premier) ;
4. ne fait jamais plus de 45 requêtes d'un coup (SerpApi en accepte 50 par heure) ;
5. s'arrête net quand il ne reste que la réserve : « Quota SerpApi atteint… pas de collecte avant le mois prochain ».

Chaque décision est notée dans l'onglet **Journal** (lignes « Budget » et « Économie de requêtes »).
L'onglet **Pilotage** du tableau de bord affiche le besoin estimé d'ici la fin du mois face aux requêtes restantes.

Pour estimer un changement : **(dates + fiches par jour + avis récents par jour) × 30 ÷ fréquence**.

---

## Modifier les réglages (onglet « Réglages »)

- **Ajouter un hôtel** : écrivez son nom sur une nouvelle ligne de la liste « Hôtels suivis ».
  S'il est « non trouvé », ajoutez dans « Autres noms » le nom exact affiché sur Google Hotels (plusieurs noms séparés par `;`).
  Un hôtel peut aussi être absent un jour parce qu'il est complet ou fermé.
- **Retirer un hôtel** : effacez sa ligne (son historique reste dans les onglets de données).
- **Dates de séjour** : une date d'arrivée par ligne, ou `+30` pour « dans 30 jours ». Une date passée est ignorée et signalée : remplacez-la. Gardez le même nom pour que les courbes continuent.
- **Fréquence**, **fiches détaillées par jour**, **quota**, **réserve** : se lisent à chaque collecte.
- **Heure de la collecte** : après un changement, refaites **Activer l'automatisation**.

---

## Le tableau de bord

Il **s'ouvre tout seul avec le classeur** (réglage « Ouvrir le tableau de bord à l'ouverture »), et à tout moment par le menu
**Veille hôtels → Ouvrir le tableau de bord** (le compteur SerpApi est dans l'onglet Pilotage).
Si la collecte du jour n'est pas faite, il la lance et se met à jour tout seul. La même page est publiée sur GitHub Pages (voir « La page web sur GitHub Pages »).

- **En haut** : date du dernier relevé, état de la collecte, bouton **Relancer la collecte**, puis le **séjour suivi** (Noël, février…) : un clic change toute la page.
- **Ajouter une date de séjour** : bouton **« + Comparer une date »** à côté des séjours : date d'arrivée, nom facultatif, et
  relevé immédiat des prix de tous les hôtels (1 requête). La date est ensuite suivie à chaque collecte ; on la retire dans le Pilotage
  (son historique est gardé). Sur la page GitHub, le code d'accès est demandé.
- **Aperçu** : les indicateurs (le moins cher, prix médian, le mieux noté, hôtels avec un prix) et une **carte par hôtel** :
  photo, étoiles, note /10 et avis, prix le plus bas au dernier relevé et son site (avec le lien « voir l'offre »),
  évolution depuis le premier relevé (▲ hausse, ▼ baisse), mini-courbe, restaurant et petit-déjeuner.
  Une carte grisée = pas de prix pour ce séjour (complet, fermé ou non trouvé). Triez par prix, note, baisse ou nom.
- **Benchmark** : le tableau professionnel du jeu concurrentiel, pour le séjour choisi, uniquement avec des données relevées :
  prix et **indice de prix** (100 = médiane), **offres** (séjours avec un prix), **note multi-sites** (Google, Booking, Tripadvisor…
  ramenées sur 10 et pondérées par le nombre d'avis), nombre d'avis tous sites, note de chaque site, note d'**emplacement**,
  **mentions positives** des avis, **taux de réponse aux avis**, **parité** site officiel / agences, petit-déjeuner inclus,
  annulation gratuite, prix habituel. Meilleur de chaque colonne en gras, tri par colonne, **export CSV** (Excel).
  Plus : deux **graphiques en colonnes**, la **satisfaction des clients** (part de mentions positives) et la **répartition des avis
  par étoiles** ; posez le doigt sur une colonne (ou glissez) : le détail s'affiche, et disparaît quand le doigt se lève.
  Puis le **positionnement prix / satisfaction** (graphique à quadrants), les **points forts et faibles** de chaque hôtel
  (thèmes des avis) et les **avis récents** (note, sous-notes, réponse de l'hôtel, extrait ; sans le nom des auteurs).
- **Évolution** : le graphique des prix (période, site, courbes par hôtel ou par catégorie) et le tableau comparatif triable.
- **Comparer** : choisissez 2 hôtels ou plus (ou cochez « Comparer » sur les cartes) pour voir leurs prix site par site et leurs offres.
- **Carte** : la **zone de chalandise** (un cercle autour de Luchon) : **curseur** pour l'élargir ou la réduire (0,5 à 20 km),
  **point central à glisser** pour la déplacer, bouton **« Enregistrer cette zone »** (pour tous les appareils), les **hôtels suivis**
  (leur couleur ; clic = prix du séjour choisi, note, distance au centre, « hors zone ») et, en gris, les **autres établissements**
  trouvés par Google au dernier relevé (gris plein, avec prix et note) ainsi que **tous les hébergements de la zone connus
  d'OpenStreetMap** (gris vide : hôtels, chambres d'hôtes, résidences…, même ceux que Google ne renvoie pas). Les positions viennent
  de Google Hotels et d'OpenStreetMap, sans requête SerpApi en plus. Bouton **« Suivre cet hôtel »** dans la bulle : il est ajouté
  aux Réglages (code d'accès demandé sur la page GitHub) et recherché sur Google Hotels à la prochaine collecte.
- **Pilotage** : lancer une collecte, une collecte avec fiches détaillées ou un essai sur un hôtel ; compteur SerpApi et estimation mensuelle ;
  résumé des réglages (bouton « Modifier les réglages ») ; journal des dernières collectes, avec le détail hôtel par hôtel.

---

## Le site Internet des hôteliers

- Chaque fiche d'hôtel a un bouton **« Site de l'hôtel »** (et **« Appeler »**), d'après Google Hotels.
- Le **prix pratiqué sur le site de l'hôtel** est affiché quand Google Hotels le relève (offre « site officiel », venant du moteur de
  réservation de l'hôtel) : sur la fiche (« Sur le site de l'hôtel : … € ») et dans le Benchmark (colonnes « Prix site de l'hôtel » et
  « Parité officiel / agences »).
- Lire directement les prix sur chaque site d'hôtel demanderait un programme différent pour chaque moteur de réservation, fragile et
  souvent contraire à leurs conditions d'utilisation : l'outil s'appuie donc sur ce que Google Hotels collecte auprès des hôtels.

## Bon à savoir

- La recherche quotidienne par ville ne donne qu'**un prix par hôtel** (« Google (prix le plus bas) ») : le détail **site par site** vient des fiches détaillées, faites à tour de rôle.
- Un hôtel absent des premiers résultats de Google fait l'objet d'une **recherche ciblée** sur son nom (au plus 2 par collecte, une fois par semaine par hôtel ; le Journal montre les noms proposés par Google). S'il reste introuvable, ajoutez dans « Autres noms » le nom exact affiché sur Google Hotels.
- « Restaurant / petit-déjeuner » est déduit des équipements listés par Google : c'est une indication.
- Une collecte prend environ une minute. Si deux collectes se croisent (ouverture + heure prévue), la seconde s'arrête aussitôt (« Une collecte est déjà en cours »).
- Après un an ou deux, l'onglet Prix devient gros (plusieurs dizaines de milliers de lignes) : la page web peut ralentir. On pourra alors archiver les vieux relevés dans un autre classeur.

---

## Pour plus tard (pas encore fait)

Avis d'autres sites (Google Places, Tripadvisor), tarifs détaillés de la demi-pension, résumé des avis par IA, alertes par e-mail, autres stations (Peyragudes, Saint-Lary).
