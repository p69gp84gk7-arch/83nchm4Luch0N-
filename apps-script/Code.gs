/**
 * =====================================================================
 *  Veille hôtels Bagnères-de-Luchon (Google Apps Script)
 * =====================================================================
 *  Ce script vit dans le classeur « Veille hôtels Luchon – base de données ».
 *  Il interroge Google Hotels via SerpApi et ajoute les résultats à la fin
 *  des onglets Prix, Avis, Hôtels et Compteur (rien n'est jamais effacé).
 *
 *  - Tous les réglages sont dans l'onglet « Réglages ».
 *  - Tout se pilote depuis le menu « Veille hôtels » du classeur.
 *  - La clé SerpApi est rangée dans les propriétés du script
 *    (menu Veille hôtels > Enregistrer la clé SerpApi), jamais dans le classeur.
 * =====================================================================
 */

const FUSEAU = 'Europe/Paris';
const URL_RECHERCHE = 'https://serpapi.com/search.json';
const URL_COMPTE = 'https://serpapi.com/account.json'; // consulter son compte ne coûte rien

// Onglets de données et leurs colonnes (l'ordre compte, l'onglet Synthèse s'en sert)
const ONGLETS = {
  prix: ['Prix', ['date_releve', 'hotel', 'sejour', 'date_sejour', 'site', 'prix_nuit_eur', 'offre', 'lien']],
  avis: ['Avis', ['date_releve', 'hotel', 'note', 'note_sur_10', 'nombre_avis', 'notes_detaillees']],
  hotels: ['Hôtels', ['date_maj', 'hotel', 'nom_google', 'categorie_etoiles', 'restaurant_sur_place',
                      'petit_dejeuner_propose', 'equipements_principaux', 'property_token']],
  compteur: ['Compteur', ['date_releve', 'requetes_ce_lancement', 'requetes_ce_mois', 'quota_mois',
                          'requetes_restantes']],
};
// Colonnes qui contiennent des dates (écrites comme de vraies dates dans le classeur)
const COLONNES_DATES = ['date_releve', 'date_sejour', 'date_maj'];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];


// =====================================================================
//  Menu du classeur
// =====================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Veille hôtels')
    .addItem('Lancer la collecte maintenant', 'menuCollecter')
    .addItem("Essai (1 hôtel, 1 date, n'enregistre rien)", 'menuEssai')
    .addItem('Collecte + fiches détaillées', 'menuFiches')
    .addSeparator()
    .addItem('Voir le compteur SerpApi', 'menuQuota')
    .addItem('Enregistrer la clé SerpApi', 'menuCle')
    .addSeparator()
    .addItem("Activer l'automatisation", 'menuActiver')
    .addItem("Désactiver l'automatisation", 'menuDesactiver')
    .addToUi();
}

function menuCollecter() { afficherResultat(collecter({ forcer: true })); }
function menuFiches() { afficherResultat(collecter({ forcer: true, fiches: true })); }

function menuEssai() {
  const ui = SpreadsheetApp.getUi();
  const rep = ui.prompt('Essai', "Nom de l'hôtel à tester (laisser vide = le premier de la liste) :", ui.ButtonSet.OK_CANCEL);
  if (rep.getSelectedButton() !== ui.Button.OK) return;
  afficherResultat(collecter({ essai: true, hotel: rep.getResponseText().trim() }));
}

function menuQuota() {
  const ui = SpreadsheetApp.getUi();
  if (!cle()) return ui.alert("Aucune clé SerpApi enregistrée : menu Veille hôtels > Enregistrer la clé SerpApi.");
  const compte = lireCompte();
  ui.alert('Compteur SerpApi', texteQuota(compte) || 'Compteur illisible pour le moment.', ui.ButtonSet.OK);
}

function menuCle() {
  const ui = SpreadsheetApp.getUi();
  const rep = ui.prompt('Clé SerpApi',
    'Collez votre clé SerpApi (page https://serpapi.com/manage-api-key) :', ui.ButtonSet.OK_CANCEL);
  if (rep.getSelectedButton() !== ui.Button.OK) return;
  const valeur = rep.getResponseText().trim();
  if (!valeur) return;
  PropertiesService.getScriptProperties().setProperty('SERPAPI_KEY', valeur);
  const compte = lireCompte();
  if (compte.error || !Object.keys(compte).length) {
    ui.alert('Clé refusée par SerpApi : vérifiez le copier-coller.\n\n' + (compte.error || ''));
  } else {
    ui.alert('Clé enregistrée et vérifiée.\n\n' + texteQuota(compte));
  }
}

function menuActiver() {
  const cfg = lireReglages();
  supprimerDeclencheurs();
  ScriptApp.newTrigger('collecteAutomatique').timeBased()
    .everyDays(1).atHour(cfg.heure).inTimezone(FUSEAU).create();
  if (cfg.a_l_ouverture) {
    ScriptApp.newTrigger('collecteALouverture').forSpreadsheet(SpreadsheetApp.getActive()).onOpen().create();
  }
  SpreadsheetApp.getUi().alert('Automatisation activée :\n\n'
    + '- collecte chaque jour vers ' + cfg.heure + ' h (heure de Paris)\n'
    + (cfg.a_l_ouverture ? "- et à l'ouverture du classeur si celle du jour n'est pas encore faite\n" : '')
    + '\nUne seule collecte par jour : rouvrir le classeur ne coûte rien de plus.');
}

function menuDesactiver() {
  supprimerDeclencheurs();
  SpreadsheetApp.getUi().alert("Automatisation désactivée. Le menu reste utilisable à la main.");
}

function supprimerDeclencheurs() {
  ScriptApp.getProjectTriggers()
    .filter(d => ['collecteAutomatique', 'collecteALouverture'].includes(d.getHandlerFunction()))
    .forEach(d => ScriptApp.deleteTrigger(d));
}

function afficherResultat(r) {
  SpreadsheetApp.getUi().alert(r.ok ? 'Veille hôtels' : 'Problème',
    r.message + (r.journal ? '\n\n' + r.journal : ''), SpreadsheetApp.getUi().ButtonSet.OK);
}


// =====================================================================
//  Déclencheurs automatiques
// =====================================================================

/** Lancé chaque jour à l'heure choisie (respecte la fréquence des Réglages). */
function collecteAutomatique() {
  const r = collecter({});
  console.log(r.message + '\n' + r.journal);
}

/** Lancé à l'ouverture du classeur : collecte seulement si celle du jour n'est pas faite. */
function collecteALouverture() {
  const cfg = lireReglages();
  if (!cfg.a_l_ouverture || !cle() || derniereCollecte() === aujourdhui()) return;
  const classeur = SpreadsheetApp.getActive();
  classeur.toast('Collecte du jour en cours (environ 1 minute)…', 'Veille hôtels', 60);
  const r = collecter({});
  classeur.toast(r.message, 'Veille hôtels', 10);
}


// =====================================================================
//  Page web (facultatif : Déployer > Nouveau déploiement > Application Web)
// =====================================================================

function doGet() {
  return HtmlService.createTemplateFromFile('Page').evaluate()
    .setTitle('Veille hôtels Luchon')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Données pour la page web : toutes les lignes des 4 onglets, dates au format AAAA-MM-JJ. */
function lireDonnees() {
  return {
    prix: lireObjets('prix'), avis: lireObjets('avis'), hotels: lireObjets('hotels'),
    usage: lireObjets('compteur'), urlClasseur: SpreadsheetApp.getActive().getUrl(),
  };
}

function etatCollecte() {
  return { cleOk: !!cle(), faite: derniereCollecte() === aujourdhui(), aOuverture: lireReglages().a_l_ouverture };
}

function collecterDepuisPage(forcer) {
  return collecter({ forcer: !!forcer });
}


// =====================================================================
//  La collecte
// =====================================================================

/**
 * options : { essai, hotel, fiches, forcer }
 * Renvoie { ok, faite (des lignes ont été enregistrées), message, journal }.
 */
function collecter(options) {
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(1000)) return { ok: false, faite: false, message: 'Une collecte est déjà en cours.', journal: '' };
  const journal = [];
  try {
    return collecterSansVerrou(options || {}, journal);
  } catch (e) {
    return { ok: false, faite: false, message: 'Erreur : ' + e.message, journal: journal.join('\n') };
  } finally {
    verrou.releaseLock();
  }
}

function collecterSansVerrou(opts, journal) {
  if (!cle()) {
    return { ok: false, faite: false, journal: '',
      message: "Clé SerpApi absente : menu Veille hôtels > Enregistrer la clé SerpApi." };
  }
  const cfg = lireReglages();
  const jour = aujourdhui();
  const etat = { requetes: 0 };

  // --- Fréquence : faut-il collecter aujourd'hui ? ---
  const dernier = derniereCollecte();
  if (dernier && !opts.forcer && !opts.essai && ecartJours(dernier, jour) < cfg.frequence_jours) {
    return { ok: true, faite: false, journal: '',
      message: 'Collecte déjà faite (dernier relevé le ' + dernier + ').' };
  }

  const compte = lireCompte();
  let sejours = datesValides(cfg, journal);
  if (!sejours.length) return { ok: false, faite: false, journal: journal.join('\n'),
    message: 'Aucune date de séjour valable dans Réglages.' };

  // Fiches déjà connues (identifiants Google des hôtels) : la dernière ligne gagne
  const fichesConnues = {};
  lireObjets('hotels').forEach(l => { fichesConnues[l.hotel] = l; });
  const jetonsConnus = {};
  Object.keys(fichesConnues).forEach(h => { if (fichesConnues[h].property_token) jetonsConnus[h] = fichesConnues[h].property_token; });

  let hotels = cfg.hotels;
  if (opts.essai) {
    const choisis = opts.hotel ? hotels.filter(h => ressemblance(h.nom, opts.hotel) >= 0.6) : hotels;
    hotels = choisis.length ? choisis.slice(0, 1) : [{ nom: opts.hotel, autres_noms: [] }];
    sejours = sejours.slice(0, 1);
  }

  // Fiches détaillées : tous les hôtels le jour prévu, sinon seulement les nouveaux
  const jourSemaine = JOURS[Number(Utilities.formatDate(new Date(), FUSEAU, 'u')) - 1];
  let fichesPour = (opts.essai || opts.fiches || jourSemaine === cfg.jour_fiches)
    ? hotels.map(h => h.nom)
    : hotels.filter(h => !fichesConnues[h.nom]).map(h => h.nom);

  // --- Budget : a-t-on assez de requêtes ? ---
  const besoinRecherche = sejours.length * cfg.pages_max;
  if (typeof compte.plan_searches_left === 'number') {
    const disponible = compte.plan_searches_left - cfg.marge;
    if (fichesPour.length && disponible < besoinRecherche + fichesPour.length) {
      journal.push('! Quota presque épuisé : pas de fiches détaillées aujourd\'hui.');
      fichesPour = [];
    }
    if (disponible < besoinRecherche) {
      const garde = Math.max(0, Math.floor(disponible / cfg.pages_max));
      if (!garde) return { ok: false, faite: false, journal: journal.join('\n'),
        message: 'Quota SerpApi épuisé (ou réserve atteinte) : collecte annulée.' };
      journal.push('! Quota presque épuisé : seulement ' + garde + ' date(s) aujourd\'hui.');
      sejours = sejours.slice(0, garde);
    }
  }

  // --- 1) Recherche par date : prix par site + notes, pour tous les hôtels d'un coup ---
  let prix = [];
  const avis = {}, infos = {};
  sejours.forEach(s => {
    journal.push('> ' + s.nom + ' (arrivée ' + s.arrivee + ')');
    const proprietes = rechercherVille(cfg, s.arrivee, s.depart, etat);
    const trouves = associerHotels(hotels, proprietes, jetonsConnus);
    hotels.forEach(h => {
      const p = trouves[h.nom];
      if (!p) { journal.push('  - ' + h.nom + ' : non trouvé (complet, ou nom à préciser dans Réglages)'); return; }
      let lignes = lignesPrix(p, p.prices || [], jour, h.nom, s.nom, s.arrivee);
      if (!lignes.length && prixNuit(p) !== null) {
        // Pas de détail par site : on garde au moins le prix le plus bas affiché
        lignes = [{ date_releve: jour, hotel: h.nom, sejour: s.nom, date_sejour: s.arrivee,
          site: 'Google (prix le plus bas)', prix_nuit_eur: prixNuit(p), offre: '', lien: p.link || '' }];
      }
      prix = prix.concat(lignes);
      if (!infos[h.nom]) infos[h.nom] = p;
      if (!avis[h.nom] && p.overall_rating) avis[h.nom] = ligneAvis(jour, h.nom, p, '');
      const mini = lignes.length ? Math.min.apply(null, lignes.map(l => l.prix_nuit_eur)) : '?';
      journal.push('  - ' + h.nom + ' (Google : « ' + p.name + ' ») : ' + lignes.length + ' site(s), dès ' + mini + ' €');
    });
  });

  // --- 2) Fiches détaillées : plus de sites, petit-déjeuner inclus, étoiles, notes détaillées ---
  if (fichesPour.length) {
    const s = sejours[0];
    journal.push('> Fiches détaillées (prix pour « ' + s.nom + ' »)');
    hotels.forEach(h => {
      if (!fichesPour.includes(h.nom)) return;
      const p = infos[h.nom];
      const jeton = (p && p.property_token) || jetonsConnus[h.nom];
      if (!jeton) return;
      let fiche;
      try {
        fiche = appelerSerpapi({ property_token: jeton, check_in_date: s.arrivee,
          check_out_date: s.depart, adults: cfg.adultes }, etat);
      } catch (e) {
        journal.push('  - ' + h.nom + ' : fiche indisponible (' + e.message + ')');
        return;
      }
      const blocs = (fiche.featured_prices || []).concat(fiche.prices || []);
      const lignes = lignesPrix(fiche, blocs, jour, h.nom, s.nom, s.arrivee);
      if (lignes.length) { // la fiche est plus complète : elle remplace la recherche pour cette date
        prix = prix.filter(l => !(l.hotel === h.nom && l.date_sejour === s.arrivee)).concat(lignes);
      }
      if (fiche.overall_rating) avis[h.nom] = ligneAvis(jour, h.nom, fiche, notesDetaillees(fiche));
      infos[h.nom] = Object.assign({}, p || {}, fiche, { property_token: jeton });
      journal.push('  - ' + h.nom + ' : ' + lignes.length + ' site(s), note ' + (fiche.overall_rating || '?'));
    });
  }

  // Fiche hôtel : écrite si elle vient d'être détaillée, ou si l'hôtel est nouveau
  const fiches = [];
  hotels.forEach(h => {
    const p = infos[h.nom];
    if (!p || !(fichesPour.includes(h.nom) || !fichesConnues[h.nom])) return;
    const resto = restauration(p);
    fiches.push({ date_maj: jour, hotel: h.nom, nom_google: p.name || '', categorie_etoiles: etoiles(p),
      restaurant_sur_place: resto[0], petit_dejeuner_propose: resto[1],
      equipements_principaux: (p.amenities || []).slice(0, 12).join(', '), property_token: p.property_token || '' });
  });

  const compteApres = lireCompte();
  journal.push('Requêtes utilisées par ce lancement : ' + etat.requetes);
  if (texteQuota(compteApres)) journal.push(texteQuota(compteApres));

  // --- 3) Enregistrement (sauf en mode essai) ---
  if (opts.essai) {
    journal.push('', '=== RÉSULTAT DE L\'ESSAI (rien n\'est enregistré) ===');
    prix.slice().sort((a, b) => a.prix_nuit_eur - b.prix_nuit_eur).forEach(l =>
      journal.push(l.site + ' : ' + l.prix_nuit_eur + ' €' + (l.offre ? ' (' + l.offre + ')' : '')));
    Object.keys(avis).forEach(h => {
      const a = avis[h];
      journal.push('Note : ' + a.note + '/5 = ' + a.note_sur_10 + '/10, ' + a.nombre_avis + ' avis');
      if (a.notes_detaillees) journal.push('Détail : ' + a.notes_detaillees);
    });
    fiches.forEach(f => journal.push('Étoiles : ' + (f.categorie_etoiles || '?') + ' | Restaurant : '
      + f.restaurant_sur_place + ' | Petit-déjeuner : ' + f.petit_dejeuner_propose));
    return { ok: true, faite: false, message: 'Essai terminé (' + etat.requetes + ' requêtes).', journal: journal.join('\n') };
  }

  ajouterLignes('prix', prix);
  ajouterLignes('avis', Object.keys(avis).map(h => avis[h]));
  ajouterLignes('hotels', fiches);
  ajouterLignes('compteur', [{
    date_releve: jour, requetes_ce_lancement: etat.requetes,
    requetes_ce_mois: valeurOuVide(compteApres.this_month_usage),
    quota_mois: compteApres.searches_per_month || cfg.quota,
    requetes_restantes: valeurOuVide(compteApres.plan_searches_left),
  }]);
  return { ok: true, faite: true, journal: journal.join('\n'),
    message: 'Collecte enregistrée : ' + prix.length + ' prix, ' + Object.keys(avis).length + ' notes, '
      + fiches.length + ' fiches.' };
}


// =====================================================================
//  Appels à SerpApi
// =====================================================================

function cle() {
  return PropertiesService.getScriptProperties().getProperty('SERPAPI_KEY') || '';
}

/** UNE requête Google Hotels (compte pour 1 dans le quota). */
function appelerSerpapi(params, etat) {
  const tous = Object.assign({}, params, { engine: 'google_hotels', api_key: cle(), currency: 'EUR', gl: 'fr', hl: 'fr' });
  const url = URL_RECHERCHE + '?' + Object.keys(tous).map(k => k + '=' + encodeURIComponent(tous[k])).join('&');
  const reponse = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  etat.requetes++;
  const donnees = JSON.parse(reponse.getContentText());
  if (donnees.error) throw new Error('SerpApi a répondu : ' + donnees.error);
  return donnees;
}

/** Compteur du compte SerpApi (gratuit) : requêtes utilisées / restantes. */
function lireCompte() {
  try {
    const r = UrlFetchApp.fetch(URL_COMPTE + '?api_key=' + encodeURIComponent(cle()), { muteHttpExceptions: true });
    return JSON.parse(r.getContentText());
  } catch (e) {
    return {};
  }
}

function texteQuota(compte) {
  if (!compte || compte.this_month_usage === undefined) return '';
  return 'Compteur SerpApi : ' + compte.this_month_usage + ' requêtes utilisées ce mois-ci sur '
    + (compte.searches_per_month || '?') + ' (reste ' + compte.plan_searches_left + ').';
}

/** Recherche « hôtels <ville> » pour une date : renvoie la liste des établissements. */
function rechercherVille(cfg, arrivee, depart, etat) {
  let proprietes = [], jetonPage = null;
  for (let page = 0; page < cfg.pages_max; page++) {
    const params = { q: 'hôtels ' + cfg.ville, check_in_date: arrivee, check_out_date: depart, adults: cfg.adultes };
    if (jetonPage) params.next_page_token = jetonPage;
    const donnees = appelerSerpapi(params, etat);
    proprietes = proprietes.concat(donnees.properties || []);
    jetonPage = (donnees.serpapi_pagination || {}).next_page_token;
    if (!jetonPage) break;
  }
  return proprietes;
}


// =====================================================================
//  Lecture des réponses
// =====================================================================

/** Met un nom d'hôtel sous une forme simple pour comparer : minuscules, sans accents, sans « hôtel »… */
function simplifier(texte) {
  const inutiles = ['hotel', 'hotels', 'le', 'la', 'les', 'de', 'des', 'du', 'd', 'l', 'et', 'spa',
                    'luchon', 'bagneres', 'the', 'and'];
  return String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').split(' ').filter(m => m && !inutiles.includes(m));
}

/** Note de 0 à 1 : à quel point deux noms d'hôtels se ressemblent. */
function ressemblance(nomA, nomB) {
  const a = simplifier(nomA), b = simplifier(nomB);
  if (!a.length || !b.length) return 0;
  const ensA = new Set(a), ensB = new Set(b);
  const communs = [...ensA].filter(m => ensB.has(m)).length;
  const commun = communs / new Set(a.concat(b)).size;
  // Ressemblance des lettres (paires de lettres en commun)
  const paires = t => { const r = []; for (let i = 0; i < t.length - 1; i++) r.push(t.slice(i, i + 2)); return r; };
  const pa = paires(a.join(' ')), pb = paires(b.join(' '));
  let n = 0;
  const reste = pb.slice();
  pa.forEach(p => { const i = reste.indexOf(p); if (i >= 0) { n++; reste.splice(i, 1); } });
  const proche = pa.length + pb.length ? (2 * n) / (pa.length + pb.length) : 0;
  return Math.max(commun, proche);
}

/** Retrouve chaque hôtel des Réglages dans les résultats Google. Renvoie { nom: propriété }. */
function associerHotels(hotels, proprietes, jetonsConnus) {
  const trouves = {}, utilises = new Set();
  // 1) d'abord par identifiant Google déjà connu (le plus fiable)
  hotels.forEach(h => {
    const jeton = jetonsConnus[h.nom];
    proprietes.forEach((p, i) => {
      if (jeton && p.property_token === jeton) { trouves[h.nom] = p; utilises.add(i); }
    });
  });
  // 2) puis par ressemblance des noms, les meilleures paires d'abord
  const paires = [];
  hotels.forEach(h => {
    if (trouves[h.nom]) return;
    const noms = [h.nom].concat(h.autres_noms || []);
    proprietes.forEach((p, i) => {
      if (utilises.has(i)) return;
      const score = Math.max.apply(null, noms.map(n => ressemblance(n, p.name)));
      if (score >= 0.6) paires.push([score, h.nom, i]);
    });
  });
  paires.sort((x, y) => y[0] - x[0]).forEach(([, nom, i]) => {
    if (!trouves[nom] && !utilises.has(i)) { trouves[nom] = proprietes[i]; utilises.add(i); }
  });
  return trouves;
}

/** Prix par nuit (nombre) d'un bloc de prix SerpApi. */
function prixNuit(bloc) {
  const tarif = bloc.rate_per_night || {};
  for (const cleTarif of ['extracted_lowest', 'extracted_display_price', 'extracted_before_taxes_fees']) {
    if (typeof tarif[cleTarif] === 'number') return Math.round(tarif[cleTarif] * 100) / 100;
  }
  return null;
}

/** Avantages d'une offre : site officiel, annulation gratuite, petit-déjeuner inclus. */
function offres(bloc) {
  const textes = [];
  if (bloc.official) textes.push("site officiel de l'hôtel");
  if (bloc.free_cancellation) {
    textes.push('annulation gratuite' + (bloc.free_cancellation_until_date ? " jusqu'au " + bloc.free_cancellation_until_date : ''));
  }
  // Le petit-déjeuner se cache dans le détail des chambres (fiches détaillées)
  const pdj = (bloc.rooms || []).some(chambre => [chambre].concat(chambre.rates || []).some(t => {
    const inclus = (t.inclusions || []).join(' ').toLowerCase();
    return t.breakfast_included || inclus.includes('breakfast') || inclus.includes('petit');
  }));
  if (pdj) textes.push('petit-déjeuner inclus (au moins une chambre)');
  return textes.join(' ; ');
}

/** Prix d'un hôtel → lignes pour l'onglet Prix (une ligne par site, la moins chère). */
function lignesPrix(propriete, blocs, jour, hotel, sejour, arrivee) {
  const parSite = {};
  blocs.forEach(bloc => {
    const site = bloc.source, prix = prixNuit(bloc);
    if (!site || prix === null) return;
    if (!parSite[site] || prix < parSite[site].prix_nuit_eur) {
      parSite[site] = { date_releve: jour, hotel: hotel, sejour: sejour, date_sejour: arrivee, site: site,
        prix_nuit_eur: prix, offre: offres(bloc), lien: bloc.link || propriete.link || '' };
    }
  });
  return Object.keys(parSite).map(s => parSite[s]);
}

function ligneAvis(jour, hotel, source, detail) {
  return { date_releve: jour, hotel: hotel, note: source.overall_rating,
    note_sur_10: Math.round(20 * source.overall_rating) / 10,
    nombre_avis: valeurOuVide(source.reviews), notes_detaillees: detail };
}

/** Devine « restaurant sur place » et « petit-déjeuner » à partir des équipements. */
function restauration(p) {
  const presents = (p.amenities || []).map(a => a.toLowerCase());
  const absents = (p.excluded_amenities || []).map(a => a.toLowerCase());
  ((p.amenities_detailed || {}).groups || []).forEach(g => (g.list || []).forEach(e => {
    (e.available === false ? absents : presents).push(String(e.title || '').toLowerCase());
  }));
  const contient = (liste, mots) => liste.some(a => mots.some(m => a.includes(m)));
  const resto = contient(presents, ['restaurant']) ? 'oui' : contient(absents, ['restaurant']) ? 'non' : 'non indiqué';
  const motsPdj = ['petit-déjeuner', 'petit déjeuner', 'breakfast'];
  let pdj = 'non indiqué';
  if (contient(presents, motsPdj)) {
    const lignesPdj = presents.filter(a => motsPdj.some(m => a.includes(m)));
    const payant = contient(lignesPdj, ['payant', '($)', '(€)', 'paid', 'supplément']);
    const gratuit = contient(lignesPdj, ['gratuit', 'inclus', 'free', 'offert']);
    pdj = gratuit && !payant ? 'oui, inclus' : payant ? 'oui, payant' : 'oui';
  } else if (contient(absents, motsPdj)) {
    pdj = 'non';
  }
  return [resto, pdj];
}

/** Résumé lisible des notes détaillées (étoiles et thèmes des avis). */
function notesDetaillees(fiche) {
  const morceaux = [];
  const etoilesAvis = (fiche.ratings || []).slice().sort((a, b) => (b.stars || 0) - (a.stars || 0));
  if (etoilesAvis.length) morceaux.push(etoilesAvis.map(r => r.stars + '★ : ' + r.count).join(' | '));
  const themes = (fiche.reviews_breakdown || []).filter(t => t.total_mentioned)
    .map(t => t.name + ' : ' + Math.round(100 * (t.positive || 0) / t.total_mentioned) + ' % positif');
  if (themes.length) morceaux.push(themes.join(' | '));
  return morceaux.join(' ; ');
}

function etoiles(p) {
  if (p.extracted_hotel_class) return p.extracted_hotel_class;
  const m = String(p.hotel_class || '').match(/\d/);
  return m ? Number(m[0]) : '';
}


// =====================================================================
//  Réglages, dates et onglets
// =====================================================================

/** Lit l'onglet Réglages (les libellés de la colonne A, puis les listes d'hôtels et de dates). */
function lireReglages() {
  const feuille = SpreadsheetApp.getActive().getSheetByName('Réglages');
  if (!feuille) throw new Error('Onglet « Réglages » introuvable.');
  const valeurs = feuille.getDataRange().getValues();
  const parLibelle = {};
  let debutListes = -1;
  valeurs.forEach((ligne, i) => {
    const libelle = String(ligne[0]).trim();
    if (libelle && !(libelle in parLibelle)) parLibelle[libelle] = ligne[1];
    if (libelle === 'Hôtels suivis' && debutListes < 0) debutListes = i + 2; // titre, puis en-têtes
  });
  const hotels = [], dates = [];
  for (let i = Math.max(debutListes, 0); debutListes >= 0 && i < valeurs.length; i++) {
    const nom = String(valeurs[i][0]).trim(), autres = String(valeurs[i][1] || '');
    if (nom) hotels.push({ nom: nom, autres_noms: autres.split(';').map(s => s.trim()).filter(String) });
    const nomDate = String(valeurs[i][3] || '').trim(), arrivee = valeurs[i][4];
    if (nomDate && arrivee !== '') dates.push({ nom: nomDate, arrivee: arrivee });
  }
  const nombre = (libelle, defaut) => {
    const v = parLibelle[libelle];
    return v === '' || v === undefined || isNaN(Number(v)) ? defaut : Number(v);
  };
  return {
    ville: String(parLibelle['Ville'] || 'Bagnères-de-Luchon'),
    nuits: nombre('Nuits', 1),
    adultes: nombre('Adultes', 2),
    frequence_jours: nombre('Fréquence (en jours)', 1),
    jour_fiches: String(parLibelle['Jour des fiches détaillées'] || 'lundi').toLowerCase().trim(),
    heure: nombre('Heure de la collecte automatique', 7),
    a_l_ouverture: String(parLibelle["Collecter à l'ouverture du classeur"] || 'oui').toLowerCase().trim().startsWith('o'),
    quota: nombre('Quota mensuel SerpApi', 250),
    marge: nombre('Réserve de requêtes', 15),
    pages_max: Math.max(1, nombre('Pages de résultats par date', 1)),
    hotels: hotels,
    dates: dates,
  };
}

/** Transforme les dates des Réglages en vraies dates, en ignorant les dates passées. */
function datesValides(cfg, journal) {
  const auj = aujourdhui();
  const resultat = [];
  cfg.dates.forEach(d => {
    const texte = String(d.arrivee).trim();
    let arrivee;
    if (d.arrivee instanceof Date) arrivee = enIso(d.arrivee);
    else if (typeof d.arrivee === 'number') arrivee = decaler(auj, d.arrivee); // « +30 » tapé sans apostrophe
    else if (texte.startsWith('+')) arrivee = decaler(auj, parseInt(texte.slice(1), 10));
    else arrivee = texte;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrivee)) {
      journal.push('! Date « ' + d.nom + ' » illisible (' + texte + ') : ignorée.');
      return;
    }
    if (arrivee <= auj) {
      journal.push('! Date « ' + d.nom + ' » (' + arrivee + ') déjà passée : ignorée. Remplacez-la dans Réglages.');
      return;
    }
    resultat.push({ nom: d.nom, arrivee: arrivee, depart: decaler(arrivee, cfg.nuits) });
  });
  return resultat;
}

function aujourdhui() { return Utilities.formatDate(new Date(), FUSEAU, 'yyyy-MM-dd'); }
function enIso(date) { return Utilities.formatDate(date, FUSEAU, 'yyyy-MM-dd'); }
function versDate(iso) { return Utilities.parseDate(iso, FUSEAU, 'yyyy-MM-dd'); }
function decaler(iso, jours) {
  const [a, m, j] = iso.split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(a, m - 1, j + jours)), 'UTC', 'yyyy-MM-dd');
}
function ecartJours(isoA, isoB) { return Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86400000); }
function valeurOuVide(v) { return v === undefined || v === null ? '' : v; }

function feuilleDonnees(cleOnglet) {
  const [nom, colonnes] = ONGLETS[cleOnglet];
  const classeur = SpreadsheetApp.getActive();
  const feuille = classeur.getSheetByName(nom) || classeur.insertSheet(nom);
  if (feuille.getLastRow() === 0) {
    feuille.getRange(1, 1, 1, colonnes.length).setValues([colonnes]).setFontWeight('bold');
    feuille.setFrozenRows(1);
  }
  return feuille;
}

/** Toutes les lignes d'un onglet de données, en objets ; les dates en texte AAAA-MM-JJ. */
function lireObjets(cleOnglet) {
  const feuille = feuilleDonnees(cleOnglet);
  const colonnes = ONGLETS[cleOnglet][1];
  if (feuille.getLastRow() < 2) return [];
  return feuille.getRange(2, 1, feuille.getLastRow() - 1, colonnes.length).getValues()
    .filter(l => l[0] !== '')
    .map(l => {
      const o = {};
      colonnes.forEach((c, i) => { o[c] = l[i] instanceof Date ? enIso(l[i]) : l[i]; });
      return o;
    });
}

/** Ajoute des lignes À LA FIN d'un onglet de données (on n'efface jamais rien). */
function ajouterLignes(cleOnglet, objets) {
  if (!objets.length) return;
  const feuille = feuilleDonnees(cleOnglet);
  const colonnes = ONGLETS[cleOnglet][1];
  const lignes = objets.map(o => colonnes.map(c => {
    const v = valeurOuVide(o[c]);
    if (COLONNES_DATES.includes(c) && v) return versDate(v);
    return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; // évite qu'un texte soit lu comme formule
  }));
  feuille.getRange(feuille.getLastRow() + 1, 1, lignes.length, colonnes.length).setValues(lignes);
}

/** Date (AAAA-MM-JJ) du dernier relevé de prix, ou '' s'il n'y en a pas. */
function derniereCollecte() {
  const feuille = feuilleDonnees('prix');
  if (feuille.getLastRow() < 2) return '';
  const dates = feuille.getRange(2, 1, feuille.getLastRow() - 1, 1).getValues()
    .map(l => l[0] instanceof Date ? enIso(l[0]) : String(l[0])).filter(Boolean);
  return dates.length ? dates.sort().pop() : '';
}
