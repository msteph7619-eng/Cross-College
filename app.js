// --- BASE DE DONNÉES LOCALE (LocalStorage) ---
let eleves = JSON.parse(localStorage.getItem('cross_eleves') || '[]');
let courses = JSON.parse(localStorage.getItem('cross_courses') || '[]');
let arrivees = JSON.parse(localStorage.getItem('cross_arrivees') || '[]');

const titreInput = document.getElementById('titreDossard');
titreInput.value = localStorage.getItem('cross_titre') || 'CROSS DU COLLÈGE';
titreInput.addEventListener('input', () => localStorage.setItem('cross_titre', titreInput.value));

function sauvegarder() {
  localStorage.setItem('cross_eleves', JSON.stringify(eleves));
  localStorage.setItem('cross_courses', JSON.stringify(courses));
  localStorage.setItem('cross_arrivees', JSON.stringify(arrivees));
  rafraichirTout();
}

// --- NAVIGATION ---
function changerOnglet(index, btn) {
  if (index !== 1 && scannerActif) arreterScan();
  document.querySelectorAll('.tab-content').forEach((el, i) => el.classList.toggle('active', i === index));
  document.querySelectorAll('nav button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active');
  rafraichirTout();
}

function rafraichirTout() {
  // Onglet 1 : Élèves
  document.getElementById('countEleves').textContent = `Participants enregistrés : ${eleves.length}`;
  document.getElementById('btnPdfDossards').disabled = eleves.length === 0;
  document.getElementById('listeEleves').innerHTML = eleves.map(e => `
    <div class="list-item">
      <span class="badge">#${e.dossard}</span>
      <div style="flex:1"><strong>${e.nom} ${e.prenom}</strong><br><small style="color:#666">Classe : ${e.classe}</small></div>
    </div>
  `).join('');

  // Listes déroulantes des courses
  const options = courses.length
    ? courses.map(c => `<option value="${c}">${c}</option>`).join('')
    : '<option value="">Aucune course créée</option>';
  ['selectCourseScan', 'selectCourseRes', 'selectCourseDel'].forEach(id => {
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = options;
    if (courses.includes(prev)) sel.value = prev;
  });
  document.getElementById('btnStartScan').disabled = courses.length === 0;

  afficherResultatsCourse();
  afficherBilanClasses();
}

// --- IMPORT CSV (COMPATIBLE EXCEL WINDOWS-1252 & UTF-8) ---
document.getElementById('csvInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  let texte = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
  if (texte.includes('\uFFFD')) {
    texte = new TextDecoder('windows-1252').decode(buffer);
  }

  const nouveaux = [];
  let numAuto = 1;
  texte.split(/\r?\n/).forEach(ligne => {
    const propre = ligne.trim();
    if (!propre) return;
    const sep = propre.includes(';') ? ';' : ',';
    const cols = propre.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.some(c => c.toLowerCase() === 'nom')) return;

    if (cols.length >= 4 && !isNaN(parseInt(cols[0]))) {
      nouveaux.push({
        dossard: parseInt(cols[0]),
        nom: cols[1].toUpperCase(),
        prenom: cols[2],
        classe: cols[3].toUpperCase()
      });
    } else if (cols.length >= 3) {
      nouveaux.push({
        dossard: numAuto++,
        nom: cols[0].toUpperCase(),
        prenom: cols[1],
        classe: cols[2].toUpperCase()
      });
    }
  });

  if (nouveaux.length > 0) {
    eleves = nouveaux;
    sauvegarder();
    alert(`${eleves.length} élèves importés avec succès !`);
  } else {
    alert("Fichier CSV vide ou format non reconnu.");
  }
  e.target.value = '';
});

// --- GÉNÉRATION DES BIPS SONORES (Web Audio API) ---
function jouerBip(valide) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = valide ? 'sine' : 'sawtooth';
    osc.frequency.value = valide ? 880 : 220;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, valide ? 140 : 320);
  } catch (e) {}
}

// --- SCAN CAMÉRA ANTI-DOUBLONS ---
let html5QrCode = null;
let scannerActif = false;
let courseActive = '';
let dernierDossardVu = -1;
let dernierTimestamp = 0;

function creerNouvelleCourse() {
  const nom = prompt("Nom de la nouvelle course (ex: 6e Filles, Benjamins...) :");
  if (nom && nom.trim()) {
    const propre = nom.trim();
    if (!courses.includes(propre)) courses.push(propre);
    sauvegarder();
    document.getElementById('selectCourseScan').value = propre;
  }
}

function demarrerScan() {
  courseActive = document.getElementById('selectCourseScan').value;
  if (!courseActive) return;

  document.getElementById('prepScan').style.display = 'none';
  document.getElementById('activeScan').style.display = 'flex';
  document.getElementById('labelCourseActive').textContent = courseActive;
  document.getElementById('scanBanner').textContent = "En attente du 1er arrivant...";

  html5QrCode = new Html5Qrcode("reader");
  scannerActif = true;
  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 15, qrbox: { width: 220, height: 220 } },
    (decodedText) => {
      const num = parseInt(decodedText);
      const maintenant = Date.now();
      if (!isNaN(num) && (num !== dernierDossardVu || maintenant - dernierTimestamp > 3000)) {
        dernierDossardVu = num;
        dernierTimestamp = maintenant;
        traiterDossard(num);
      }
    }
  ).catch(err => {
    alert("Erreur caméra : vérifiez l'autorisation dans les réglages.");
  });
}

function arreterScan() {
  if (html5QrCode && scannerActif) {
    html5QrCode.stop().then(() => {
      html5QrCode.clear();
      scannerActif = false;
    }).catch(() => {});
  }
  document.getElementById('activeScan').style.display = 'none';
  document.getElementById('prepScan').style.display = 'block';
}

function validerManuel() {
  const input = document.getElementById('inputDossardManuel');
  const num = parseInt(input.value);
  if (!isNaN(num)) {
    traiterDossard(num);
    input.value = '';
  }
}

function traiterDossard(numero) {
  const banner = document.getElementById('scanBanner');
  const eleve = eleves.find(e => e.dossard === numero);
  if (!eleve) {
    jouerBip(false);
    banner.textContent = `⚠️ Dossard #${numero} inconnu dans la base !`;
    return;
  }
  if (arrivees.some(a => a.dossard === numero)) {
    jouerBip(false);
    banner.textContent = `⛔ DOUBLON IGNORÉ : #${numero} (${eleve.nom} ${eleve.prenom}) est déjà arrivé !`;
    return;
  }
  arrivees.push({ course: courseActive, dossard: numero });
  jouerBip(true);
  const rang = arrivees.filter(a => a.course === courseActive).length;
  banner.textContent = `✅ Rang ${rang} : ${eleve.nom} ${eleve.prenom} (${eleve.classe})`;
  sauvegarder();
}

// --- RÉSULTATS PAR COURSE & BILAN GLOBAL PAR CLASSE ---
function getClassementCourse(course) {
  return arrivees
    .filter(a => a.course === course)
    .map((a, idx) => {
      const e = eleves.find(el => el.dossard === a.dossard) || { nom: '?', prenom: '?', classe: '?' };
      return { rang: idx + 1, dossard: a.dossard, nom: e.nom, prenom: e.prenom, classe: e.classe, course };
    });
}

function afficherResultatsCourse() {
  const course = document.getElementById('selectCourseRes').value;
  const liste = course ? getClassementCourse(course) : [];
  document.getElementById('countArrives').textContent = `Arrivés : ${liste.length} élèves`;
  document.getElementById('btnPdfCourse').disabled = liste.length === 0;
  document.getElementById('listeResultatsCourse').innerHTML = liste.map(item => `
    <div class="list-item">
      <span class="badge">${item.rang}e</span>
      <div style="flex:1"><strong>${item.nom} ${item.prenom}</strong><br><small>Dossard #${item.dossard} - Classe ${item.classe}</small></div>
    </div>
  `).join('');
}

function getBilanGlobalClasses() {
  let toutes = [];
  courses.forEach(c => { toutes = toutes.concat(getClassementCourse(c)); });
  const groupes = {};
  toutes.forEach(item => {
    if (!groupes[item.classe]) groupes[item.classe] = [];
    groupes[item.classe].push(item.rang);
  });
  return Object.keys(groupes)
    .sort()
    .map(classe => {
      const rangs = groupes[classe];
      const moy = rangs.reduce((a, b) => a + b, 0) / rangs.length;
      return { classe, moyenne: moy, nb: rangs.length };
    });
}

function afficherBilanClasses() {
  const bilan = getBilanGlobalClasses();
  document.getElementById('btnPdfClasses').disabled = bilan.length === 0;
  document.getElementById('listeClasses').innerHTML = bilan.map(b => `
    <div class="list-item">
      <div><strong style="font-size:17px;">Classe ${b.classe}</strong><br><small style="color:#666">${b.nb} élèves arrivés au total</small></div>
      <div style="text-align:right;"><strong style="font-size:19px; color:var(--primary);">${b.moyenne.toFixed(2)}</strong><br><small>moy. rang</small></div>
    </div>
  `).join('');
}

// --- GÉNÉRATION DES PDF (A4) ---
function creerQrDataUrl(texte) {
  const div = document.getElementById('qrHidden');
  div.innerHTML = '';
  new QRCode(div, { text: String(texte), width: 160, height: 160, correctLevel: QRCode.CorrectLevel.M });
  return div.querySelector('canvas').toDataURL('image/png');
}

function getLogoFiligraneDataUrl() {
  try {
    const img = document.getElementById('appLogo');
    if (!img || !img.complete || img.naturalWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 0.16;
    ctx.drawImage(img, 0, 0, 200, 200);
    return canvas.toDataURL('image/png');
  } catch (e) {
    return null; // Évite de bloquer le PDF si le logo n'est pas encore prêt
  }
}

// Fonction universelle d'ouverture/téléchargement compatible Safari iPad & Android
function telechargerOuOuvrirPdf(doc, nomFichier) {
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  // Sur iPad/iPhone, ouvre le PDF dans l'aperçu natif (permet d'imprimer via AirPrint ou d'enregistrer dans Fichiers)
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    window.open(url, '_blank');
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

function genererPdfDossards() {
  try {
    if (!window.jspdf) {
      alert("La bibliothèque PDF n'est pas encore chargée. Connectez-vous une fois à Internet puis rechargez la page.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const titre = (titreInput.value.trim() || 'CROSS DU COLLÈGE').toUpperCase();
    const logoFiligrane = getLogoFiligraneDataUrl();

    const marge = 20, larg = (595 - 3 * marge) / 2, haut = (842 - 3 * marge) / 2;

    eleves.forEach((eleve, idx) => {
      const pos = idx % 4;
      if (idx > 0 && pos === 0) doc.addPage();
      const col = pos % 2, row = Math.floor(pos / 2);
      const left = marge + col * (larg + marge);
      const top = marge + row * (haut + marge);
      const centerX = left + larg / 2;

      // 1. Filigrane uniquement sous le titre et le numéro (si logo chargé)
      if (logoFiligrane) {
        doc.addImage(logoFiligrane, 'PNG', centerX - 52, top + 8, 104, 104);
      }

      // 2. Cadre
      doc.setLineWidth(1.5);
      doc.rect(left, top, larg, haut);

      // 3. Titre et Numéro
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(80);
      doc.text(titre, centerX, top + 28, { align: 'center' });

      doc.setFontSize(64); doc.setTextColor(0);
      doc.text(String(eleve.dossard), centerX, top + 98, { align: 'center' });

      // 4. QR Code
      const qrUrl = creerQrDataUrl(eleve.dossard);
      doc.addImage(qrUrl, 'PNG', centerX - 75, top + 118, 150, 150);

      // 5. Nom, Prénom et Classe
      doc.setFontSize(20);
      doc.text(`${eleve.nom} ${eleve.prenom}`, centerX, top + 308, { align: 'center' });
      doc.setFontSize(17); doc.setFont('helvetica', 'normal'); doc.setTextColor(70);
      doc.text(`Classe : ${eleve.classe}`, centerX, top + 336, { align: 'center' });
    });

    telechargerOuOuvrirPdf(doc, 'Dossards_Cross.pdf');
  } catch (err) {
    alert("Erreur lors de la création du PDF : " + err.message);
  }
}

function genererPdfCourse() {
  try {
    const course = document.getElementById('selectCourseRes').value;
    const liste = getClassementCourse(course);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 50;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(`RÉSULTATS OFFICIELS - ${course.toUpperCase()}`, 40, y);
    y += 30;
    doc.setFontSize(12);
    doc.text("RANG", 40, y); doc.text("DOSSARD", 100, y); doc.text("NOM", 180, y); doc.text("PRÉNOM", 330, y); doc.text("CLASSE", 480, y);
    y += 8; doc.line(40, y, 555, y); y += 20;

    doc.setFont('helvetica', 'normal');
    liste.forEach(item => {
      if (y > 790) { doc.addPage(); y = 50; }
      doc.text(`${item.rang}e`, 40, y);
      doc.text(String(item.dossard), 100, y);
      doc.text(item.nom, 180, y);
      doc.text(item.prenom, 330, y);
      doc.text(item.classe, 480, y);
      y += 22;
    });

    telechargerOuOuvrirPdf(doc, `Resultats_${course.replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    alert("Erreur PDF : " + err.message);
  }
}

function genererPdfClasses() {
  try {
    const bilan = getBilanGlobalClasses();
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    let y = 50;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text("BILAN GLOBAL PAR CLASSE (TOUTES COURSES)", 40, y);
    y += 30;
    doc.setFontSize(12);
    doc.text("CLASSE", 40, y); doc.text("MOYENNE DES RANGS", 180, y); doc.text("TOTAL ARRIVANTS", 390, y);
    y += 8; doc.line(40, y, 555, y); y += 20;

    doc.setFont('helvetica', 'normal');
    bilan.forEach(b => {
      doc.text(b.classe, 40, y);
      doc.text(b.moyenne.toFixed(2), 180, y);
      doc.text(`${b.nb} élèves`, 390, y);
      y += 22;
    });

    telechargerOuOuvrirPdf(doc, 'Bilan_Global_Classes.pdf');
  } catch (err) {
    alert("Erreur PDF : " + err.message);
  }
}


// --- ONGLET GESTION ---
function effacerResultatsCourse() {
  const course = document.getElementById('selectCourseRes').value;
  if (course && confirm(`Effacer toutes les arrivées de « ${course} » ?`)) {
    arrivees = arrivees.filter(a => a.course !== course);
    sauvegarder();
  }
}

function supprimerUneCourse() {
  const course = document.getElementById('selectCourseDel').value;
  if (course && confirm(`Supprimer définitivement la course « ${course} » et ses résultats ?`)) {
    courses = courses.filter(c => c !== course);
    arrivees = arrivees.filter(a => a.course !== course);
    sauvegarder();
  }
}

function viderArrivees() {
  if (confirm("Effacer les arrivées de toutes les courses ?")) {
    arrivees = [];
    sauvegarder();
  }
}

function viderEleves() {
  if (confirm("Supprimer tous les coureurs inscrits ?")) {
    eleves = [];
    sauvegarder();
  }
}

function toutEffacer() {
  if (confirm("ATTENTION : Tout effacer (élèves, courses et résultats) ?")) {
    eleves = []; courses = []; arrivees = [];
    sauvegarder();
  }
}

rafraichirTout();
