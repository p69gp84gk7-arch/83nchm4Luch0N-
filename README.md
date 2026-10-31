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
| `apps-script/Chargeur.gs` | Le chargeur, collé **une seule fois** dans Apps Script : il lit le programme sur GitHub |
| `apps-script/Code.gs` | Le programme : collecte, automatisation, actions du menu, page web |
| `apps-script/Page.html` | La page web (graphique, tableau, comparateur) |

Le dépôt garde le code et son historique. Le chargeur du classeur lit le programme et la page dans la branche `main`.

---

## Le classeur

| Onglet | Contenu |
|---|---|
| **Synthèse** | Une ligne par hôtel : étoiles, dernier prix, site le moins cher, prix le plus bas et sa date, évolution, note sur 10, avis, restauration. Choisissez le séjour dans la cellule jaune. |
| **Réglages** | Hôtels suivis, dates de séjour, fréquence, heure, quota. **C'est le seul onglet à modifier.** |
| **Prix**, **Avis**, **Hôtels**, **Compteur** | Les relevés bruts, ajoutés par le script à chaque collecte. Rien n'est jamais effacé. |
| **Journal** | Le compte rendu de chaque collecte (hôtels trouvés ou « non trouvé », requêtes utilisées), le plus récent en haut. |
| **Sources** | D'où viennent les données. |

---

## Installation (une seule fois, environ 5 minutes)

Comme pour vos autres applications, on colle dans Apps Script un petit **chargeur**, une seule fois.
Il va lire le vrai programme sur GitHub et prend tout seul chaque nouvelle version.

### 1. La clé SerpApi

1. Créez un compte gratuit sur <https://serpapi.com/users/sign_up> (offre **Free** : 250 requêtes par mois ; le réglage de départ en utilise ~155).
2. Copiez votre clé sur <https://serpapi.com/manage-api-key>.
3. Dans le classeur, onglet **Réglages**, collez-la dans la cellule jaune **Clé SerpApi**
   (le script la rangera en lieu sûr et effacera la cellule).

### 2. Coller le chargeur

1. Dans le classeur : menu **Extensions → Apps Script**.
2. Ouvrez <https://raw.githubusercontent.com/p69gp84gk7-arch/83nchm4Luch0N-/main/apps-script/Chargeur.gs>, sélectionnez tout, copiez.
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

### (Facultatif) La page web avec graphique et comparateur

Une seule fois, dans l'éditeur Apps Script : **Déployer → Nouveau déploiement** → type **Application Web** →
« Exécuter en tant que » : **Moi**, « Qui a accès » : **Moi uniquement** → **Déployer**.
Gardez l'adresse (elle finit par `/exec`) dans vos favoris, sur téléphone aussi.

À l'ouverture, la page lance la collecte du jour si elle n'est pas faite, puis se met à jour toute seule.

---

## Le menu « Veille hôtels »

| Menu | Ce qu'il fait | Coût |
|---|---|---|
| Lancer la collecte maintenant | Collecte complète | ~4 requêtes (+8 le jour des fiches) |
| Essai | 1 hôtel, 1 date, n'enregistre rien | 2 requêtes |
| Collecte + fiches détaillées | Collecte complète + fiches de tous les hôtels | ~12 requêtes |
| Voir le compteur SerpApi | Ouvre le tableau de bord (compteur dans l'onglet Pilotage) | gratuit |
| Enregistrer la clé SerpApi | Remplace la clé (ou collez-la dans Réglages) | gratuit |
| Activer / Désactiver l'automatisation | Collecte quotidienne et à l'ouverture | — |
| Mettre à jour le programme depuis GitHub | Prend tout de suite la dernière version | gratuit |

---

## Le budget de requêtes

- **Chaque jour** : 1 requête par date de séjour (elle donne les prix de **tous** les hôtels de Luchon pour cette date) → 4 dates × 30 jours = **120/mois**.
- **Une fois par semaine** (lundi par défaut) : 1 fiche détaillée par hôtel (plus de sites, étoiles, restauration, petit-déjeuner inclus, notes détaillées) → 8 × ~4,3 = **~35/mois**.
- **Total ≈ 155/mois** sur 250.

Sécurités : avant chaque collecte, le script lit le compteur SerpApi (gratuit). S'il risque de dépasser le quota, il saute les fiches, puis réduit le nombre de dates, puis s'arrête. La « Réserve de requêtes » (15) reste pour vos essais.

Pour estimer un changement : **(dates × 30 ÷ fréquence) + (hôtels × 4,3)**.

---

## Modifier les réglages (onglet « Réglages »)

- **Ajouter un hôtel** : écrivez son nom sur une nouvelle ligne de la liste « Hôtels suivis ».
  S'il est « non trouvé », ajoutez dans « Autres noms » le nom exact affiché sur Google Hotels (plusieurs noms séparés par `;`).
  Un hôtel peut aussi être absent un jour parce qu'il est complet ou fermé.
- **Retirer un hôtel** : effacez sa ligne (son historique reste dans les onglets de données).
- **Dates de séjour** : une date d'arrivée par ligne, ou `+30` pour « dans 30 jours ». Une date passée est ignorée et signalée : remplacez-la. Gardez le même nom pour que les courbes continuent.
- **Fréquence**, **jour des fiches**, **quota**, **réserve** : se lisent à chaque collecte.
- **Heure de la collecte** : après un changement, refaites **Activer l'automatisation**.

---

## Le tableau de bord

Il **s'ouvre tout seul avec le classeur** (réglage « Ouvrir le tableau de bord à l'ouverture »), et à tout moment par le menu
**Veille hôtels → Voir le compteur SerpApi** (le compteur est en haut de l'onglet Pilotage).
Si la collecte du jour n'est pas faite, il la lance et se met à jour tout seul. La même page sert d'application Web sur téléphone (voir plus haut).

- **En haut** : date du dernier relevé, état de la collecte, bouton **Relancer la collecte**, puis le **séjour suivi** (Noël, février…) : un clic change toute la page.
- **Aperçu** : les indicateurs (le moins cher, prix médian, le mieux noté, hôtels avec un prix) et une **carte par hôtel** :
  photo, étoiles, note /10 et avis, prix le plus bas au dernier relevé et son site (avec le lien « voir l'offre »),
  évolution depuis le premier relevé (▲ hausse, ▼ baisse), mini-courbe, restaurant et petit-déjeuner.
  Une carte grisée = pas de prix pour ce séjour (complet, fermé ou non trouvé). Triez par prix, note, baisse ou nom.
- **Évolution** : le graphique des prix (période, site, courbes par hôtel ou par catégorie) et le tableau comparatif triable.
- **Comparer** : choisissez 2 hôtels ou plus (ou cochez « Comparer » sur les cartes) pour voir leurs prix site par site et leurs offres.
- **Pilotage** : lancer une collecte, une collecte avec fiches détaillées ou un essai sur un hôtel ; compteur SerpApi et estimation mensuelle ;
  résumé des réglages (bouton « Modifier les réglages ») ; journal des dernières collectes, avec le détail hôtel par hôtel.

---

## Bon à savoir

- Google Hotels ne montre pas tous les sites pour tous les hôtels ; les fiches détaillées du lundi en montrent davantage.
- « Restaurant / petit-déjeuner » est déduit des équipements listés par Google : c'est une indication.
- Une collecte prend environ une minute. Si deux collectes se croisent (ouverture + heure prévue), la seconde s'arrête aussitôt (« Une collecte est déjà en cours »).
- Après un an ou deux, l'onglet Prix devient gros (plusieurs dizaines de milliers de lignes) : la page web peut ralentir. On pourra alors archiver les vieux relevés dans un autre classeur.

---

## Pour plus tard (pas encore fait)

Avis d'autres sites (Google Places, Tripadvisor), tarifs détaillés de la demi-pension, résumé des avis par IA, alertes par e-mail, autres stations (Peyragudes, Saint-Lary).
