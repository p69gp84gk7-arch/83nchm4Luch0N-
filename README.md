# Veille hôtels — Bagnères-de-Luchon

Chaque jour, un petit robot va chercher sur **Google Hotels** (par l'intermédiaire du service **SerpApi**) :

- le **prix par nuit** de chaque hôtel, **site par site** (Booking, Expedia, site de l'hôtel…), pour quelques dates de séjour ;
- la **note clients** et le **nombre d'avis** ;
- les infos de **restauration** (restaurant sur place, petit-déjeuner).

Il range tout dans des fichiers tableur (CSV) du dossier `data/`, et une **page web** affiche un graphique, un tableau comparatif et un comparateur.

---

## Comment ça marche (en 5 lignes)

1. `config.yaml` : la liste des hôtels, des dates de séjour, la fréquence. **C'est le seul fichier à modifier.**
2. `collecte.py` : le programme qui interroge SerpApi et ajoute des lignes aux fichiers de `data/`.
3. `.github/workflows/collecte.yml` : le « réveil » de GitHub (GitHub Actions) qui lance le programme chaque matin, gratuitement.
4. `data/*.csv` : l'historique. On ajoute des lignes, on n'efface jamais rien.
5. `index.html` : la page web, publiée gratuitement par GitHub Pages, qui lit les fichiers de `data/`.

---

## Installation pas à pas

### Étape 1 — Créer un compte SerpApi (gratuit)

1. Allez sur <https://serpapi.com/users/sign_up> et créez un compte (offre **Free**).
2. Une fois connecté, ouvrez <https://serpapi.com/manage-api-key> et **copiez votre clé API** (une longue suite de lettres et de chiffres).
3. **Ne collez jamais cette clé dans un fichier du dépôt.** Elle va uniquement dans les « secrets » GitHub (étape 2).

> **Offre gratuite (vérifiée en octobre 2026)** : 250 requêtes par mois, 50 par heure maximum.
> Seules les recherches réussies comptent. Le réglage par défaut en utilise **environ 155 par mois** (voir « Le budget de requêtes » plus bas).

### Étape 2 — Mettre la clé dans les secrets GitHub

Un « secret » GitHub est un coffre-fort : le robot peut lire la clé, mais personne ne la voit dans le code.

1. Sur la page de votre dépôt GitHub : **Settings** (Paramètres) → **Secrets and variables** → **Actions**.
2. Cliquez **New repository secret**.
3. **Name** : `SERPAPI_KEY` (exactement, en majuscules). **Secret** : collez votre clé. Cliquez **Add secret**.

### Étape 3 — Autoriser le robot à enregistrer les données

1. **Settings** → **Actions** → **General**.
2. Tout en bas, « Workflow permissions » : cochez **Read and write permissions**, puis **Save**.

### Étape 4 — Publier la page web (GitHub Pages)

1. **Settings** → **Pages**.
2. « Source » : **Deploy from a branch**. « Branch » : **main**, dossier **/ (root)**. **Save**.
3. Après une ou deux minutes, l'adresse de votre page s'affiche en haut de cette même page Settings → Pages
   (de la forme `https://<votre-nom>.github.io/<nom-du-dépôt>/`). Mettez-la dans vos favoris, sur votre téléphone aussi.

> GitHub Pages est gratuit pour un dépôt **public**. Pour un dépôt **privé**, il faut un abonnement GitHub payant.
> La clé SerpApi, elle, reste cachée dans tous les cas.

### Étape 5 — Premier lancement (l'essai à la main)

1. Onglet **Actions** du dépôt → à gauche **Collecte quotidienne** → bouton **Run workflow**.
2. Choisissez le mode **essai** → **Run workflow**. Attendez une minute, puis cliquez sur la ligne qui apparaît, puis sur **collecte** → **Lancer la collecte**.
3. Vous lisez le résultat pour **un hôtel et une date** : prix par site, note, restauration, et le compteur de requêtes. **Rien n'est enregistré.** Coût : 2 requêtes.
4. Si c'est bon, relancez **Run workflow** avec le mode **normal** : cette fois tous les hôtels sont relevés et enregistrés, et la page web se remplit.
5. Ensuite, plus rien à faire : le robot tourne seul chaque matin.

Les modes disponibles dans **Run workflow** :

| Mode | Ce qu'il fait | Coût |
|---|---|---|
| `essai` | 1 hôtel, 1 date, affiche le résultat, n'enregistre rien | 2 requêtes |
| `normal` | collecte complète maintenant | ~4 requêtes (+8 le jour des fiches) |
| `fiches` | collecte complète + fiches détaillées de tous les hôtels | ~12 requêtes |
| `quota` | affiche seulement le compteur SerpApi | gratuit |
| `auto` | collecte du jour seulement si elle n'a pas encore été faite (utilisé par la page) | ~4 requêtes, ou 0 si déjà faite |

---

## Lancer la collecte quand j'ouvre la page (facultatif)

Sans réglage, le robot passe **chaque matin**. Vous pouvez aussi demander à la page de le réveiller
**quand vous l'ouvrez**, si la collecte du jour n'a pas encore été faite.

**Réglage, une fois par appareil (ordinateur, téléphone…)** :
1. Sur la page, cadre « Collecte », cliquez **« Lancer à l'ouverture… »**.
2. Suivez les 5 étapes affichées pour créer une **clé GitHub** (« fine-grained personal access token ») :
   - accès à **ce dépôt seulement** ;
   - permissions **Actions : Read and write** et **Contents : Read-only** ;
   - expiration : 1 an (il faudra en recréer une ensuite ; la page vous préviendra : « clé refusée »).
3. Collez la clé, cliquez **« Enregistrer sur cet appareil »**.

**Ensuite, à chaque ouverture de la page** :
- collecte du jour déjà faite → la page l'indique (« ✓ Collecte du jour déjà faite ») et **ne relance rien** ;
- pas encore faite → la page lance le robot, affiche « Collecte en cours… » (environ 1 minute), puis se met à jour toute seule ;
- la collecte a échoué → la page affiche un lien vers le compte rendu et **ne réessaie pas toute seule**.

Ouvrir la page dix fois dans la journée ne coûte donc **rien de plus** : une seule collecte par jour.
Le bouton **« Relancer maintenant »** force une nouvelle collecte (il demande confirmation, car elle coûte environ 4 requêtes).

**Sécurité** : la clé est rangée seulement dans le navigateur de l'appareil, jamais dans le dépôt.
Elle ne permet que de lancer le robot et de lire les fichiers de ce dépôt.
Pour l'effacer : « Clé GitHub… » → « Oublier la clé ». Pour l'annuler partout : supprimez-la sur
<https://github.com/settings/personal-access-tokens>.

---

## Le budget de requêtes

Une « requête » = une question posée à SerpApi.

- **Chaque jour** : 1 requête par date de séjour suivie. Une seule requête donne les prix de **tous** les hôtels de Luchon pour cette date.
  → 4 dates × 30 jours = **120 requêtes/mois**.
- **Une fois par semaine** (le lundi par défaut) : 1 « fiche détaillée » par hôtel (plus de sites, étoiles, restauration, petit-déjeuner inclus, notes détaillées).
  → 8 hôtels × ~4,3 semaines = **~35 requêtes/mois**.
- **Total : ~155 requêtes/mois** sur 250. Il reste de la marge pour vos essais.

**Sécurités intégrées** :
- Avant chaque collecte, le programme regarde le compteur SerpApi (cela ne coûte rien).
- S'il risque de dépasser le quota, il saute d'abord les fiches détaillées, puis réduit le nombre de dates, et s'arrête si besoin.
- `marge_securite` dans `config.yaml` garde 15 requêtes en réserve.
- Le compteur « Requêtes SerpApi utilisées ce mois-ci » est affiché en haut de la page web, et chaque lancement est noté dans `data/usage.csv`.

Pour savoir combien coûtera un changement : **(nombre de dates × 30 ÷ fréquence en jours) + (nombre d'hôtels × 4,3)**.
Exemple : 6 dates tous les jours avec 10 hôtels = 180 + 43 = 223 → encore dans le gratuit, mais juste.

---

## Modifier les réglages (`config.yaml`)

Sur GitHub, ouvrez `config.yaml`, cliquez sur le crayon ✏️, modifiez, puis **Commit changes**. C'est tout.

### Ajouter ou retirer un hôtel

Ajoutez une ligne dans la liste `hotels` :

```yaml
  - nom: "Hôtel du Parc"
```

Pour retirer un hôtel, supprimez sa ligne (son historique reste dans les fichiers).

Si le robot écrit « non trouvé » pour un hôtel alors qu'il existe, c'est que Google l'affiche sous un autre nom.
Cherchez-le sur Google Hotels et ajoutez ce nom :

```yaml
  - nom: "Hôtel Céleste"
    autres_noms: ["Céleste Hôtel Luchon"]
```

Un hôtel peut aussi être « non trouvé » parce qu'il est **complet** ou **fermé** à la date demandée : c'est normal.

### Ajouter ou changer une date de séjour

```yaml
dates_sejour:
  - nom: "Week-end de Pâques"
    arrivee: "2027-03-27"     # date d'arrivée, format année-mois-jour
  - nom: "Dans 30 jours"
    arrivee: "+30"            # toujours 30 jours après le jour du relevé
```

- Une date passée est **ignorée automatiquement** (le robot le signale dans son compte rendu) : remplacez-la.
- Gardez le même `nom` si vous voulez que les courbes continuent sur la page.
- Chaque date en plus coûte ~30 requêtes par mois.

### Changer la fréquence

- `frequence_jours: 1` = tous les jours ; `2` = un jour sur deux ; `7` = une fois par semaine.
- `jour_fiches: 0` = fiches détaillées le lundi (1 = mardi … 6 = dimanche).

### Changer l'heure de lancement

Dans `.github/workflows/collecte.yml`, la ligne `- cron: "17 5 * * *"` veut dire « 5 h 17 UTC chaque jour »
(6 h 17 à Paris en hiver, 7 h 17 en été). Pour 20 h 30 à Paris en hiver : `"30 19 * * *"`.
GitHub lance parfois le robot avec quelques minutes (voire une heure) de retard : c'est normal.

---

## Lire la page web

**En haut** : la date de la **dernière mise à jour** et le **compteur de requêtes** du mois.

**Les réglages** (au-dessus du graphique, ils s'appliquent à toute la page) :
- **Séjour suivi** : la date de séjour à étudier (Noël, février…).
- **Du / Au** : la période des relevés affichés.
- **Site** : « Tous » = le prix le moins cher, tous sites confondus ; ou un site précis (ex. seulement Booking.com).
- **Courbes par** : une courbe par **hôtel**, ou une courbe par **catégorie** (moyenne des hôtels 2 étoiles, 3 étoiles…).

**Le graphique** : chaque point est le prix le plus bas relevé ce jour-là pour le séjour choisi. Touchez/survolez pour voir les valeurs. Cliquez un nom dans la légende pour masquer ou réafficher sa courbe.

**Le tableau comparatif**, pour chaque hôtel :
- **Prix le plus bas** sur la période (et à quelle date il a été vu) ;
- **Site le moins cher** au dernier relevé ;
- **Dernier prix** ;
- **Évolution** entre le premier et le dernier relevé de la période (▲ rouge = hausse, ▼ vert = baisse) ;
- **Note /10** (note Google sur 5 × 2) et **nombre d'avis** ;
- **Restaurant** et **petit-déjeuner** (« non indiqué » = Google ne donne pas l'information).

Cliquez un titre de colonne pour trier.

**Le comparateur** : cochez 2 hôtels ou plus dans la colonne « Comparer ». Ils s'affichent côte à côte avec les derniers prix **site par site** (le moins cher en gras, avec les offres : annulation gratuite, petit-déjeuner inclus, site officiel), la note détaillée et les équipements.

---

## Les fichiers de données (`data/`)

Ils s'ouvrent dans Excel, LibreOffice ou Google Sheets.

| Fichier | Contenu (une ligne = …) |
|---|---|
| `prix.csv` | un prix sur un site, un jour : `date_releve, hotel, sejour, date_sejour, site, prix_nuit_eur, offre, lien` |
| `avis.csv` | la note d'un hôtel, un jour : `date_releve, hotel, note, note_sur_10, nombre_avis, notes_detaillees` |
| `hotels.csv` | la fiche d'un hôtel à une date : `date_maj, hotel, nom_google, categorie_etoiles, restaurant_sur_place, petit_dejeuner_propose, equipements_principaux, property_token` (la page utilise la plus récente) |
| `usage.csv` | un lancement : requêtes utilisées par ce lancement, dans le mois, quota, requêtes restantes |

Deux colonnes ont été ajoutées par rapport au cahier des charges, pour rendre service :
`sejour` (le nom de la date suivie, utile pour « Dans 30 jours » dont la date change chaque jour)
et `property_token` (l'identifiant Google de l'hôtel, pour le retrouver à coup sûr).

---

## Bon à savoir (limites)

- Google Hotels ne montre **pas tous les sites** pour tous les hôtels. Les fiches détaillées du lundi en montrent davantage.
- Le **petit-déjeuner inclus** n'apparaît que dans les fiches détaillées, et seulement si le site le précise.
- « Restaurant / petit-déjeuner » est **déduit des équipements** listés par Google : c'est une indication, pas une garantie.
- Un hôtel peut être absent un jour donné (complet, fermé, ou absent de la première page de résultats).
  Si plusieurs hôtels manquent souvent, passez `pages_max` à `2` dans `config.yaml` (attention : cela double le coût quotidien).
- GitHub met en pause les automatismes d'un dépôt resté **60 jours sans aucune modification**. Ici, le robot enregistre des données chaque jour, donc cela n'arrive pas.

---

## Pour les curieux : lancer le programme sur son ordinateur

```bash
pip install -r requirements.txt
export SERPAPI_KEY="votre_clé"        # sous Windows : set SERPAPI_KEY=votre_clé
python collecte.py --essai            # 1 hôtel, 1 date, n'enregistre rien
python collecte.py --essai --hotel "Royal Luchon"
python collecte.py --quota            # compteur seul, gratuit
python collecte.py --forcer           # collecte complète
```

Pour voir la page sur son ordinateur : `python -m http.server`, puis ouvrir <http://localhost:8000>.

---

## Pour plus tard (pas encore fait)

Avis d'autres sites (Google Places, Tripadvisor), tarifs détaillés de la demi-pension, résumé des avis par IA, alertes par e-mail, autres stations (Peyragudes, Saint-Lary).
