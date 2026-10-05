/* Lecteur d'avis clients en vidéo, façon stories.
   La liste des vidéos se trouve dans videos.json (voir LISEZMOI.md). */
(() => {
  "use strict";
  const root = document.getElementById("lecteur");
  if (!root) return;

  const reduitMouvement = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  fetch(root.dataset.source, { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .then((liste) => {
      const videos = (Array.isArray(liste) ? liste : []).filter((v) => v && typeof v.video === "string" && v.video);
      if (videos.length) demarrer(videos);
    })
    .catch(() => { /* pas de liste : le lecteur reste masqué */ });

  function demarrer(videos) {
    const ecran = root.querySelector(".ecran");
    const video = root.querySelector("video");
    const barres = root.querySelector(".progression");
    const boutonSon = root.querySelector(".son");
    const boutonLecture = root.querySelector(".lecture");
    const compteur = root.querySelector(".compteur");
    const client = root.querySelector(".client");
    const details = root.querySelector(".details");
    const citation = root.querySelector(".citation");
    const lien = root.querySelector(".lien-post");

    let index = 0;
    let pauseVoulue = reduitMouvement;  // pas de lecture automatique si l'utilisateur limite les animations
    let visible = true;

    // Une barre de progression par vidéo
    const remplissages = videos.map(() => {
      const barre = document.createElement("span");
      const remplissage = document.createElement("i");
      barre.appendChild(remplissage);
      barres.appendChild(barre);
      return remplissage;
    });

    if (videos.length < 2) {
      root.querySelectorAll(".zone, .nav-lecteur").forEach((el) => { el.hidden = true; });
    }
    root.hidden = false;

    function nomDuLien(url) {
      if (/instagram\.com/i.test(url)) return "Voir sur Instagram";
      if (/tiktok\.com/i.test(url)) return "Voir sur TikTok";
      if (/youtu\.?be/i.test(url)) return "Voir sur YouTube";
      return "Voir la vidéo";
    }

    function afficher(i) {
      index = (i + videos.length) % videos.length;
      const v = videos[index];

      remplissages.forEach((r, j) => { r.style.width = j < index ? "100%" : "0%"; });

      video.src = v.video;
      if (v.affiche) video.poster = v.affiche; else video.removeAttribute("poster");

      client.textContent = v.client || "";
      details.textContent = [v.vehicule, v.prestation].filter(Boolean).join(" — ");
      citation.textContent = v.texte || "";
      citation.hidden = !v.texte;
      if (v.lien) {
        lien.href = v.lien;
        lien.textContent = nomDuLien(v.lien);
        lien.hidden = false;
      } else {
        lien.hidden = true;
      }
      compteur.textContent = `${index + 1} / ${videos.length}`;
      ecran.setAttribute("aria-label", `Vidéo ${index + 1} sur ${videos.length}${v.client ? ", avis de " + v.client : ""}`);

      if (!pauseVoulue && visible) lire(); else enPause();
    }

    function lire() {
      const essai = video.play();
      boutonLecture.hidden = true;
      if (essai && essai.catch) {
        // Lecture automatique refusée par le navigateur : on affiche le bouton
        essai.catch(() => enPause());
      }
    }

    function enPause() {
      video.pause();
      boutonLecture.hidden = false;
    }

    function basculerLecture() {
      if (video.paused) { pauseVoulue = false; lire(); }
      else { pauseVoulue = true; enPause(); }
    }

    // Progression de la vidéo en cours
    video.addEventListener("timeupdate", () => {
      if (video.duration) remplissages[index].style.width = `${(video.currentTime / video.duration) * 100}%`;
    });
    video.addEventListener("ended", () => {
      remplissages[index].style.width = "100%";
      afficher(index + 1);
    });
    video.addEventListener("click", basculerLecture);
    boutonLecture.addEventListener("click", basculerLecture);

    // Navigation : zones de l'écran, flèches, clavier, glissement
    root.querySelectorAll(".prec").forEach((b) => b.addEventListener("click", () => afficher(index - 1)));
    root.querySelectorAll(".suiv").forEach((b) => b.addEventListener("click", () => afficher(index + 1)));
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); afficher(index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); afficher(index + 1); }
    });
    let debutX = null;
    ecran.addEventListener("touchstart", (e) => { debutX = e.touches[0].clientX; }, { passive: true });
    ecran.addEventListener("touchend", (e) => {
      if (debutX === null) return;
      const dx = e.changedTouches[0].clientX - debutX;
      if (Math.abs(dx) > 45) afficher(index + (dx < 0 ? 1 : -1));
      debutX = null;
    });

    // Son : coupé par défaut (obligatoire pour la lecture automatique)
    boutonSon.addEventListener("click", () => {
      video.muted = !video.muted;
      ecran.classList.toggle("avec-son", !video.muted);
      boutonSon.setAttribute("aria-label", video.muted ? "Activer le son" : "Couper le son");
      if (!video.muted && video.paused) { pauseVoulue = false; lire(); }
    });

    // Pause quand le lecteur sort de l'écran, reprise quand il revient
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entrees) => {
        visible = entrees[0].isIntersecting;
        if (!visible && !video.paused) video.pause();
        else if (visible && !pauseVoulue && video.paused) lire();
      }, { threshold: 0.35 }).observe(ecran);
    }

    ecran.tabIndex = 0;
    afficher(0);
  }
})();
