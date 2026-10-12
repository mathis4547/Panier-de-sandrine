// API des Paniers de Sandrine (Netlify Functions + Netlify Blobs)
// Routes :
//   GET  /api/infos                 -> infos publiques (retrait, paniers, légumes, état des commandes)
//   PUT  /api/infos                 -> modifier les réglages : retrait, prix, légumes   (code requis)
//   POST /api/login                 -> vérifier le code de Sandrine
//   POST /api/commandes             -> passer une commande (public) ou en ajouter une (code)
//   GET  /api/commandes?retrait=... -> commandes d'un jour de retrait + dates existantes (code requis)
//   PATCH /api/commandes            -> changer le statut d'une commande               (code requis)
//   DELETE /api/commandes?retrait=..&id=..                                              (code requis)
//
// Le code de Sandrine se règle dans Netlify : variable d'environnement SANDRINE_CODE.

import { getStore } from "@netlify/blobs";

const UNITES = {
  kg: { pas: 0.5 }, piece: { pas: 1 }, botte: { pas: 1 }, sachet: { pas: 1 }, barquette: { pas: 1 }
};
const DEFAULT_SETTINGS = {
  ouvert: true,
  message: "",
  lieu: "À la ferme, à Fauillet",
  retrait: null, // { date: "AAAA-MM-JJ", horaires: "16 h – 19 h", limite: "AAAA-MM-JJTHH:MM" }
  formules: [], // plus de paniers tout prêts : le client compose son panier
  legumes: [
    { id: "butternut", nom: "Courge butternut", prix: 2.5, unite: "kg", dispo: true },
    { id: "poireaux", nom: "Poireaux", prix: 3.2, unite: "kg", dispo: true },
    { id: "carottes", nom: "Carottes", prix: 2.2, unite: "kg", dispo: true },
    { id: "pdt", nom: "Pommes de terre", prix: 1.8, unite: "kg", dispo: true },
    { id: "blettes", nom: "Blettes", prix: 2, unite: "botte", dispo: true },
    { id: "radis-noir", nom: "Radis noir", prix: 1.5, unite: "piece", dispo: true },
    { id: "salade", nom: "Salade", prix: 1.2, unite: "piece", dispo: true },
    { id: "oignons-rouges", nom: "Oignons rouges", prix: 3, unite: "kg", dispo: true }
  ]
};
const STATUTS = ["nouvelle", "preparee", "recuperee"];
const SOURCES = ["site", "telephone", "sms", "messenger", "boite", "sur-place"];

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });

/* ----- Dates à l'heure de Paris ----- */
function parisNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).map(x => [x.type, x.value])
  );
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute));
}
const nowStr = () => parisNow().toISOString().slice(0, 16); // "AAAA-MM-JJTHH:MM" heure de Paris
// Retrait par défaut tant que Sandrine n'en a pas réglé un : vendredi, commandes jusqu'au jeudi 12 h.
function retraitParDefaut() {
  const now = parisNow();
  const f = new Date(now);
  f.setUTCDate(now.getUTCDate() + ((5 - now.getUTCDay() + 7) % 7));
  f.setUTCHours(0, 0, 0, 0);
  const lim = new Date(f); lim.setUTCDate(f.getUTCDate() - 1); lim.setUTCHours(12, 0, 0, 0);
  if (now >= lim) { f.setUTCDate(f.getUTCDate() + 7); lim.setUTCDate(lim.getUTCDate() + 7); }
  return { date: f.toISOString().slice(0, 10), debut: "16:00", fin: "19:00", horaires: "16 h – 19 h", limite: lim.toISOString().slice(0, 16) };
}
const isYmd = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isDateTime = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s);

/* ----- Outils ----- */
const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const newId = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
const prixOk = v => Math.round(Math.max(0, Math.min(999, Number(String(v).replace(",", ".")) || 0)) * 100) / 100;

function codeAttendu() {
  // Accepte SANDRINE_CODE ou sandrine_code (comme réglé dans Netlify)
  const noms = ["SANDRINE_CODE", "sandrine_code", "Sandrine_code"];
  for (const n of noms) {
    let v = "";
    try { if (globalThis.Netlify?.env?.get) v = globalThis.Netlify.env.get(n) || ""; } catch (e) {}
    v = v || process.env[n] || "";
    if (v.trim()) return v.trim();
  }
  return "";
}
async function estSandrine(req) {
  const attendu = codeAttendu();
  const ok = !!attendu && req.headers.get("x-code") === attendu;
  if (!ok) await new Promise(r => setTimeout(r, 700));
  return ok;
}

async function lireReglages(store) {
  const s = await store.get("reglages", { type: "json" });
  const r = { ...DEFAULT_SETTINGS, ...(s || {}) };
  // ancienne version : liste de légumes en texte
  if (Array.isArray(r.legumes) && r.legumes.length && typeof r.legumes[0] === "string") r.legumes = DEFAULT_SETTINGS.legumes;
  if (!r.retrait || !isYmd(r.retrait.date)) r.retrait = retraitParDefaut();
  r.formules = [];
  return r;
}
function etat(reglages) {
  const now = nowStr(), r = reglages.retrait;
  if (!reglages.ouvert) return { ouvert: false, raison: reglages.message || "Pas de commande pour le moment." };
  if (r.limite && now >= r.limite) return { ouvert: false, raison: "Les commandes pour ce retrait sont terminées. Le prochain retrait sera annoncé ici très vite." };
  if (now.slice(0, 10) > r.date) return { ouvert: false, raison: "Le prochain retrait sera annoncé ici très vite." };
  return { ouvert: true };
}

function construireCommande(body, reglages, admin) {
  const lignes = [];
  let total = 0, nbPaniers = 0;
  for (const f of reglages.formules) {
    const q = Math.max(0, Math.min(20, parseInt(body?.paniers?.[f.id], 10) || 0));
    if (q) { lignes.push({ type: "panier", id: f.id, nom: f.nom, qte: q, prix: f.prix }); total += q * f.prix; nbPaniers += q; }
  }
  for (const l of reglages.legumes) {
    if (!l.dispo && !admin) continue;
    const pas = (UNITES[l.unite] || UNITES.piece).pas;
    let q = Number(body?.legumes?.[l.id]) || 0;
    q = Math.max(0, Math.min(50, Math.round(q / pas) * pas));
    if (q) { lignes.push({ type: "legume", id: l.id, nom: l.nom, qte: q, unite: l.unite, prix: l.prix }); total += q * l.prix; }
  }
  const nom = clean(body?.nom, 60);
  const tel = clean(body?.tel, 20);
  if (!nom) return { erreur: "Indiquez votre nom." };
  if (!admin && !/^(\+33|0)[1-9](\s?\d{2}){4}$/.test(tel.replace(/[.\-]/g, " ").replace(/\s+/g, " ").trim()))
    return { erreur: "Indiquez un numéro de téléphone valide (ex. 06 12 34 56 78)." };
  if (!lignes.length) return { erreur: "Choisissez au moins un légume." };
  return {
    commande: {
      id: newId(), creeLe: new Date().toISOString(),
      nom, tel, lignes, nbPaniers, total: Math.round(total * 100) / 100,
      remarque: clean(body?.remarque, 300),
      source: admin && SOURCES.includes(body?.source) ? body.source : "site",
      statut: "nouvelle"
    }
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.replace(/\/+$/, "");
  const store = getStore({ name: "paniers-sandrine", consistency: "strong" });
  let body = null;
  if (["POST", "PUT", "PATCH"].includes(req.method)) {
    try { body = await req.json(); } catch (e) { return json({ erreur: "Requête illisible." }, 400); }
  }

  try {
    if (route === "/api/infos") {
      if (req.method === "GET") {
        const reglages = await lireReglages(store);
        return json({ reglages, etat: etat(reglages) });
      }
      if (req.method === "PUT") {
        if (!(await estSandrine(req))) return json({ erreur: "Code incorrect." }, 401);
        const a = await lireReglages(store);
        const n = { ...a };
        if (typeof body?.ouvert === "boolean") n.ouvert = body.ouvert;
        if (body?.message !== undefined) n.message = clean(body.message, 300);
        if (body?.lieu !== undefined) n.lieu = clean(body.lieu, 80) || a.lieu;
        if (body?.retrait) {
          const r = body.retrait;
          if (!isYmd(r.date)) return json({ erreur: "Choisissez la date du retrait." }, 400);
          if (r.limite && !isDateTime(r.limite)) return json({ erreur: "L'heure limite n'est pas valide." }, 400);
          const hh = s => /^\d{2}:\d{2}$/.test(s || "") ? s : "";
          const fmt = s => s.replace(/^0?(\d+):(\d{2})$/, (m, h, mi) => mi === "00" ? `${h} h` : `${h} h ${mi}`);
          const debut = hh(r.debut), fin = hh(r.fin);
          const horaires = debut && fin ? `${fmt(debut)} – ${fmt(fin)}` : debut ? `à partir de ${fmt(debut)}` : clean(r.horaires, 40) || "horaires à préciser";
          n.retrait = { date: r.date, debut, fin, horaires, limite: r.limite || "" };
        }
        if (Array.isArray(body?.formules)) {
          n.formules = a.formules.map(f => {
            const x = body.formules.find(y => y.id === f.id) || {};
            return { ...f, nom: clean(x.nom ?? f.nom, 40) || f.nom, detail: clean(x.detail ?? f.detail, 80), prix: prixOk(x.prix ?? f.prix) };
          });
        }
        if (Array.isArray(body?.legumes)) {
          const vus = new Set();
          n.legumes = body.legumes.slice(0, 60).map(l => {
            let id = clean(l.id, 30).replace(/[^a-z0-9-]/gi, "") || newId();
            if (vus.has(id)) id = newId();
            vus.add(id);
            return { id, nom: clean(l.nom, 40), prix: prixOk(l.prix), unite: UNITES[l.unite] ? l.unite : "piece", dispo: l.dispo !== false };
          }).filter(l => l.nom);
        }
        await store.setJSON("reglages", n);
        return json({ reglages: n, etat: etat(n) });
      }
    }

    if (route === "/api/login" && req.method === "POST") {
      if (!codeAttendu()) return json({ erreur: "Le code n'est pas encore réglé dans Netlify (variable SANDRINE_CODE)." }, 500);
      return (await estSandrine(req)) ? json({ ok: true }) : json({ erreur: "Code incorrect." }, 401);
    }

    if (route === "/api/commandes") {
      if (req.method === "POST") {
        const avecCode = !!req.headers.get("x-code");
        const admin = avecCode ? await estSandrine(req) : false;
        if (avecCode && !admin) return json({ erreur: "Code incorrect." }, 401);
        if (!admin && body?.site_web) return json({ ok: true, commande: { id: "x" } }); // piège à robots
        const reglages = await lireReglages(store);
        if (!admin) { const e = etat(reglages); if (!e.ouvert) return json({ erreur: e.raison }, 403); }
        const { erreur, commande } = construireCommande(body, reglages, admin);
        if (erreur) return json({ erreur }, 400);
        commande.retrait = admin && isYmd(body?.retrait) ? body.retrait : reglages.retrait.date;
        commande.horaires = reglages.retrait.horaires;
        await store.setJSON(`cmd/${commande.retrait}/${commande.id}`, commande);
        return json({ ok: true, commande });
      }

      if (!(await estSandrine(req))) return json({ erreur: "Code incorrect." }, 401);

      if (req.method === "GET") {
        const reglages = await lireReglages(store);
        const retrait = isYmd(url.searchParams.get("retrait")) ? url.searchParams.get("retrait") : reglages.retrait.date;
        const { blobs } = await store.list({ prefix: "cmd/" });
        const dates = [...new Set(blobs.map(b => b.key.split("/")[1]).concat(reglages.retrait.date))].filter(isYmd).sort();
        const keys = blobs.filter(b => b.key.startsWith(`cmd/${retrait}/`)).map(b => b.key);
        const commandes = (await Promise.all(keys.map(k => store.get(k, { type: "json" })))).filter(Boolean);
        commandes.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
        return json({ retrait, commandes, dates });
      }
      if (req.method === "PATCH") {
        if (!isYmd(body?.retrait) || !body?.id || !STATUTS.includes(body?.statut)) return json({ erreur: "Demande incomplète." }, 400);
        const key = `cmd/${body.retrait}/${clean(body.id, 20)}`;
        const c = await store.get(key, { type: "json" });
        if (!c) return json({ erreur: "Commande introuvable." }, 404);
        c.statut = body.statut;
        await store.setJSON(key, c);
        return json({ ok: true, commande: c });
      }
      if (req.method === "DELETE") {
        const retrait = url.searchParams.get("retrait"), id = clean(url.searchParams.get("id"), 20);
        if (!isYmd(retrait) || !id) return json({ erreur: "Demande incomplète." }, 400);
        await store.delete(`cmd/${retrait}/${id}`);
        return json({ ok: true });
      }
    }
    return json({ erreur: "Adresse inconnue." }, 404);
  } catch (e) {
    console.error(e);
    return json({ erreur: "Problème technique, réessayez dans un instant." }, 500);
  }
};

export const config = { path: ["/api/infos", "/api/login", "/api/commandes"] };
