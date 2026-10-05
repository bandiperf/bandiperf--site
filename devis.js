/* Formulaire de devis en trois étapes, envoyé par e-mail (Web3Forms) et sur Discord
   (relais Cloudflare, voir cloudflare/worker-devis.js).
   Sans JavaScript, toutes les étapes s'affichent et le formulaire s'envoie normalement. */
(() => {
  "use strict";
  const form = document.getElementById("form-devis");
  if (!form) return;

  const etapes = [...form.querySelectorAll(".etape-devis")];
  const reperes = [...form.querySelectorAll(".etapes-devis li")];
  const erreur = form.querySelector(".devis-erreur");
  const envoye = form.querySelector(".devis-envoye");
  const boutonEnvoyer = form.querySelector(".envoyer");
  const blocPrepa = form.querySelector(".bloc-prepa");
  const champPrepa = blocPrepa.querySelector("textarea");
  let actuelle = 0;

  form.classList.add("par-etapes");

  function afficher(i, avecFocus = true) {
    actuelle = i;
    etapes.forEach((e, j) => { e.hidden = j !== i; });
    reperes.forEach((r, j) => {
      r.classList.toggle("faite", j < i);
      r.classList.toggle("actuelle", j === i);
      if (j === i) r.setAttribute("aria-current", "step"); else r.removeAttribute("aria-current");
    });
    erreur.hidden = true;
    if (avecFocus) {
      const titre = etapes[i].querySelector(".titre-etape");
      titre.focus({ preventScroll: true });
      const haut = form.getBoundingClientRect().top;
      if (haut < 0 || haut > window.innerHeight * 0.5) form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Une étape est valide si chacun de ses champs l'est ; sinon le navigateur montre le premier problème.
  function etapeValide(i) {
    const champs = [...etapes[i].querySelectorAll("input, select, textarea")].filter((c) => !c.closest("[hidden]"));
    for (const c of champs) {
      if (!c.checkValidity()) { c.reportValidity(); return false; }
    }
    return true;
  }

  form.querySelectorAll(".suivant").forEach((b) => b.addEventListener("click", () => {
    if (etapeValide(actuelle)) afficher(actuelle + 1);
  }));
  form.querySelectorAll(".precedent").forEach((b) => b.addEventListener("click", () => afficher(actuelle - 1)));

  // « Déjà préparé ? » : le détail n'apparaît, et n'est obligatoire, que si la réponse est Oui
  form.querySelectorAll('input[name="Déjà préparé"]').forEach((r) => r.addEventListener("change", () => {
    const oui = form.querySelector('input[name="Déjà préparé"]:checked')?.value === "Oui";
    blocPrepa.hidden = !oui;
    champPrepa.required = oui;
    if (oui) champPrepa.focus();
  }));

  // Entrée dans un champ simple : passer à l'étape suivante plutôt qu'envoyer le formulaire
  form.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName === "INPUT" && actuelle < etapes.length - 1) {
      e.preventDefault();
      if (etapeValide(actuelle)) afficher(actuelle + 1);
    }
  });

  function montrerErreur(texte) {
    erreur.textContent = "";
    erreur.append(texte + " Tu peux aussi nous écrire directement à ");
    const lien = document.createElement("a");
    lien.href = "mailto:bandiperf@gmail.com";
    lien.textContent = "bandiperf@gmail.com";
    erreur.append(lien, ".");
    erreur.hidden = false;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!etapeValide(actuelle)) return;

    const donnees = new FormData(form);
    const configure = (v) => Boolean(v) && !String(v).startsWith("COLLE_ICI");
    const emailActif = configure(donnees.get("access_key"));
    const relais = form.dataset.relais || "";
    const discordActif = configure(relais);
    if (!emailActif && !discordActif) {
      montrerErreur("Le formulaire n’est pas encore activé.");
      return;
    }

    // Les cases « Recherche » cochées sont regroupées sur une seule ligne
    const recherche = donnees.getAll("Recherche").join(", ");
    const envoi = {};
    for (const [cle, valeur] of donnees.entries()) {
      if (cle === "botcheck") continue;
      if (cle === "Recherche") {  // à sa place dans l'ordre du formulaire, une seule fois
        if (recherche && !("Recherche" in envoi)) envoi["Recherche"] = recherche;
        continue;
      }
      const v = String(valeur).trim();
      if (v) envoi[cle] = v;
    }
    if (donnees.get("botcheck")) envoi.botcheck = true;
    envoi.subject = `Demande de devis — ${envoi["Marque"] || ""} ${envoi["Modèle"] || ""}`.trim()
      + (envoi["Prénom"] ? ` (${envoi["Prénom"]})` : "");

    boutonEnvoyer.disabled = true;
    boutonEnvoyer.textContent = "Envoi en cours…";
    erreur.hidden = true;
    // Envoi aux deux canaux en parallèle ; la demande est sauvée si au moins l'un des deux l'a reçue
    const poster = (url, corps, reussi) => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(corps),
    }).then(async (r) => {
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !reussi(j)) throw new Error("refus");
    });
    const envois = [];
    if (emailActif) envois.push(poster(form.action, envoi, (j) => j.success));
    if (discordActif) {
      const pourDiscord = { ...envoi };
      delete pourDiscord.access_key;
      envois.push(poster(relais, pourDiscord, (j) => j.ok));
    }
    try {
      const resultats = await Promise.allSettled(envois);
      if (!resultats.some((r) => r.status === "fulfilled")) throw new Error("aucun envoi");
      etapes.forEach((et) => { et.hidden = true; });
      form.querySelector(".etapes-devis").hidden = true;
      envoye.hidden = false;
      envoye.focus();
    } catch (err) {
      montrerErreur("L’envoi n’a pas fonctionné.");
      boutonEnvoyer.disabled = false;
      boutonEnvoyer.textContent = "Envoyer ma demande";
    }
  });

  afficher(0, false);
})();
