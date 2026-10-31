/* Veille hôtels Luchon : le chargeur.
   C'est lui qu'on colle dans Apps Script, une seule fois, à la place de tout le contenu de Code.gs.
   Puis : la fonction « installer » est déjà choisie dans la liste en haut (c'est la première) ›
   Exécuter › accepter les autorisations. C'est tout.

   Le vrai programme (apps-script/Programme.gs) est lu sur GitHub, dans la branche main.
   Une modification arrive donc toute seule, au plus tard 10 minutes après la fusion dans main :
   plus besoin de recoller. Pour la prendre tout de suite : menu Veille hôtels › Mettre à jour le programme.
   Une copie du dernier programme lu est gardée dans les propriétés du script : si GitHub ne répond pas,
   on continue avec elle. Un programme qui contient une erreur n'est jamais pris : on garde l'ancien.

   Les anciennes installations (programme collé directement, ou premier chargeur) se mettent à jour
   vers ce fichier toutes seules : ses noms internes finissent par « VH_ » pour ne gêner aucune d'elles. */

// À exécuter une fois : range la clé SerpApi collée dans les Réglages, programme les collectes, lance la première
function installer() { return programmeVH_().installer(); }

var SOURCE_VH = 'https://raw.githubusercontent.com/p69gp84gk7-arch/83nchm4Luch0N-/main/apps-script/Programme.gs';
var GARDE_VH = 600; // secondes avant de relire GitHub
var PART_VH = 4000; // une propriété contient au plus 9 ko : la copie de secours est coupée en morceaux
// Ce que le programme lu sur GitHub doit fournir
var FONCTIONS_VH = ['installer', 'collecteAutomatique', 'collecteALouverture', 'doGet', 'lireDonnees',
  'etatCollecte', 'collecterDepuisPage', 'menuCollecter', 'menuEssai', 'menuFiches', 'menuQuota', 'menuCle',
  'menuActiver', 'menuDesactiver', 'noterEtat'];

// Le menu du classeur (créé ici : à l'ouverture, Google n'autorise pas la lecture de GitHub)
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Veille hôtels')
    .addItem('Ouvrir le tableau de bord', 'menuQuota')
    .addItem('Lancer la collecte maintenant', 'menuCollecter')
    .addItem("Essai (1 hôtel, 1 date, n'enregistre rien)", 'menuEssai')
    .addItem('Collecte + fiches détaillées', 'menuFiches')
    .addSeparator()
    .addItem('Enregistrer la clé SerpApi', 'menuCle')
    .addItem("Activer l'automatisation", 'menuActiver')
    .addItem("Désactiver l'automatisation", 'menuDesactiver')
    .addItem('Mettre à jour le programme depuis GitHub', 'menuMiseAJour')
    .addToUi();
}

// Les portes d'entrée : déclencheurs, menu et page web appellent ces noms
function collecteAutomatique() { return programmeVH_().collecteAutomatique(); }
function collecteALouverture(e) { return programmeVH_().collecteALouverture(e); }
function doGet(e) { return programmeVH_().doGet(e); }
function lireDonnees() { return programmeVH_().lireDonnees(); }
function etatCollecte() { return programmeVH_().etatCollecte(); }
function collecterDepuisPage(demande) { return programmeVH_().collecterDepuisPage(demande); }
function menuCollecter() { return programmeVH_().menuCollecter(); }
function menuEssai() { return programmeVH_().menuEssai(); }
function menuFiches() { return programmeVH_().menuFiches(); }
function menuQuota() { return programmeVH_().menuQuota(); }
function menuCle() { return programmeVH_().menuCle(); }
function menuActiver() { return programmeVH_().menuActiver(); }
function menuDesactiver() { return programmeVH_().menuDesactiver(); }
function noterEtat(message, libelle) { return programmeVH_().noterEtat(message, libelle); }
// Ancien déclencheur quotidien de mise à jour : il rafraîchit maintenant le programme depuis GitHub
function miseAJourAutomatique() { return telechargerVH_().ok ? 'à jour' : 'GitHub injoignable'; }
function menuMiseAJour() {
  const r = telechargerVH_();
  SpreadsheetApp.getUi().alert(r.ok ? 'Programme à jour depuis GitHub (' + r.code.length + ' caractères).'
    : 'Mise à jour impossible : ' + r.erreur + '\n\nLe programme précédent reste en service.');
}

// Le programme est compilé une fois par appel, depuis le cache (10 minutes), sinon GitHub, sinon la copie de secours
var programmeChargeVH_ = null;
function programmeVH_() {
  if (programmeChargeVH_) return programmeChargeVH_;
  let code = CacheService.getScriptCache().get('programme-vh');
  if (!code) { const r = telechargerVH_(); code = r.ok ? r.code : secoursVH_(); }
  if (!code) throw new Error("programme introuvable (GitHub ne répond pas et aucune copie n'est gardée).");
  programmeChargeVH_ = compilerVH_(code);
  return programmeChargeVH_;
}

function compilerVH_(code) {
  return new Function(code + '\n;return { ' + FONCTIONS_VH.join(', ') + ' };')();
}

function telechargerVH_() {
  try {
    const r = UrlFetchApp.fetch(SOURCE_VH + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return { ok: false, erreur: 'GitHub répond ' + r.getResponseCode() + '.' };
    const code = r.getContentText();
    const essai = compilerVH_(code); // un programme qui ne se compile pas n'est pas pris
    if (typeof essai.installer !== 'function') return { ok: false, erreur: 'le programme lu ne contient pas installer.' };
    if (code.length > 100000) return { ok: false, erreur: 'programme trop gros pour le cache (100 ko au plus).' };
    CacheService.getScriptCache().put('programme-vh', code, GARDE_VH);
    if (code !== secoursVH_()) {
      garderVH_(code);
      try { essai.noterEtat('nouvelle version prise (' + code.length + ' caractères)', 'Mise à jour du script'); } catch (e) {}
    }
    programmeChargeVH_ = essai;
    return { ok: true, code: code };
  } catch (err) {
    return { ok: false, erreur: err.message };
  }
}

function garderVH_(code) {
  const p = PropertiesService.getScriptProperties(), morceaux = {}, n = Math.ceil(code.length / PART_VH);
  for (let i = 0; i < n; i++) morceaux['programme-vh-' + i] = code.slice(i * PART_VH, (i + 1) * PART_VH);
  morceaux['programme-vh-n'] = String(n);
  p.setProperties(morceaux);
}

function secoursVH_() {
  const p = PropertiesService.getScriptProperties(), n = Number(p.getProperty('programme-vh-n') || 0);
  let code = '';
  for (let i = 0; i < n; i++) code += p.getProperty('programme-vh-' + i) || '';
  return code;
}

// Jamais appelée : elle montre à Google de quelles autorisations le programme lu sur GitHub a besoin
// (le classeur, les menus, les adresses web, les déclencheurs automatiques, la page web)
function autorisationsVH_() {
  SpreadsheetApp.openById(''); SpreadsheetApp.getActiveSpreadsheet(); SpreadsheetApp.getUi();
  UrlFetchApp.fetch(''); ScriptApp.newTrigger(''); HtmlService.createHtmlOutput('');
}
