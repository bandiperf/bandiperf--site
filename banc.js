/* Banc de puissance de l'accueil : bascule animée entre diesel, essence et éthanol.
   Les courbes sont illustratives (allure typique de chaque moteur), sans valeurs chiffrées.
   Sans JavaScript, la courbe diesel du HTML reste affichée telle quelle. */
(() => {
  "use strict";
  const banc = document.getElementById("banc");
  if (!banc) return;

  const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Couple normalisé (0 à 1) à 9 régimes répartis de gauche à droite.
  const PROFILS = {
    diesel: {
      nom: "Diesel",
      texte: "Du couple massif dès les bas régimes : des reprises qui te collent au siège.",
      origine: [0.10, 0.30, 0.50, 0.56, 0.54, 0.49, 0.43, 0.36, 0.28],
      sur:     [0.12, 0.42, 0.74, 0.81, 0.77, 0.70, 0.60, 0.50, 0.40],
    },
    essence: {
      nom: "Essence",
      texte: "Plus d’allonge et une poussée qui tient jusqu’en haut du compte-tours.",
      origine: [0.08, 0.19, 0.35, 0.45, 0.49, 0.50, 0.49, 0.45, 0.39],
      sur:     [0.10, 0.27, 0.54, 0.69, 0.73, 0.74, 0.72, 0.66, 0.57],
    },
    ethanol: {
      nom: "Éthanol",
      texte: "L’éthanol encaisse plus d’avance : plus de punch, avec un carburant moins cher à la pompe.",
      origine: [0.08, 0.19, 0.35, 0.45, 0.49, 0.50, 0.49, 0.45, 0.39],
      sur:     [0.11, 0.31, 0.61, 0.78, 0.83, 0.84, 0.82, 0.75, 0.65],
    },
  };
  const ORDRE = ["diesel", "essence", "ethanol"];

  // Géométrie du graphique (repère du viewBox 560 × 380)
  const X0 = 50, X1 = 530, BAS = 330, HAUT = 290, N = 64;
  const xDe = (i) => X0 + (X1 - X0) * (i / (N - 1));
  const yDe = (v) => BAS - v * HAUT;

  // Échantillonne les 9 points clés en N points (Catmull-Rom)
  function echantillonner(cles) {
    const n = cles.length - 1, res = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * n, k = Math.min(Math.floor(t), n - 1), u = t - k;
      const p0 = cles[Math.max(k - 1, 0)], p1 = cles[k], p2 = cles[k + 1], p3 = cles[Math.min(k + 2, n)];
      res[i] = 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u);
    }
    return res;
  }
  const COURBES = {};
  for (const cle of ORDRE) {
    COURBES[cle] = { origine: echantillonner(PROFILS[cle].origine), sur: echantillonner(PROFILS[cle].sur) };
  }

  // Tracé lissé passant par les points (Catmull-Rom → Bézier)
  function trace(vals, sens = 1) {
    const pts = [];
    for (let i = 0; i < N; i++) pts.push([xDe(i), yDe(vals[i])]);
    if (sens < 0) pts.reverse();
    let d = "";
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)} `;
    }
    return `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)} ${d}`;
  }

  // Sommet de la courbe sur mesure, affiné entre deux échantillons
  function sommet(vals) {
    let m = 0;
    for (let i = 1; i < N; i++) if (vals[i] > vals[m]) m = i;
    if (m > 0 && m < N - 1) {
      const a = vals[m - 1], b = vals[m], c = vals[m + 1], den = a - 2 * b + c;
      if (den !== 0) return m + Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den));
    }
    return m;
  }
  const valeurA = (vals, idx) => {
    const k = Math.min(Math.max(Math.floor(idx), 0), N - 2), u = idx - k;
    return vals[k] * (1 - u) + vals[k + 1] * u;
  };

  const svg = banc.querySelector("svg");
  const el = {
    origine: svg.querySelector(".origine"),
    sur: svg.querySelector(".surmesure"),
    gain: svg.querySelector(".gain"),
    clip: svg.querySelector(".gain-clip"),
    balayage: svg.querySelector(".balayage"),
    repere: svg.querySelector(".repere"),
    pic: svg.querySelector(".pic"),
  };
  const texte = banc.querySelector(".banc-texte");
  const onglets = [...banc.querySelectorAll("[role=tab]")];
  const curseur = banc.querySelector(".curseur");

  let actuel = { origine: Float64Array.from(COURBES.diesel.origine), sur: Float64Array.from(COURBES.diesel.sur) };
  let picActuel = sommet(actuel.sur);
  let cle = "diesel";

  function dessiner(origine, sur, picIdx) {
    el.origine.setAttribute("d", trace(origine));
    el.sur.setAttribute("d", trace(sur));
    const zone = trace(sur) + "L" + trace(origine, -1).slice(1) + "Z";
    el.gain.setAttribute("d", zone);
    el.clip.setAttribute("d", zone);
    const x = X0 + (X1 - X0) * (picIdx / (N - 1)), y = yDe(valeurA(sur, picIdx));
    el.pic.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    el.repere.setAttribute("x1", x.toFixed(1)); el.repere.setAttribute("x2", x.toFixed(1));
    el.repere.setAttribute("y1", y.toFixed(1));
  }

  const adoucir = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  let animation = 0;

  function morpher(vers) {
    const depart = { origine: Float64Array.from(actuel.origine), sur: Float64Array.from(actuel.sur) };
    const cible = COURBES[vers];
    const picDepart = picActuel, picCible = sommet(cible.sur);
    cancelAnimationFrame(animation);

    if (reduit) {
      actuel = { origine: Float64Array.from(cible.origine), sur: Float64Array.from(cible.sur) };
      picActuel = picCible;
      dessiner(actuel.origine, actuel.sur, picActuel);
      return;
    }

    const DUREE = 1300, VAGUE = 0.38;  // la transformation part de la gauche et se propage vers la droite
    const t0 = performance.now();
    const origine = new Float64Array(N), sur = new Float64Array(N);

    const etape = (now) => {
      const p = Math.min((now - t0) / DUREE, 1);
      for (let i = 0; i < N; i++) {
        const local = adoucir(Math.min(Math.max((p - (i / (N - 1)) * VAGUE) / (1 - VAGUE), 0), 1));
        const localOrigine = adoucir(Math.min(Math.max((p - 0.06 - (i / (N - 1)) * VAGUE) / (1 - VAGUE - 0.06), 0), 1));
        sur[i] = depart.sur[i] + (cible.sur[i] - depart.sur[i]) * local;
        origine[i] = depart.origine[i] + (cible.origine[i] - depart.origine[i]) * localOrigine;
      }
      const picIdx = picDepart + (picCible - picDepart) * adoucir(p);
      dessiner(origine, sur, picIdx);

      // Balayage lumineux façon passage au banc, limité à la zone de gain
      const bx = -90 + (560 + 90) * p;
      el.balayage.setAttribute("x", bx.toFixed(1));
      el.balayage.style.opacity = String(Math.sin(Math.PI * p));

      if (p < 1) {
        animation = requestAnimationFrame(etape);
      } else {
        actuel = { origine: Float64Array.from(cible.origine), sur: Float64Array.from(cible.sur) };
        picActuel = picCible;
        el.balayage.style.opacity = "0";
      }
    };
    animation = requestAnimationFrame(etape);
  }

  function placerCurseur(onglet, instantane) {
    if (instantane) curseur.style.transition = "none";
    curseur.style.width = onglet.offsetWidth + "px";
    curseur.style.transform = `translateX(${onglet.offsetLeft}px)`;
    if (instantane) { void curseur.offsetWidth; curseur.style.transition = ""; }
  }

  function changerTexte(profil) {
    const remplir = () => {
      texte.innerHTML = "";
      const b = document.createElement("b"); b.textContent = profil.nom;
      const s = document.createElement("span"); s.textContent = profil.texte;
      texte.append(b, " ", s);
    };
    if (reduit) { remplir(); return; }
    texte.classList.remove("entre");
    texte.classList.add("sort");
    setTimeout(() => {
      remplir();
      texte.classList.remove("sort");
      void texte.offsetWidth;
      texte.classList.add("entre");
    }, 260);
  }

  function choisir(nouvelle, { focus = false } = {}) {
    if (nouvelle === cle) return;
    cle = nouvelle;
    onglets.forEach((o) => {
      const actif = o.dataset.carburant === nouvelle;
      o.setAttribute("aria-selected", String(actif));
      o.tabIndex = actif ? 0 : -1;
      if (actif) { placerCurseur(o); if (focus) o.focus(); }
    });
    morpher(nouvelle);
    changerTexte(PROFILS[nouvelle]);
  }

  // Défilement automatique, avec une barre de progression sous l'onglet actif
  const PAUSE_AUTO = 5200;
  let auto = !reduit, survole = false, visible = true, progression = null, minuteur = 0;

  function lancerAuto(delai = 0) {
    arreterProgression();
    if (!auto || survole || !visible || document.hidden) return;
    const onglet = onglets.find((o) => o.dataset.carburant === cle);
    const barre = onglet.querySelector("i");
    progression = barre.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
                                { duration: PAUSE_AUTO, delay: delai, easing: "linear", fill: "forwards" });
    progression.onfinish = () => {
      barre.style.transform = "scaleX(0)";
      const suivante = ORDRE[(ORDRE.indexOf(cle) + 1) % ORDRE.length];
      choisir(suivante);
      minuteur = setTimeout(() => lancerAuto(), 700);
    };
  }
  function arreterProgression() {
    clearTimeout(minuteur);
    if (progression) { progression.onfinish = null; progression.cancel(); progression = null; }
  }

  onglets.forEach((o, i) => {
    o.tabIndex = o.getAttribute("aria-selected") === "true" ? 0 : -1;
    o.addEventListener("click", () => {
      auto = false;              // l'utilisateur a choisi : on arrête le défilement automatique
      arreterProgression();
      choisir(o.dataset.carburant);
    });
    o.addEventListener("keydown", (e) => {
      const pas = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!pas) return;
      e.preventDefault();
      auto = false; arreterProgression();
      choisir(onglets[(i + pas + onglets.length) % onglets.length].dataset.carburant, { focus: true });
    });
  });

  banc.addEventListener("pointerenter", () => { survole = true; if (progression) progression.pause(); });
  banc.addEventListener("pointerleave", () => { survole = false; if (progression) progression.play(); else lancerAuto(); });
  banc.addEventListener("focusin", () => { survole = true; if (progression) progression.pause(); });
  banc.addEventListener("focusout", () => { survole = false; if (progression) progression.play(); });
  document.addEventListener("visibilitychange", () => {
    if (!progression) return;
    if (document.hidden) progression.pause(); else if (!survole && visible) progression.play();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entree]) => {
      visible = entree.isIntersecting;
      if (!progression) { if (visible) lancerAuto(); return; }
      if (visible && !survole) progression.play(); else progression.pause();
    }).observe(banc);
  }
  window.addEventListener("resize", () => {
    const actif = onglets.find((o) => o.dataset.carburant === cle);
    if (actif) placerCurseur(actif, true);
  });

  // Démarrage : courbe diesel calculée, onglets visibles, défilement après le tracé initial
  banc.classList.add("anime");
  dessiner(actuel.origine, actuel.sur, picActuel);
  requestAnimationFrame(() => placerCurseur(onglets[0], true));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => placerCurseur(onglets.find((o) => o.dataset.carburant === cle), true));
  lancerAuto(reduit ? 0 : 2200);
})();
