"""
Veille hôtels Bagnères-de-Luchon — script de collecte.

Ce script :
  1. lit les réglages dans config.yaml ;
  2. interroge Google Hotels via SerpApi (une seule clé API) ;
  3. ajoute les résultats à la fin des fichiers CSV du dossier data/
     (on n'efface jamais rien, pour garder l'historique).

Utilisation :
  python collecte.py            -> collecte normale (celle lancée chaque jour)
  python collecte.py --essai    -> essai : 1 hôtel, 1 date, affiche le résultat,
                                   n'écrit rien dans data/ (coûte 2 requêtes)
  python collecte.py --fiches   -> force la mise à jour des fiches détaillées
  python collecte.py --forcer   -> lance même si la fréquence dit « pas aujourd'hui »
  python collecte.py --quota    -> affiche seulement le compteur de requêtes (gratuit)

La clé SerpApi est lue dans la variable d'environnement SERPAPI_KEY
(dans GitHub, elle vient des « secrets » ; elle n'est jamais écrite dans le code).
"""

import argparse
import csv
import difflib
import os
import re
import sys
import unicodedata
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests
import yaml

DOSSIER = Path(__file__).resolve().parent
DOSSIER_DATA = DOSSIER / "data"
URL_RECHERCHE = "https://serpapi.com/search.json"
URL_COMPTE = "https://serpapi.com/account.json"  # consulter son compte ne coûte rien

# Colonnes de chaque fichier CSV (l'ordre compte)
COLONNES = {
    "prix.csv": ["date_releve", "hotel", "sejour", "date_sejour", "site",
                 "prix_nuit_eur", "offre", "lien"],
    "avis.csv": ["date_releve", "hotel", "note", "note_sur_10", "nombre_avis",
                 "notes_detaillees"],
    "hotels.csv": ["date_maj", "hotel", "nom_google", "categorie_etoiles",
                   "restaurant_sur_place", "petit_dejeuner_propose",
                   "equipements_principaux", "property_token"],
    "usage.csv": ["date_releve", "requetes_ce_lancement", "requetes_ce_mois",
                  "quota_mois", "requetes_restantes"],
}


# ---------------------------------------------------------------------
# Petits outils
# ---------------------------------------------------------------------

def lire_config():
    with open(DOSSIER / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def lire_csv(nom):
    """Renvoie les lignes d'un CSV de data/ (liste de dictionnaires)."""
    chemin = DOSSIER_DATA / nom
    if not chemin.exists():
        return []
    with open(chemin, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def ajouter_csv(nom, lignes):
    """Ajoute des lignes À LA FIN d'un CSV (crée le fichier et l'en-tête si besoin)."""
    if not lignes:
        return
    DOSSIER_DATA.mkdir(exist_ok=True)
    chemin = DOSSIER_DATA / nom
    nouveau = not chemin.exists() or chemin.stat().st_size == 0
    with open(chemin, "a", encoding="utf-8", newline="") as f:
        ecrivain = csv.DictWriter(f, fieldnames=COLONNES[nom], extrasaction="ignore")
        if nouveau:
            ecrivain.writeheader()
        ecrivain.writerows(lignes)


def simplifier(texte):
    """Met un nom d'hôtel sous une forme simple pour pouvoir comparer :
    minuscules, sans accents, sans « hôtel », « le », « spa »…"""
    texte = unicodedata.normalize("NFD", texte.lower())
    texte = "".join(c for c in texte if unicodedata.category(c) != "Mn")
    texte = re.sub(r"[^a-z0-9]+", " ", texte)
    mots_inutiles = {"hotel", "hotels", "le", "la", "les", "de", "des", "du", "d",
                     "l", "et", "spa", "luchon", "bagneres", "the", "and"}
    return [m for m in texte.split() if m not in mots_inutiles]


def ressemblance(nom_a, nom_b):
    """Note de 0 à 1 : à quel point deux noms d'hôtels se ressemblent."""
    a, b = simplifier(nom_a), simplifier(nom_b)
    if not a or not b:
        return 0.0
    commun = len(set(a) & set(b)) / len(set(a) | set(b))
    proche = difflib.SequenceMatcher(None, " ".join(a), " ".join(b)).ratio()
    return max(commun, proche)


def prix_nuit(bloc):
    """Extrait le prix par nuit (nombre) d'un bloc de prix SerpApi."""
    tarif = bloc.get("rate_per_night") or {}
    for cle in ("extracted_lowest", "extracted_display_price", "extracted_before_taxes_fees"):
        if isinstance(tarif.get(cle), (int, float)):
            return round(float(tarif[cle]), 2)
    return None


# ---------------------------------------------------------------------
# Appels à SerpApi
# ---------------------------------------------------------------------

class Compteur:
    """Compte les requêtes payantes faites pendant ce lancement."""
    n = 0


def appeler_serpapi(params):
    """Fait UNE requête Google Hotels (compte pour 1 dans le quota)."""
    params = dict(params, engine="google_hotels", api_key=os.environ["SERPAPI_KEY"],
                  currency="EUR", gl="fr", hl="fr")
    reponse = requests.get(URL_RECHERCHE, params=params, timeout=90)
    Compteur.n += 1
    donnees = reponse.json()
    if "error" in donnees:
        raise RuntimeError(f"SerpApi a répondu : {donnees['error']}")
    return donnees


def lire_compte():
    """Interroge le compte SerpApi (gratuit) : requêtes utilisées / restantes."""
    try:
        r = requests.get(URL_COMPTE, params={"api_key": os.environ["SERPAPI_KEY"]}, timeout=30)
        r.raise_for_status()
        return r.json()
    except Exception as e:  # le compteur n'est pas indispensable
        print(f"  (impossible de lire le compteur SerpApi : {e})")
        return {}


def rechercher_ville(cfg, arrivee, depart):
    """Recherche « hôtels <ville> » pour une date : renvoie la liste des établissements."""
    proprietes, jeton_page = [], None
    for _ in range(int(cfg["budget"].get("pages_max", 1))):
        params = {"q": f"hôtels {cfg['ville']}", "check_in_date": arrivee,
                  "check_out_date": depart, "adults": cfg["adultes"]}
        if jeton_page:
            params["next_page_token"] = jeton_page
        donnees = appeler_serpapi(params)
        proprietes += donnees.get("properties", [])
        jeton_page = (donnees.get("serpapi_pagination") or {}).get("next_page_token")
        if not jeton_page:
            break
    return proprietes


def fiche_hotel(cfg, jeton, arrivee, depart):
    """Fiche détaillée d'un hôtel (tous les sites, notes détaillées, équipements)."""
    return appeler_serpapi({"property_token": jeton, "check_in_date": arrivee,
                            "check_out_date": depart, "adults": cfg["adultes"]})


# ---------------------------------------------------------------------
# Lecture des réponses
# ---------------------------------------------------------------------

def associer_hotels(hotels_cfg, proprietes, jetons_connus):
    """Retrouve chaque hôtel de config.yaml dans les résultats Google.
    Renvoie {nom_config: propriete}."""
    # 1) d'abord par identifiant Google déjà connu (le plus fiable)
    trouves, utilises = {}, set()
    for h in hotels_cfg:
        jeton = jetons_connus.get(h["nom"])
        for p in proprietes:
            if jeton and p.get("property_token") == jeton:
                trouves[h["nom"]] = p
                utilises.add(id(p))
    # 2) puis par ressemblance des noms, les meilleures paires d'abord
    paires = []
    for h in hotels_cfg:
        if h["nom"] in trouves:
            continue
        noms = [h["nom"]] + list(h.get("autres_noms") or [])
        for p in proprietes:
            if id(p) in utilises:
                continue
            score = max(ressemblance(n, p.get("name", "")) for n in noms)
            if score >= 0.6:
                paires.append((score, h["nom"], p))
    for score, nom, p in sorted(paires, key=lambda x: -x[0]):
        if nom not in trouves and id(p) not in utilises:
            trouves[nom] = p
            utilises.add(id(p))
    return trouves


def offres(bloc):
    """Liste les avantages d'une offre : annulation gratuite, petit-déjeuner inclus…"""
    textes = []
    if bloc.get("official"):
        textes.append("site officiel de l'hôtel")
    if bloc.get("free_cancellation"):
        jusqu = bloc.get("free_cancellation_until_date")
        textes.append("annulation gratuite" + (f" jusqu'au {jusqu}" if jusqu else ""))
    # Le petit-déjeuner se cache dans le détail des chambres (fiches détaillées)
    for chambre in bloc.get("rooms") or []:
        for tarif in [chambre] + list(chambre.get("rates") or []):
            inclus = " ".join(tarif.get("inclusions") or []).lower()
            if tarif.get("breakfast_included") or "breakfast" in inclus or "petit" in inclus:
                textes.append("petit-déjeuner inclus (au moins une chambre)")
                break
        else:
            continue
        break
    return " ; ".join(textes)


def lignes_prix(propriete, bloc_prix, aujourdhui, hotel, sejour, arrivee):
    """Transforme les prix d'un hôtel en lignes pour prix.csv (une ligne par site)."""
    par_site = {}
    for bloc in bloc_prix:
        site, prix = bloc.get("source"), prix_nuit(bloc)
        if not site or prix is None:
            continue
        if site not in par_site or prix < par_site[site]["prix_nuit_eur"]:
            par_site[site] = {
                "date_releve": aujourdhui, "hotel": hotel, "sejour": sejour,
                "date_sejour": arrivee, "site": site, "prix_nuit_eur": prix,
                "offre": offres(bloc), "lien": bloc.get("link") or propriete.get("link", ""),
            }
    return list(par_site.values())


def restauration(propriete):
    """Devine « restaurant sur place » et « petit-déjeuner » à partir des équipements."""
    presents = [a.lower() for a in propriete.get("amenities") or []]
    absents = [a.lower() for a in propriete.get("excluded_amenities") or []]
    for groupe in (propriete.get("amenities_detailed") or {}).get("groups", []):
        for e in groupe.get("list", []):
            (presents if e.get("available", True) else absents).append(e.get("title", "").lower())

    def contient(liste, *mots):
        return any(m in a for a in liste for m in mots)

    if contient(presents, "restaurant"):
        resto = "oui"
    elif contient(absents, "restaurant"):
        resto = "non"
    else:
        resto = "non indiqué"

    pdj_mots = ("petit-déjeuner", "petit déjeuner", "breakfast")
    if contient(presents, *pdj_mots):
        payant = contient([a for a in presents if any(m in a for m in pdj_mots)],
                          "payant", "($)", "(€)", "paid", "supplément")
        gratuit = contient([a for a in presents if any(m in a for m in pdj_mots)],
                           "gratuit", "inclus", "free", "offert")
        pdj = "oui, inclus" if gratuit and not payant else ("oui, payant" if payant else "oui")
    elif contient(absents, *pdj_mots):
        pdj = "non"
    else:
        pdj = "non indiqué"
    return resto, pdj


def notes_detaillees(fiche):
    """Résumé lisible des notes détaillées (étoiles et thèmes des avis)."""
    morceaux = []
    etoiles = sorted(fiche.get("ratings") or [], key=lambda r: -r.get("stars", 0))
    if etoiles:
        morceaux.append(" | ".join(f"{r.get('stars')}★ : {r.get('count')}" for r in etoiles))
    themes = []
    for t in fiche.get("reviews_breakdown") or []:
        total = t.get("total_mentioned") or 0
        if total:
            themes.append(f"{t.get('name')} : {round(100 * (t.get('positive') or 0) / total)} % positif")
    if themes:
        morceaux.append(" | ".join(themes))
    return " ; ".join(morceaux)


def etoiles(propriete):
    valeur = propriete.get("extracted_hotel_class")
    if valeur:
        return str(valeur)
    m = re.search(r"\d", str(propriete.get("hotel_class") or ""))
    return m.group(0) if m else ""


# ---------------------------------------------------------------------
# Programme principal
# ---------------------------------------------------------------------

def dates_valides(cfg, aujourdhui):
    """Transforme les dates de config.yaml en vraies dates, en ignorant les dates passées."""
    resultat = []
    for d in cfg["dates_sejour"]:
        texte = str(d["arrivee"]).strip()
        if texte.startswith("+"):
            arrivee = aujourdhui + timedelta(days=int(texte[1:]))
        else:
            arrivee = date.fromisoformat(texte)
        if arrivee <= aujourdhui:
            print(f"  ! Date « {d['nom']} » ({arrivee}) déjà passée : ignorée. "
                  f"Remplacez-la dans config.yaml.")
            continue
        depart = arrivee + timedelta(days=int(cfg.get("nuits", 1)))
        resultat.append((d["nom"], arrivee.isoformat(), depart.isoformat()))
    return resultat


def afficher_quota(compte, cfg):
    if not compte:
        return
    utilisees = compte.get("this_month_usage")
    quota = compte.get("searches_per_month") or cfg["budget"]["requetes_par_mois"]
    restantes = compte.get("plan_searches_left")
    print(f"  Compteur SerpApi : {utilisees} requêtes utilisées ce mois-ci "
          f"sur {quota} (reste {restantes}).")


def estimation_mensuelle(cfg, nb_dates):
    """Estimation du nombre de requêtes par mois avec les réglages actuels."""
    lancements = 30 / max(1, int(cfg.get("frequence_jours", 1)))
    par_lancement = nb_dates * int(cfg["budget"].get("pages_max", 1))
    fiches = len(cfg["hotels"]) * 30 / 7
    return round(lancements * par_lancement + fiches)


def main():
    parser = argparse.ArgumentParser(description="Collecte des prix des hôtels de Luchon")
    parser.add_argument("--essai", action="store_true", help="1 hôtel, 1 date, n'écrit rien")
    parser.add_argument("--hotel", help="avec --essai : nom de l'hôtel à tester")
    parser.add_argument("--fiches", action="store_true", help="forcer les fiches détaillées")
    parser.add_argument("--forcer", action="store_true", help="ignorer la fréquence")
    parser.add_argument("--quota", action="store_true", help="afficher le compteur et s'arrêter")
    args = parser.parse_args()

    if not os.environ.get("SERPAPI_KEY"):
        sys.exit("ERREUR : la clé SerpApi est absente (variable SERPAPI_KEY). Voir le README.")

    cfg = lire_config()
    aujourdhui = datetime.now(timezone.utc).date()
    jour = aujourdhui.isoformat()
    print(f"=== Collecte du {jour} ===")

    compte = lire_compte()
    afficher_quota(compte, cfg)
    if args.quota:
        return

    sejours = dates_valides(cfg, aujourdhui)
    if not sejours:
        sys.exit("ERREUR : aucune date de séjour valable dans config.yaml.")
    print(f"  Estimation avec ces réglages : environ {estimation_mensuelle(cfg, len(sejours))} "
          f"requêtes par mois (quota : {cfg['budget']['requetes_par_mois']}).")

    # --- Fréquence : faut-il collecter aujourd'hui ? ---
    anciens_prix = lire_csv("prix.csv")
    if anciens_prix and not (args.forcer or args.essai):
        dernier = max(date.fromisoformat(l["date_releve"]) for l in anciens_prix)
        if (aujourdhui - dernier).days < int(cfg.get("frequence_jours", 1)):
            print(f"  Dernier relevé le {dernier} : rien à faire aujourd'hui (fréquence).")
            return

    # Fiches déjà connues (identifiants Google des hôtels)
    fiches_connues = {}
    for l in lire_csv("hotels.csv"):
        fiches_connues[l["hotel"]] = l  # la dernière ligne gagne
    jetons_connus = {h: l["property_token"] for h, l in fiches_connues.items() if l["property_token"]}

    hotels_cfg = cfg["hotels"]
    if args.essai:
        if args.hotel:
            hotels_cfg = [h for h in hotels_cfg if ressemblance(h["nom"], args.hotel) >= 0.6] \
                or [{"nom": args.hotel}]
        else:
            hotels_cfg = hotels_cfg[:1]
        sejours = sejours[:1]

    # --- Budget : a-t-on assez de requêtes ? ---
    besoin_recherche = len(sejours) * int(cfg["budget"].get("pages_max", 1))
    # Fiches détaillées : tous les hôtels le jour prévu, sinon seulement les nouveaux
    if args.essai or args.fiches or aujourdhui.weekday() == int(cfg.get("jour_fiches", 0)):
        fiches_pour = {h["nom"] for h in hotels_cfg}
    else:
        fiches_pour = {h["nom"] for h in hotels_cfg if h["nom"] not in fiches_connues}
    restantes = compte.get("plan_searches_left")
    if restantes is not None:
        disponible = restantes - int(cfg["budget"].get("marge_securite", 0))
        if fiches_pour and disponible < besoin_recherche + len(fiches_pour):
            print("  ! Quota presque épuisé : pas de fiches détaillées aujourd'hui.")
            fiches_pour = set()
        if disponible < besoin_recherche:
            garde = max(0, disponible // int(cfg["budget"].get("pages_max", 1)))
            if garde == 0:
                sys.exit("  ! Quota SerpApi épuisé (ou réserve atteinte) : collecte annulée.")
            print(f"  ! Quota presque épuisé : seulement {garde} date(s) aujourd'hui.")
            sejours = sejours[:garde]

    # --- 1) Recherche par date : prix par site + notes, pour tous les hôtels d'un coup ---
    prix, avis, infos = [], {}, {}
    for nom_sejour, arrivee, depart in sejours:
        print(f"\n> {nom_sejour} : arrivée {arrivee}, départ {depart}")
        proprietes = rechercher_ville(cfg, arrivee, depart)
        print(f"  {len(proprietes)} établissements renvoyés par Google Hotels.")
        trouves = associer_hotels(hotels_cfg, proprietes, jetons_connus)
        for h in hotels_cfg:
            p = trouves.get(h["nom"])
            if not p:
                print(f"  - {h['nom']} : non trouvé (complet, ou nom à préciser dans config.yaml)")
                continue
            lignes = lignes_prix(p, p.get("prices") or [], jour, h["nom"], nom_sejour, arrivee)
            if not lignes and prix_nuit(p) is not None:
                # Pas de détail par site : on garde au moins le prix le plus bas affiché
                lignes = [{"date_releve": jour, "hotel": h["nom"], "sejour": nom_sejour,
                           "date_sejour": arrivee, "site": "Google (prix le plus bas)",
                           "prix_nuit_eur": prix_nuit(p), "offre": "", "lien": p.get("link", "")}]
            prix += lignes
            infos.setdefault(h["nom"], p)
            if h["nom"] not in avis and p.get("overall_rating"):
                avis[h["nom"]] = {"date_releve": jour, "hotel": h["nom"],
                                  "note": p["overall_rating"],
                                  "note_sur_10": round(2 * float(p["overall_rating"]), 1),
                                  "nombre_avis": p.get("reviews", ""), "notes_detaillees": ""}
            print(f"  - {h['nom']} (Google : « {p.get('name')} ») : "
                  f"{len(lignes)} site(s), dès {min((l['prix_nuit_eur'] for l in lignes), default='?')} €")

    # --- 2) Fiches détaillées (1 fois par semaine) : sites, petit-déj, étoiles, notes détaillées ---
    fiches_lignes = []
    if fiches_pour:
        nom_sejour, arrivee, depart = sejours[0]
        print(f"\n> Fiches détaillées (prix pour « {nom_sejour} »)")
        for h in hotels_cfg:
            if h["nom"] not in fiches_pour:
                continue
            p = infos.get(h["nom"])
            jeton = (p or {}).get("property_token") or jetons_connus.get(h["nom"])
            if not jeton:
                continue
            try:
                fiche = fiche_hotel(cfg, jeton, arrivee, depart)
            except Exception as e:
                print(f"  - {h['nom']} : fiche indisponible ({e})")
                continue
            blocs = list(fiche.get("featured_prices") or []) + list(fiche.get("prices") or [])
            lignes = lignes_prix(fiche, blocs, jour, h["nom"], nom_sejour, arrivee)
            if lignes:  # la fiche est plus complète : elle remplace la recherche pour cette date
                prix = [l for l in prix if not (l["hotel"] == h["nom"] and l["date_sejour"] == arrivee)]
                prix += lignes
            if fiche.get("overall_rating"):
                avis[h["nom"]] = {"date_releve": jour, "hotel": h["nom"],
                                  "note": fiche["overall_rating"],
                                  "note_sur_10": round(2 * float(fiche["overall_rating"]), 1),
                                  "nombre_avis": fiche.get("reviews", ""),
                                  "notes_detaillees": notes_detaillees(fiche)}
            infos[h["nom"]] = {**(p or {}), **fiche, "property_token": jeton}
            print(f"  - {h['nom']} : {len(lignes)} site(s), note {fiche.get('overall_rating')}")

    # Fiche hôtel : écrite si elle vient d'être détaillée, ou si l'hôtel est nouveau
    for h in hotels_cfg:
        p = infos.get(h["nom"])
        if not p or not (h["nom"] in fiches_pour or h["nom"] not in fiches_connues):
            continue
        resto, pdj = restauration(p)
        fiches_lignes.append({
            "date_maj": jour, "hotel": h["nom"], "nom_google": p.get("name", ""),
            "categorie_etoiles": etoiles(p), "restaurant_sur_place": resto,
            "petit_dejeuner_propose": pdj,
            "equipements_principaux": ", ".join((p.get("amenities") or [])[:12]),
            "property_token": p.get("property_token", ""),
        })

    compte_apres = lire_compte()
    print(f"\n  Requêtes utilisées par ce lancement : {Compteur.n}")
    afficher_quota(compte_apres, cfg)

    # --- 3) Enregistrement (sauf en mode essai) ---
    if args.essai:
        print("\n=== RÉSULTAT DE L'ESSAI (rien n'est enregistré) ===")
        for l in sorted(prix, key=lambda l: l["prix_nuit_eur"]):
            print(f"  {l['site']:<30} {l['prix_nuit_eur']:>8.2f} €  {l['offre']}")
        for a in avis.values():
            print(f"  Note : {a['note']}/5 = {a['note_sur_10']}/10, {a['nombre_avis']} avis")
            if a["notes_detaillees"]:
                print(f"  Détail : {a['notes_detaillees']}")
        for f in fiches_lignes:
            print(f"  Étoiles : {f['categorie_etoiles'] or '?'} | Restaurant : "
                  f"{f['restaurant_sur_place']} | Petit-déjeuner : {f['petit_dejeuner_propose']}")
            print(f"  Équipements : {f['equipements_principaux']}")
        return

    ajouter_csv("prix.csv", prix)
    ajouter_csv("avis.csv", list(avis.values()))
    ajouter_csv("hotels.csv", fiches_lignes)
    ajouter_csv("usage.csv", [{
        "date_releve": jour, "requetes_ce_lancement": Compteur.n,
        "requetes_ce_mois": compte_apres.get("this_month_usage", ""),
        "quota_mois": compte_apres.get("searches_per_month") or cfg["budget"]["requetes_par_mois"],
        "requetes_restantes": compte_apres.get("plan_searches_left", ""),
    }])
    print(f"\n  Enregistré : {len(prix)} prix, {len(avis)} notes, {len(fiches_lignes)} fiches.")


if __name__ == "__main__":
    main()
