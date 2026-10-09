/**
 * Relais « demande de devis » → Discord, pour la vitrine BandiPerf.
 *
 * À coller dans un Worker Cloudflare (voir LISEZMOI.md de la vitrine).
 * Réglages du Worker (Settings → Variables and Secrets) :
 *   DISCORD_WEBHOOK  (type Secret) : l'URL du webhook Discord. Elle n'apparaît jamais sur le site.
 *   ALLOWED_ORIGIN   (facultatif)  : sites autorisés, séparés par des virgules.
 *                                    Par défaut : site.bandiperf.fr, en https et en http.
 *
 * Chaque demande refusée est notée dans les journaux du Worker (onglet Logs / Observability)
 * avec sa raison, pour pouvoir diagnostiquer une notification qui n'arrive pas.
 */

const ROUGE = 0xff3b2f;

export default {
  async fetch(request, env) {
    const autorises = (env.ALLOWED_ORIGIN || "https://site.bandiperf.fr,http://site.bandiperf.fr")
      .split(",").map((s) => s.trim()).filter(Boolean);
    const origine = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": autorises.includes(origine) ? origine : autorises[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin",
    };
    const repondre = (corps, statut = 200) => {
      if (!corps.ok) console.log(`Refusé (${statut}) : ${corps.erreur} — origine « ${origine || "aucune"} »`);
      return new Response(JSON.stringify(corps), { status: statut, headers: { ...cors, "Content-Type": "application/json" } });
    };

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return repondre({ ok: false, erreur: "méthode non autorisée" }, 405);
    if (!autorises.includes(origine)) return repondre({ ok: false, erreur: "origine refusée" }, 403);
    if (!env.DISCORD_WEBHOOK) return repondre({ ok: false, erreur: "webhook non configuré" }, 500);

    let d;
    try {
      d = await request.json();
    } catch {
      return repondre({ ok: false, erreur: "données illisibles" }, 400);
    }
    if (!d || typeof d !== "object") return repondre({ ok: false, erreur: "données illisibles" }, 400);
    // Piège à robots rempli : on fait semblant d'accepter, sans rien publier
    if (d.botcheck) return repondre({ ok: true });

    const t = (cle, max = 300) => String(d[cle] ?? "").trim().slice(0, max);
    // Le formulaire a déjà tout vérifié : ici, on exige seulement de quoi identifier la demande.
    if (!t("Marque") && !t("Modèle") && !t("email")) {
      return repondre({ ok: false, erreur: "demande vide" }, 400);
    }

    const ligne = (...morceaux) => morceaux.filter(Boolean).join(" · ");
    const champs = [
      { name: "Véhicule", value: ligne(`${t("Marque")} ${t("Modèle")}`, t("Motorisation"), t("Année")) },
      { name: "Détails", value: ligne(t("Carburant"), t("Boîte"), t("Kilométrage") && `${t("Kilométrage")} km`) },
      { name: "Déjà préparé", value: t("Déjà préparé") === "Oui" ? `Oui — ${t("Préparation actuelle", 1000)}` : t("Déjà préparé") },
      { name: "Recherche", value: t("Recherche") },
      { name: "Stage visé", value: t("Stage visé"), inline: true },
      { name: "Usage", value: t("Usage"), inline: true },
      { name: "Contact", value: [t("Prénom"), t("email"), t("Téléphone"), t("Ville")].filter(Boolean).join("\n") },
    ].filter((c) => c.value).map((c) => ({ ...c, value: c.value.slice(0, 1024) }));

    const message = {
      username: "Site BandiPerf",
      // Aucune mention (@everyone, @here, rôles) ne doit pouvoir être déclenchée depuis le formulaire
      allowed_mentions: { parse: [] },
      embeds: [{
        title: `Demande de devis — ${t("Marque")} ${t("Modèle")}`.slice(0, 256),
        description: t("Description", 3000) || "(pas de description)",
        color: ROUGE,
        fields: champs,
        footer: { text: "site.bandiperf.fr" },
        timestamp: new Date().toISOString(),
      }],
    };

    try {
      const r = await fetch(env.DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message),
      });
      if (!r.ok) return repondre({ ok: false, erreur: `Discord a répondu ${r.status} : ${(await r.text()).slice(0, 200)}` }, 502);
    } catch {
      return repondre({ ok: false, erreur: "Discord injoignable" }, 502);
    }
    console.log(`Demande transmise à Discord : ${t("Marque")} ${t("Modèle")} (${t("Prénom")})`);
    return repondre({ ok: true });
  },
};
