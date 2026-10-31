/* Veille hôtels Luchon : le chargeur.
   C'est lui qu'on colle dans Apps Script, une seule fois, à la place de tout le contenu de Code.gs.
   Puis : la fonction « installer » est déjà choisie dans la liste en haut (c'est la première) ›
   Exécuter › accepter les autorisations. C'est tout.

   Le vrai programme (apps-script/Code.gs) est lu sur GitHub, dans la branche main.
   Une modification arrive donc toute seule, au plus tard 10 minutes après la fusion dans main :
   plus besoin de recoller. Pour la prendre tout de suite : menu Veille hôtels › Mettre à jour le programme.
   Une copie du dernier programme lu est gardée dans les propriétés du script : si GitHub ne répond pas,
   on continue avec elle. Un programme qui contient une erreur n'est jamais pris : on garde l'ancien. */

// À exécuter une fois : range la clé SerpApi collée dans les Réglages, programme les collectes, lance la première
function installer() { return programme_().installer(); }

const SOURCE = 'https://raw.githubusercontent.com/p69gp84gk7-arch/83nchm4Luch0N-/main/apps-script/Code.gs';
const GARDE = 600; // secondes avant de relire GitHub
const PART = 4000; // une propriété contient au plus 9 ko : la copie de secours est coupée en morceaux
// Ce que le programme lu sur GitHub doit fournir
const FONCTIONS = ['installer', 'collecteAutomatique', 'collecteALouverture', 'doGet', 'lireDonnees',
  'etatCollecte', 'collecterDepuisPage', 'menuCollecter', 'menuEssai', 'menuFiches', 'menuQuota', 'menuCle',
  'menuActiver', 'menuDesactiver', 'noterEtat'];

// Le menu du classeur (créé ici : à l'ouverture, Google n'autorise pas la lecture de GitHub)
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
    .addItem('Mettre à jour le programme depuis GitHub', 'menuMiseAJour')
    .addToUi();
}

// Les portes d'entrée : déclencheurs, menu et page web appellent ces noms
function collecteAutomatique() { return programme_().collecteAutomatique(); }
function collecteALouverture(e) { return programme_().collecteALouverture(e); }
function doGet(e) { return programme_().doGet(e); }
function lireDonnees() { return programme_().lireDonnees(); }
function etatCollecte() { return programme_().etatCollecte(); }
function collecterDepuisPage(forcer) { return programme_().collecterDepuisPage(forcer); }
function menuCollecter() { return programme_().menuCollecter(); }
function menuEssai() { return programme_().menuEssai(); }
function menuFiches() { return programme_().menuFiches(); }
function menuQuota() { return programme_().menuQuota(); }
function menuCle() { return programme_().menuCle(); }
function menuActiver() { return programme_().menuActiver(); }
function menuDesactiver() { return programme_().menuDesactiver(); }
function menuMiseAJour() {
  const r = telecharger_();
  SpreadsheetApp.getUi().alert(r.ok ? 'Programme à jour depuis GitHub (' + r.code.length + ' caractères).'
    : 'Mise à jour impossible : ' + r.erreur + '\n\nLe programme précédent reste en service.');
}

// Le programme est compilé une fois par appel, depuis le cache (10 minutes), sinon GitHub, sinon la copie de secours
let programmeCharge_ = null;
function programme_() {
  if (programmeCharge_) return programmeCharge_;
  let code = CacheService.getScriptCache().get('programme');
  if (!code) { const r = telecharger_(); code = r.ok ? r.code : secours_(); }
  if (!code) throw new Error("programme introuvable (GitHub ne répond pas et aucune copie n'est gardée).");
  programmeCharge_ = compiler_(code);
  return programmeCharge_;
}

function compiler_(code) {
  return new Function(code + '\n;return { ' + FONCTIONS.join(', ') + ' };')();
}

function telecharger_() {
  try {
    const r = UrlFetchApp.fetch(SOURCE + '?t=' + Date.now(), { muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return { ok: false, erreur: 'GitHub répond ' + r.getResponseCode() + '.' };
    const code = r.getContentText();
    const essai = compiler_(code); // un programme qui ne se compile pas n'est pas pris
    if (typeof essai.installer !== 'function') return { ok: false, erreur: 'le programme lu ne contient pas installer.' };
    if (code.length > 100000) return { ok: false, erreur: 'programme trop gros pour le cache (100 ko au plus).' };
    CacheService.getScriptCache().put('programme', code, GARDE);
    if (code !== secours_()) {
      garder_(code);
      try { essai.noterEtat('nouvelle version prise (' + code.length + ' caractères)', 'Mise à jour du script'); } catch (e) {}
    }
    programmeCharge_ = essai;
    return { ok: true, code: code };
  } catch (err) {
    return { ok: false, erreur: err.message };
  }
}

function garder_(code) {
  const p = PropertiesService.getScriptProperties(), morceaux = {}, n = Math.ceil(code.length / PART);
  for (let i = 0; i < n; i++) morceaux['programme-' + i] = code.slice(i * PART, (i + 1) * PART);
  morceaux['programme-n'] = String(n);
  p.setProperties(morceaux);
}

function secours_() {
  const p = PropertiesService.getScriptProperties(), n = Number(p.getProperty('programme-n') || 0);
  let code = '';
  for (let i = 0; i < n; i++) code += p.getProperty('programme-' + i) || '';
  return code;
}

// Jamais appelée : elle montre à Google de quelles autorisations le programme lu sur GitHub a besoin
// (le classeur, les menus, les adresses web, les déclencheurs automatiques, la page web)
function autorisations_() {
  SpreadsheetApp.openById(''); SpreadsheetApp.getActiveSpreadsheet(); SpreadsheetApp.getUi();
  UrlFetchApp.fetch(''); ScriptApp.newTrigger(''); HtmlService.createHtmlOutput('');
}
