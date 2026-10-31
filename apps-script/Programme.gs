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
 *  - La clé SerpApi est rangée dans les propriétés du script, jamais dans
 *    le classeur : collez-la dans la cellule jaune « Clé SerpApi » des
 *    Réglages (le script la range puis efface la cellule), ou passez par
 *    le menu Veille hôtels > Enregistrer la clé SerpApi.
 *
 *  Ce fichier n'est PAS collé dans Apps Script : c'est le chargeur
 *  (apps-script/Code.gs) qui le lit sur GitHub, branche main.
 *  Une modification fusionnée dans main arrive donc toute seule.
 * =====================================================================
 */

// Le classeur où tout est enregistré (utile quand le script n'est pas attaché au classeur)
const ID_CLASSEUR = '1LfKdFtpxfyKQj4uiVwkyoXF3FMzfAx1yxvDGMyabLZY';
const FUSEAU = 'Europe/Paris';
const URL_RECHERCHE = 'https://serpapi.com/search.json';
const URL_COMPTE = 'https://serpapi.com/account.json'; // consulter son compte ne coûte rien
// La page (index.html, aussi publiée sur GitHub Pages) est lue sur GitHub, comme le programme
const URL_PAGE = 'https://raw.githubusercontent.com/p69gp84gk7-arch/83nchm4Luch0N-/main/index.html';
// Actions de la page web qui consomment des requêtes : elles demandent le code d'accès des Réglages
const ACTIONS_PROTEGEES = ['collecte', 'essai', 'fiches'];

// Onglets de données et leurs colonnes (l'ordre compte, l'onglet Synthèse s'en sert)
const ONGLETS = {
  prix: ['Prix', ['date_releve', 'hotel', 'sejour', 'date_sejour', 'site', 'prix_nuit_eur', 'offre', 'lien']],
  avis: ['Avis', ['date_releve', 'hotel', 'note', 'note_sur_10', 'nombre_avis', 'notes_detaillees']],
  hotels: ['Hôtels', ['date_maj', 'hotel', 'nom_google', 'categorie_etoiles', 'restaurant_sur_place',
                      'petit_dejeuner_propose', 'equipements_principaux', 'property_token', 'photo']],
  compteur: ['Compteur', ['date_releve', 'requetes_ce_lancement', 'requetes_ce_mois', 'quota_mois',
                          'requetes_restantes']],
};
// Colonnes qui contiennent des dates (écrites comme de vraies dates dans le classeur)
const COLONNES_DATES = ['date_releve', 'date_sejour', 'date_maj'];
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];


function classeur() {
  return SpreadsheetApp.getActive() || SpreadsheetApp.openById(ID_CLASSEUR);
}


// =====================================================================
//  Installation (à exécuter une fois depuis l'éditeur Apps Script)
// =====================================================================

/**
 * Fait tout d'un coup : range la clé SerpApi collée dans les Réglages,
 * la vérifie, programme les collectes automatiques et lance la première.
 * Le résultat s'affiche dans le journal d'exécution et dans les Réglages.
 */
function installer() {
  rangerCleDesReglages();
  if (!cle()) {
    const message = 'Clé SerpApi absente : collez-la dans la cellule jaune « Clé SerpApi » de l\'onglet Réglages, puis relancez « installer ».';
    noterEtat(message);
    throw new Error(message);
  }
  const compte = lireCompte();
  if (compte.error || compte.this_month_usage === undefined) {
    const message = 'Clé refusée par SerpApi : vérifiez le copier-coller. ' + (compte.error || '');
    noterEtat(message);
    throw new Error(message);
  }
  const auto = programmerCollectes();
  const r = collecter({ forcer: true });
  console.log(auto + '\n\n' + r.message + '\n' + r.journal);
  return r.message;
}

/** Programme la collecte quotidienne (et à l'ouverture du classeur si demandé). */
function programmerCollectes() {
  const cfg = lireReglages();
  supprimerDeclencheurs();
  ScriptApp.newTrigger('collecteAutomatique').timeBased()
    .everyDays(1).atHour(cfg.heure).inTimezone(FUSEAU).create();
  if (cfg.a_l_ouverture) {
    ScriptApp.newTrigger('collecteALouverture').forSpreadsheet(ID_CLASSEUR).onOpen().create();
  }
  return 'Automatisation activée :\n'
    + '- collecte chaque jour vers ' + cfg.heure + ' h (heure de Paris)\n'
    + (cfg.a_l_ouverture ? "- et à l'ouverture du classeur si celle du jour n'est pas encore faite\n" : '')
    + '\nUne seule collecte par jour : rouvrir le classeur ne coûte rien de plus.';
}

/** Si une clé a été collée dans la cellule « Clé SerpApi » des Réglages : la ranger, puis effacer la cellule. */
function rangerCleDesReglages() {
  const cellule = celluleReglage('Clé SerpApi');
  if (!cellule) return;
  const valeur = String(cellule.getValue()).trim();
  if (!valeur || valeur.startsWith('(')) return;
  PropertiesService.getScriptProperties().setProperty('SERPAPI_KEY', valeur);
  cellule.setValue('(enregistrée dans le script)');
}

/** Écrit l'état de la dernière collecte dans les Réglages, pour le voir sans ouvrir le script. */
function noterEtat(message, libelle) {
  const cellule = celluleReglage(libelle || 'Dernière collecte');
  if (cellule) cellule.setValue(Utilities.formatDate(new Date(), FUSEAU, 'dd/MM/yyyy HH:mm') + ' : ' + message);
}

/** Cellule de valeur (colonne B) d'un libellé de la colonne A des Réglages. */
function celluleReglage(libelle) {
  const feuille = classeur().getSheetByName('Réglages');
  if (!feuille) return null;
  const libelles = feuille.getRange(1, 1, feuille.getLastRow(), 1).getValues();
  const i = libelles.findIndex(l => String(l[0]).trim() === libelle);
  return i < 0 ? null : feuille.getRange(i + 1, 2);
}


// =====================================================================
//  Actions du menu « Veille hôtels » (le menu lui-même est créé par le chargeur)
// =====================================================================

function menuCollecter() { afficherResultat(collecter({ forcer: true })); }
function menuFiches() { afficherResultat(collecter({ forcer: true, fiches: true })); }

function menuEssai() {
  const ui = SpreadsheetApp.getUi();
  const rep = ui.prompt('Essai', "Nom de l'hôtel à tester (laisser vide = le premier de la liste) :", ui.ButtonSet.OK_CANCEL);
  if (rep.getSelectedButton() !== ui.Button.OK) return;
  afficherResultat(collecter({ essai: true, hotel: rep.getResponseText().trim() }));
}

/** Menu « Ouvrir le tableau de bord » (« Voir le compteur SerpApi » dans le premier chargeur). */
function menuQuota() { ouvrirTableauDeBord(); }

/** Ouvre le tableau de bord dans une grande fenêtre par-dessus le classeur. */
function ouvrirTableauDeBord() {
  const page = HtmlService.createHtmlOutput(UrlFetchApp.fetch(URL_PAGE).getContentText()).setWidth(1200).setHeight(820);
  SpreadsheetApp.getUi().showModelessDialog(page, 'Veille hôtels Luchon');
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
  SpreadsheetApp.getUi().alert(programmerCollectes());
}

function menuDesactiver() {
  supprimerDeclencheurs();
  SpreadsheetApp.getUi().alert("Automatisation désactivée. Le menu reste utilisable à la main.");
}

/** Supprime les déclencheurs d'anciennes versions dont la fonction n'existe plus. */
function nettoyerDeclencheurs() {
  try {
    ScriptApp.getProjectTriggers()
      .filter(d => !['collecteAutomatique', 'collecteALouverture'].includes(d.getHandlerFunction()))
      .forEach(d => ScriptApp.deleteTrigger(d));
  } catch (e) {
    console.log('Nettoyage des déclencheurs impossible : ' + e.message);
  }
}

/** Garde le compte rendu de chaque collecte dans l'onglet Journal (les plus récents en haut). */
function noterJournal(message, detail) {
  try {
    const feuille = classeur().getSheetByName('Journal') || classeur().insertSheet('Journal');
    if (feuille.getLastRow() === 0) {
      feuille.getRange(1, 1, 1, 3).setValues([['Date', 'Résultat', 'Détail']]).setFontWeight('bold');
      feuille.setFrozenRows(1);
    }
    feuille.insertRowAfter(1);
    feuille.getRange(2, 1, 1, 3).setValues([[new Date(), message, String(detail || '').slice(0, 45000)]]);
  } catch (e) {
    console.log('Journal impossible : ' + e.message);
  }
}

function supprimerDeclencheurs() {
  ScriptApp.getProjectTriggers()
    .filter(d => ['collecteAutomatique', 'collecteALouverture', 'miseAJourAutomatique'].includes(d.getHandlerFunction()))
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
  rangerCleDesReglages();
  const r = collecter({});
  console.log(r.message + '\n' + r.journal);
}

/** Lancé à l'ouverture du classeur : collecte seulement si celle du jour n'est pas faite. */
function collecteALouverture() {
  rangerCleDesReglages();
  const cfg = lireReglages();
  if (cfg.tableau_a_l_ouverture) {
    try { ouvrirTableauDeBord(); return; } catch (e) { console.log('Tableau de bord impossible à ouvrir : ' + e.message); }
  }
  if (!cfg.a_l_ouverture || !cle() || derniereCollecte() === aujourdhui()) return;
  message('Collecte du jour en cours (environ 1 minute)…', 60);
  const r = collecter({});
  message(r.message, 10);
}

function message(texte, secondes) {
  try { classeur().toast(texte, 'Veille hôtels', secondes); } catch (e) { console.log(texte); }
}


// =====================================================================
//  Page web (facultatif : Déployer > Nouveau déploiement > Application Web)
//  La page (index.html à la racine du dépôt) est lue sur GitHub à chaque ouverture.
//  Avec ?api=… l'application Web sert les données à la page GitHub Pages.
// =====================================================================

function doGet(e) {
  const parametres = (e && e.parameter) || {};
  if (parametres.api) return repondreApi(parametres);
  return HtmlService.createHtmlOutput(UrlFetchApp.fetch(URL_PAGE).getContentText())
    .setTitle('Veille hôtels Luchon')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Données et actions pour la page GitHub Pages (application Web déployée pour « Tout le monde »).
 * Lire les données est libre (prix publics). Les actions qui consomment des requêtes demandent
 * le code d'accès des Réglages ; la collecte du jour (« auto ») n'en demande pas : elle respecte
 * la fréquence et le garde-fou du quota, donc elle ne coûte rien de plus qu'à l'ouverture du classeur.
 */
function repondreApi(parametres) {
  let resultat;
  try {
    if (parametres.api === 'lireDonnees') {
      resultat = lireDonnees();
    } else if (parametres.api === 'collecterDepuisPage') {
      const demande = JSON.parse(parametres.arg || 'null') || { action: 'auto' };
      const action = typeof demande === 'object' ? demande.action : 'collecte';
      if (ACTIONS_PROTEGEES.includes(action) && !codeAccesValide(parametres.code)) {
        resultat = { ok: false, faite: false, codeRefuse: true, message: "Code d'accès incorrect (onglet Réglages du classeur).", journal: '' };
      } else {
        resultat = collecterDepuisPage(demande);
      }
    } else {
      resultat = { erreur: 'Demande inconnue : ' + parametres.api };
    }
  } catch (err) {
    resultat = { erreur: err.message };
  }
  return ContentService.createTextOutput(JSON.stringify(resultat)).setMimeType(ContentService.MimeType.JSON);
}

function codeAccesValide(code) {
  const attendu = String(valeurReglage("Code d'accès de la page web") || '').trim();
  return attendu !== '' && String(code || '').trim() === attendu;
}

/** Données du tableau de bord : relevés (dates en AAAA-MM-JJ), réglages, journal et état de la collecte. */
function lireDonnees() {
  const cfg = lireReglages();
  const reglages = classeur().getSheetByName('Réglages');
  return {
    prix: lireObjets('prix'), avis: lireObjets('avis'), hotels: lireObjets('hotels'), usage: lireObjets('compteur'),
    reglages: {
      hotels: cfg.hotels.map(h => h.nom),
      dates: datesValides(cfg, []).map(d => ({ nom: d.nom, arrivee: d.arrivee })),
      heure: cfg.heure, frequence_jours: cfg.frequence_jours, fiches_par_jour: cfg.fiches_par_jour,
      a_l_ouverture: cfg.a_l_ouverture, quota: cfg.quota,
    },
    journal: lireJournal(15),
    budget: (() => {
      const dernier = lireObjets('compteur').pop();
      const compte = dernier && dernier.requetes_restantes !== '' ? { plan_searches_left: Number(dernier.requetes_restantes) } : {};
      const p = projectionMois(cfg, datesValides(cfg, []).length);
      return { restantes: requetesRestantes(cfg, compte).valeur, reserve: cfg.marge, besoin: p.total, joursRestants: p.joursRestants };
    })(),
    etat: {
      cleOk: !!cle(), faite: derniereCollecte() === aujourdhui(), aOuverture: cfg.a_l_ouverture,
      derniereCollecte: valeurReglage('Dernière collecte'), miseAJour: valeurReglage('Mise à jour du script'),
    },
    urlClasseur: classeur().getUrl(),
    urlReglages: classeur().getUrl() + (reglages ? '#gid=' + reglages.getSheetId() : ''),
  };
}

function valeurReglage(libelle) {
  const cellule = celluleReglage(libelle);
  return cellule ? String(cellule.getDisplayValue()) : '';
}

/** Les dernières lignes de l'onglet Journal : [{ date, resultat, detail }]. */
function lireJournal(n) {
  const feuille = classeur().getSheetByName('Journal');
  if (!feuille || feuille.getLastRow() < 2) return [];
  return feuille.getRange(2, 1, Math.min(n, feuille.getLastRow() - 1), 3).getValues().map(l => ({
    date: l[0] instanceof Date ? Utilities.formatDate(l[0], FUSEAU, 'dd/MM/yyyy HH:mm') : String(l[0]),
    resultat: String(l[1]), detail: String(l[2]),
  }));
}

function etatCollecte() {
  return { cleOk: !!cle(), faite: derniereCollecte() === aujourdhui(), aOuverture: lireReglages().a_l_ouverture };
}

/**
 * Actions du tableau de bord. Le chargeur ne transmet qu'un argument : soit vrai/faux (forcer la collecte),
 * soit une demande { action: 'collecte' | 'auto' | 'essai' | 'fiches', hotel }.
 */
function collecterDepuisPage(demande) {
  if (demande && typeof demande === 'object') {
    if (demande.action === 'essai') return collecter({ essai: true, hotel: String(demande.hotel || '').trim() });
    if (demande.action === 'fiches') return collecter({ forcer: true, fiches: true });
    if (demande.action === 'auto') return collecter({}); // ouverture du tableau de bord : respecte la fréquence
    return collecter({ forcer: true });
  }
  return collecter({ forcer: !!demande });
}


// =====================================================================
//  La collecte
// =====================================================================

/**
 * options : { essai, hotel, fiches, forcer }
 * Renvoie { ok, faite (des lignes ont été enregistrées), message, journal }.
 */
function collecter(options) {
  nettoyerDeclencheurs();
  const verrou = LockService.getScriptLock();
  if (!verrou.tryLock(1000)) return { ok: false, faite: false, message: 'Une collecte est déjà en cours.', journal: '' };
  const journal = [];
  let r;
  try {
    r = collecterSansVerrou(options || {}, journal);
  } catch (e) {
    r = { ok: false, faite: false, message: 'Erreur : ' + e.message, journal: journal.join('\n') };
  }
  try {
    if (!(options || {}).essai) noterEtat(r.message);
    noterJournal((options || {}).essai ? 'Essai : ' + r.message : r.message, r.journal);
    return r;
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

  // Fiches détaillées (prix site par site) : quelques-unes chaque jour, à tour de rôle ;
  // toutes d'un coup avec le menu « Collecte + fiches détaillées » ; une seule pour un essai
  const nbFichesVoulues = opts.essai ? 1 : opts.fiches ? hotels.length : cfg.fiches_par_jour;

  // --- Budget : ne jamais dépasser le quota SerpApi ---
  const budget = budgetCollecte(cfg, compte, sejours, nbFichesVoulues, !!opts.essai, journal);
  if (budget.arret) return { ok: false, faite: false, journal: journal.join('\n'), message: budget.arret };
  sejours = budget.sejours;

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

  // --- 2) Recherche ciblée sur le nom d'un hôtel jamais trouvé (au plus une par collecte) ---
  if (budget.cible && !opts.essai) {
    const memoire = PropertiesService.getScriptProperties();
    const candidat = hotels.find(h => !infos[h.nom] && !jetonsConnus[h.nom]
      && ecartJours(memoire.getProperty('cible|' + h.nom) || '2000-01-01', jour) >= 7);
    if (candidat) {
      memoire.setProperty('cible|' + candidat.nom, jour);
      const s = sejours[0];
      journal.push('> Recherche ciblée : « ' + candidat.nom + ' »');
      try {
        const donnees = appelerSerpapi({ q: candidat.nom + ' ' + cfg.ville, check_in_date: s.arrivee,
          check_out_date: s.depart, adults: cfg.adultes }, etat);
        // Google renvoie soit une liste, soit directement la fiche de l'hôtel
        const proprietes = donnees.properties || (donnees.property_token ? [donnees] : []);
        const p = associerHotels([candidat], proprietes, {})[candidat.nom];
        if (p) {
          infos[candidat.nom] = p;
          let lignes = lignesPrix(p, (p.featured_prices || []).concat(p.prices || []), jour, candidat.nom, s.nom, s.arrivee);
          if (!lignes.length && prixNuit(p) !== null) {
            lignes = [{ date_releve: jour, hotel: candidat.nom, sejour: s.nom, date_sejour: s.arrivee,
              site: 'Google (prix le plus bas)', prix_nuit_eur: prixNuit(p), offre: '', lien: p.link || '' }];
          }
          prix = prix.concat(lignes);
          if (p.overall_rating) avis[candidat.nom] = ligneAvis(jour, candidat.nom, p, notesDetaillees(p));
          journal.push('  - trouvé (Google : « ' + p.name + ' ») : ' + lignes.length + ' site(s). Il aura ses fiches à tour de rôle.');
        } else {
          journal.push('  - toujours introuvable : vérifiez son nom sur Google Hotels (colonne « Autres noms » des Réglages). Nouvel essai dans 7 jours.');
        }
      } catch (e) {
        journal.push('  - recherche impossible (' + e.message + ')');
      }
    }
  }

  // --- 3) Fiches détaillées : prix site par site, petit-déjeuner, étoiles, notes détaillées ---
  const taches = choisirFiches(hotels, sejours, infos, jetonsConnus, budget.nbFiches, opts);
  const detailles = [];
  if (taches.length) journal.push('> Fiches détaillées (à tour de rôle)');
  taches.forEach(({ hotel: h, sejour: s, jeton }) => {
    let fiche;
    try {
      fiche = appelerSerpapi({ property_token: jeton, check_in_date: s.arrivee,
        check_out_date: s.depart, adults: cfg.adultes }, etat);
    } catch (e) {
      journal.push('  - ' + h.nom + ' (' + s.nom + ') : fiche indisponible (' + e.message + ')');
      return;
    }
    PropertiesService.getScriptProperties().setProperty('fiche|' + h.nom + '|' + s.nom, jour);
    const blocs = (fiche.featured_prices || []).concat(fiche.prices || []);
    const lignes = lignesPrix(fiche, blocs, jour, h.nom, s.nom, s.arrivee);
    if (lignes.length) { // la fiche est plus complète : elle remplace la recherche pour cette date
      prix = prix.filter(l => !(l.hotel === h.nom && l.date_sejour === s.arrivee)).concat(lignes);
    }
    if (fiche.overall_rating) avis[h.nom] = ligneAvis(jour, h.nom, fiche, notesDetaillees(fiche));
    infos[h.nom] = Object.assign({}, infos[h.nom] || {}, fiche, { property_token: jeton });
    detailles.push(h.nom);
    journal.push('  - ' + h.nom + ' (' + s.nom + ') : ' + (lignes.length ? lignes.length + ' site(s)' : 'pas de prix (complet ou fermé ?)')
      + ', note ' + (fiche.overall_rating || '?'));
  });

  // Fiche hôtel : écrite si elle vient d'être détaillée, ou si l'hôtel est nouveau
  const fiches = [];
  hotels.forEach(h => {
    const p = infos[h.nom];
    if (!p || !(detailles.includes(h.nom) || !fichesConnues[h.nom])) return;
    const resto = restauration(p);
    fiches.push({ date_maj: jour, hotel: h.nom, nom_google: p.name || '', categorie_etoiles: etoiles(p),
      restaurant_sur_place: resto[0], petit_dejeuner_propose: resto[1],
      equipements_principaux: (p.amenities || []).slice(0, 12).join(', '), property_token: p.property_token || '',
      photo: photo(p) });
  });

  const compteApres = lireCompte();
  journal.push('Requêtes utilisées par ce lancement : ' + etat.requetes);
  if (texteQuota(compteApres)) journal.push(texteQuota(compteApres));

  // Le compteur note aussi les essais : il sert d'estimation si SerpApi ne répond pas
  const ligneCompteur = {
    date_releve: jour, requetes_ce_lancement: etat.requetes,
    requetes_ce_mois: valeurOuVide(compteApres.this_month_usage),
    quota_mois: compteApres.searches_per_month || cfg.quota,
    requetes_restantes: valeurOuVide(compteApres.plan_searches_left),
  };

  // --- 3) Enregistrement (sauf en mode essai) ---
  if (opts.essai) {
    ajouterLignes('compteur', [ligneCompteur]);
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
  ajouterLignes('compteur', [ligneCompteur]);
  return { ok: true, faite: true, journal: journal.join('\n'),
    message: 'Collecte enregistrée : ' + prix.length + ' prix, ' + Object.keys(avis).length + ' notes, '
      + fiches.length + ' fiches.' };
}


/**
 * Choisit les fiches détaillées du jour : des couples hôtel + date. D'abord les hôtels détaillés il y a
 * le plus longtemps (jamais = en premier ; à égalité, ceux sans prix dans la recherche du jour),
 * puis, pour chaque hôtel, sa date détaillée il y a le plus longtemps.
 * Avec le menu « Collecte + fiches détaillées » : tous les hôtels, pour la première date.
 */
function choisirFiches(hotels, sejours, infos, jetonsConnus, nombre, opts) {
  if (!nombre || !sejours.length) return [];
  const jeton = h => (infos[h.nom] && infos[h.nom].property_token) || jetonsConnus[h.nom];
  const avecJeton = hotels.filter(jeton);
  if (opts.fiches || opts.essai) {
    return avecJeton.slice(0, nombre).map(h => ({ hotel: h, sejour: sejours[0], jeton: jeton(h) }));
  }
  const memoire = PropertiesService.getScriptProperties();
  const couples = [];
  avecJeton.forEach((h, i) => {
    const dates = sejours.map(s => memoire.getProperty('fiche|' + h.nom + '|' + s.nom) || '');
    const hotelDerniere = dates.slice().sort().pop(); // dernière fiche de cet hôtel, toutes dates confondues
    sejours.forEach((s, j) => couples.push({
      hotel: h, sejour: s, jeton: jeton(h), ordre: i * 100 + j, derniere: dates[j], hotelDerniere: hotelDerniere,
      sansPrix: !(infos[h.nom] && prixNuit(infos[h.nom]) !== null),
    }));
  });
  // D'abord l'hôtel détaillé il y a le plus longtemps, puis sa date la plus ancienne
  couples.sort((a, b) => a.hotelDerniere.localeCompare(b.hotelDerniere) || (b.sansPrix - a.sansPrix)
    || a.derniere.localeCompare(b.derniere) || (a.ordre - b.ordre));
  const choisis = [], dejaPris = new Set();
  // Pas deux fiches du même hôtel le même jour tant qu'il reste d'autres hôtels à détailler
  couples.forEach(c => { if (choisis.length < nombre && !dejaPris.has(c.hotel.nom)) { choisis.push(c); dejaPris.add(c.hotel.nom); } });
  couples.forEach(c => { if (choisis.length < nombre && !choisis.includes(c)) choisis.push(c); });
  return choisis;
}


// =====================================================================
//  Garde-fou du quota SerpApi (offre gratuite : 250 requêtes par mois, 50 par heure)
// =====================================================================

const PLAFOND_PAR_COLLECTE = 45; // SerpApi accepte 50 requêtes par heure : on reste en dessous

/**
 * Décide combien de requêtes cette collecte peut utiliser, pour ne jamais dépasser le quota :
 * - requêtes restantes lues sur le compte SerpApi (gratuit) ; s'il ne répond pas, estimées
 *   avec l'onglet Compteur (quota moins les requêtes notées ce mois-ci) ;
 * - la « Réserve de requêtes » des Réglages n'est jamais entamée ;
 * - si le rythme actuel ne tient pas jusqu'à la fin du mois, on réduit : d'abord les fiches
 *   détaillées, puis le nombre de dates (celles du haut de la liste des Réglages passent en premier).
 * Renvoie { sejours, nbFiches, cible } ou { arret: 'message' } (cible : une recherche ciblée est permise).
 */
function budgetCollecte(cfg, compte, sejours, nbFichesVoulues, essai, journal) {
  const restantes = requetesRestantes(cfg, compte);
  const disponible = restantes.valeur - cfg.marge;
  const parDate = cfg.pages_max;
  const projection = projectionMois(cfg, sejours.length);
  journal.push('Budget : ' + restantes.valeur + ' requêtes restantes (' + restantes.source + '), réserve de '
    + cfg.marge + ', besoin estimé d\'ici la fin du mois : ' + projection.total + '.');
  if (disponible < parDate) {
    return { arret: 'Quota SerpApi atteint (réserve de ' + cfg.marge + ' gardée) : pas de collecte avant le mois prochain.' };
  }
  let dates = sejours, nbFiches = nbFichesVoulues;
  if (!essai && projection.total > disponible) {
    // Le rythme ne tient pas jusqu'à la fin du mois : moins de fiches par jour (voire aucune)
    nbFiches = Math.min(nbFiches, Math.max(0, Math.floor((disponible - projection.dates) / projection.collectes)));
  }
  nbFiches = Math.min(nbFiches, Math.max(0, Math.min(disponible, PLAFOND_PAR_COLLECTE) - dates.length * parDate));
  if (nbFiches < nbFichesVoulues) {
    journal.push('! Économie de requêtes : ' + nbFiches + ' fiche(s) détaillée(s) sur ' + nbFichesVoulues + " aujourd'hui.");
  }
  let garde = Math.min(dates.length, Math.floor(Math.min(disponible, PLAFOND_PAR_COLLECTE) / parDate));
  if (!essai && projection.dates > disponible) {
    // Le rythme quotidien ne tient pas : on répartit ce qui reste sur les collectes à venir
    garde = Math.min(garde, Math.max(1, Math.floor(disponible / projection.collectes / parDate)));
  }
  if (garde < dates.length) {
    journal.push('! Économie de requêtes : ' + garde + ' date(s) sur ' + dates.length + " aujourd'hui ("
      + dates.slice(0, garde).map(d => d.nom).join(', ') + ').');
    dates = dates.slice(0, garde);
  }
  // Recherche ciblée d'un hôtel jamais trouvé : seulement s'il reste de la marge
  const cible = !essai && projection.total + 4 <= disponible
    && dates.length * parDate + nbFiches + 1 <= Math.min(disponible, PLAFOND_PAR_COLLECTE);
  return { sejours: dates, nbFiches: nbFiches, cible: cible };
}

/** Requêtes restantes ce mois-ci : { valeur, source }. */
function requetesRestantes(cfg, compte) {
  if (compte && typeof compte.plan_searches_left === 'number') {
    return { valeur: compte.plan_searches_left, source: 'compte SerpApi' };
  }
  const mois = aujourdhui().slice(0, 7);
  const utilisees = lireObjets('compteur').filter(l => String(l.date_releve).startsWith(mois))
    .reduce((total, l) => total + (Number(l.requetes_ce_lancement) || 0), 0);
  return { valeur: cfg.quota - utilisees, source: 'estimation avec l\'onglet Compteur, SerpApi ne répond pas' };
}

/** Requêtes nécessaires d'ici la fin du mois (aujourd'hui compris) avec les réglages actuels. */
function projectionMois(cfg, nbDates) {
  const [a, m, j] = aujourdhui().split('-').map(Number);
  const joursDansLeMois = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const joursRestants = joursDansLeMois - j + 1;
  const collectes = Math.ceil(joursRestants / Math.max(1, cfg.frequence_jours));
  const dates = collectes * nbDates * cfg.pages_max;
  const fiches = collectes * cfg.fiches_par_jour;
  return { dates: dates, fiches: fiches, total: dates + fiches, collectes: collectes, joursRestants: joursRestants };
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
                    'luchon', 'bagneres', 'the', 'and', 'residence', 'residences'];
  return String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').split(' ').filter(m => m && !inutiles.includes(m));
}

/**
 * Note de 0 à 1 : à quel point deux noms d'hôtels se ressemblent.
 * On compare mot par mot (deux mots presque identiques comptent comme un seul, ex. « celeste » / « celestes »).
 */
function ressemblance(nomA, nomB) {
  const a = [...new Set(simplifier(nomA))], b = [...new Set(simplifier(nomB))];
  if (!a.length || !b.length) return 0;
  const communs = a.filter(m => b.some(n => motsProches(m, n))).length;
  return communs / (a.length + b.length - communs);
}

function motsProches(a, b) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5) return false; // les mots courts doivent être identiques
  const paires = t => { const r = []; for (let i = 0; i < t.length - 1; i++) r.push(t.slice(i, i + 2)); return r; };
  const pa = paires(a), pb = paires(b).slice();
  let n = 0;
  pa.forEach(p => { const i = pb.indexOf(p); if (i >= 0) { n++; pb.splice(i, 1); } });
  return (2 * n) / (pa.length + paires(b).length) >= 0.8;
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

function photo(p) {
  const image = (p.images || [])[0] || {};
  return image.thumbnail || image.original_image || '';
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
  const feuille = classeur().getSheetByName('Réglages');
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
    fiches_par_jour: Math.max(0, Math.round(nombre('Fiches détaillées par jour', 2))),
    heure: nombre('Heure de la collecte automatique', 7),
    a_l_ouverture: String(parLibelle["Collecter à l'ouverture du classeur"] || 'oui').toLowerCase().trim().startsWith('o'),
    tableau_a_l_ouverture: String(parLibelle["Ouvrir le tableau de bord à l'ouverture"] || 'oui').toLowerCase().trim().startsWith('o'),
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
    if (d.arrivee instanceof Date || (typeof d.arrivee === 'number' && d.arrivee > 1000)) arrivee = enIsoValeur(d.arrivee);
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
/** Une valeur de cellule en AAAA-MM-JJ : vraie date, ou nombre de jours du tableur (cellule au format nombre). */
function enIsoValeur(v) {
  if (v instanceof Date) return enIso(v);
  if (typeof v === 'number' && v > 1000) return Utilities.formatDate(new Date(Date.UTC(1899, 11, 30) + v * 86400000), 'UTC', 'yyyy-MM-dd');
  return String(v);
}
function versDate(iso) { return Utilities.parseDate(iso, FUSEAU, 'yyyy-MM-dd'); }
function decaler(iso, jours) {
  const [a, m, j] = iso.split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(a, m - 1, j + jours)), 'UTC', 'yyyy-MM-dd');
}
function ecartJours(isoA, isoB) { return Math.round((Date.parse(isoB) - Date.parse(isoA)) / 86400000); }
function valeurOuVide(v) { return v === undefined || v === null ? '' : v; }

function feuilleDonnees(cleOnglet) {
  const [nom, colonnes] = ONGLETS[cleOnglet];
  const feuille = classeur().getSheetByName(nom) || classeur().insertSheet(nom);
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
      colonnes.forEach((c, i) => { o[c] = COLONNES_DATES.includes(c) ? enIsoValeur(l[i]) : l[i]; });
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
    .map(l => enIsoValeur(l[0])).filter(Boolean);
  return dates.length ? dates.sort().pop() : '';
}
