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
| `apps-script/Code.gs` | Le script du classeur : menu, collecte, automatisation, page web |
| `apps-script/Page.html` | La page web (graphique, tableau, comparateur) |

Le dépôt sert à garder le code et son historique. Ce qui tourne vraiment, c'est la copie collée dans le classeur.

---

## Le classeur

| Onglet | Contenu |
|---|---|
| **Synthèse** | Une ligne par hôtel : étoiles, dernier prix, site le moins cher, prix le plus bas et sa date, évolution, note sur 10, avis, restauration. Choisissez le séjour dans la cellule jaune. |
| **Réglages** | Hôtels suivis, dates de séjour, fréquence, heure, quota. **C'est le seul onglet à modifier.** |
| **Prix**, **Avis**, **Hôtels**, **Compteur** | Les relevés bruts, ajoutés par le script à chaque collecte. Rien n'est jamais effacé. |
| **Sources** | D'où viennent les données. |

---

## Installation : 3 gestes (environ 5 minutes)

Le classeur est déjà prêt (onglets, réglages, synthèse). Google ne permet à personne d'autre que vous
d'installer un script dans votre compte : ces 3 gestes sont le minimum.

### 1. Créer le compte SerpApi et coller la clé

1. Créez un compte gratuit sur <https://serpapi.com/users/sign_up> (offre **Free** : 250 requêtes par mois ; le réglage de départ en utilise ~155).
2. Copiez votre clé sur <https://serpapi.com/manage-api-key>.
3. Dans le classeur, onglet **Réglages**, collez-la dans la cellule jaune **Clé SerpApi**.
   (Le script la rangera en lieu sûr et effacera la cellule.)

### 2. Coller le script

1. Ouvrez <https://raw.githubusercontent.com/p69gp84gk7-arch/83nchm4Luch0N-/main/apps-script/Code.gs>, sélectionnez tout (Ctrl+A ou Cmd+A) et copiez.
2. Dans le classeur : menu **Extensions → Apps Script**.
3. Dans `Code.gs` : effacez tout, collez, puis **enregistrez** (icône disquette).

### 3. Cliquer sur « Exécuter »

1. En haut de l'éditeur, dans la liste des fonctions, choisissez **installer**, puis cliquez **Exécuter**.
2. Google demande d'autoriser le script (comme pour vos autres scripts) :
   **Examiner les autorisations → votre compte → Paramètres avancés → Accéder à … (non sécurisé) → Autoriser**.
3. En une minute, le script :
   - range la clé et la vérifie ;
   - programme la collecte **chaque jour** (7 h) et **à l'ouverture du classeur** si celle du jour n'est pas faite ;
   - lance la **première collecte** : les onglets Prix, Avis, Hôtels et la Synthèse se remplissent.

Le résultat s'affiche dans le journal en bas de l'éditeur et dans la case **Dernière collecte** des Réglages.
C'est fini : plus rien à faire. Rechargez le classeur pour voir aussi le menu **Veille hôtels**.

### (Facultatif) La page web avec graphique et comparateur

1. Dans l'éditeur Apps Script : **+** → **HTML**, nommez-le exactement `Page`, collez le contenu de
   <https://raw.githubusercontent.com/p69gp84gk7-arch/83nchm4Luch0N-/main/apps-script/Page.html>, enregistrez.
2. **Déployer → Nouveau déploiement** → type **Application Web** → « Exécuter en tant que » : **Moi**,
   « Qui a accès » : **Moi uniquement** → **Déployer**. Gardez l'adresse (elle finit par `/exec`) dans vos favoris.

À l'ouverture, la page lance la collecte du jour si elle n'est pas faite, puis se met à jour toute seule.

> Après une modification du script, la page garde l'ancienne version tant que vous n'avez pas fait
> **Déployer → Gérer les déploiements → ✏️ → Version : Nouvelle version → Déployer**.

---

## Le menu « Veille hôtels »

| Menu | Ce qu'il fait | Coût |
|---|---|---|
| Lancer la collecte maintenant | Collecte complète | ~4 requêtes (+8 le jour des fiches) |
| Essai | 1 hôtel, 1 date, n'enregistre rien | 2 requêtes |
| Collecte + fiches détaillées | Collecte complète + fiches de tous les hôtels | ~12 requêtes |
| Voir le compteur SerpApi | Requêtes utilisées et restantes ce mois-ci | gratuit |
| Enregistrer la clé SerpApi | Remplace la clé (ou collez-la dans Réglages) | gratuit |
| Activer / Désactiver l'automatisation | Collecte quotidienne et à l'ouverture | — |

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

## Lire la page web

- **En haut** : dernière mise à jour, compteur de requêtes, état de la collecte, lien vers le classeur.
- **Réglages de la page** : séjour suivi, période (Du / Au), site (tous ou un seul), courbes par hôtel ou par catégorie.
- **Graphique** : le prix le plus bas relevé chaque jour pour le séjour choisi. Touchez une courbe pour voir les valeurs ; cliquez un nom de la légende pour le masquer.
- **Tableau comparatif** : prix le plus bas (et sa date), site le moins cher, dernier prix, évolution (▲ hausse, ▼ baisse), note /10, avis, restauration. Cliquez un titre pour trier.
- **Comparateur** : cochez 2 hôtels ou plus ; ils s'affichent côte à côte avec les prix site par site et les offres (annulation gratuite, petit-déjeuner inclus, site officiel).

---

## Bon à savoir

- Google Hotels ne montre pas tous les sites pour tous les hôtels ; les fiches détaillées du lundi en montrent davantage.
- « Restaurant / petit-déjeuner » est déduit des équipements listés par Google : c'est une indication.
- Une collecte prend environ une minute. Si deux collectes se croisent (ouverture + heure prévue), la seconde s'arrête aussitôt (« Une collecte est déjà en cours »).
- Après un an ou deux, l'onglet Prix devient gros (plusieurs dizaines de milliers de lignes) : la page web peut ralentir. On pourra alors archiver les vieux relevés dans un autre classeur.

---

## Pour plus tard (pas encore fait)

Avis d'autres sites (Google Places, Tripadvisor), tarifs détaillés de la demi-pension, résumé des avis par IA, alertes par e-mail, autres stations (Peyragudes, Saint-Lary).
