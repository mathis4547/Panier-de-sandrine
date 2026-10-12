# Les Paniers de Sandrine

Commandes de paniers de légumes en ligne — maraîchage à Fauillet (47).

- **Page clients** : `https://VOTRE-SITE.netlify.app`
- **Page de Sandrine** : `https://VOTRE-SITE.netlify.app/sandrine` (code requis). Les clients ne voient aucun lien vers cette page. À ajouter sur l'écran d'accueil du téléphone de Sandrine.

## Mise en ligne (GitHub + Netlify)

1. Sur GitHub, créer un dépôt `paniers-sandrine`, puis **Add file → Upload files** et déposer TOUT le contenu de ce dossier (y compris le dossier `netlify/`). **Commit changes**.
2. Sur Netlify : **Add new site → Import an existing project → GitHub** → choisir `paniers-sandrine` → **Deploy** (laisser les réglages par défaut, `netlify.toml` s'occupe de tout).
3. Dans Netlify : **Site configuration → Environment variables → Add a variable**
   - Key : `SANDRINE_CODE`
   - Value : le code de Sandrine (ex. 6 chiffres, pas 1234)
4. **Deploys → Trigger deploy → Deploy site** pour que le code soit pris en compte.
5. **Site configuration → Change site name** → `paniers-sandrine`.

Les commandes sont stockées dans **Netlify Blobs** (inclus, rien à configurer).

## Ce que Sandrine règle elle-même (Espace Sandrine)
- **Date et heure du retrait** + heure limite des commandes (bouton « Changer la date et l'heure »). Passée l'heure limite, les commandes se ferment toutes seules.
- **Légumes et prix** (nom, prix, unité, disponible ou non) dans l'onglet « Légumes et prix ».
- **Tickets pour les poches** : un ticket par client (nom, légumes, prix, total à payer au dépôt), à imprimer et glisser dans chaque poche.
- Tant qu'aucun retrait n'est réglé : vendredi 16 h – 19 h, commandes jusqu'au jeudi 12 h.

## Règles
- Le client compose son panier légume par légume. **Paiement au dépôt**, rien en ligne.
- Le total est recalculé par le serveur à partir des prix enregistrés (un client ne peut pas tricher sur le prix).
- Les prix de départ des légumes sont des exemples : Sandrine doit mettre les siens.
- Ouvert localement (double-clic sur index.html), le site passe en **mode démo** (code 1234, données dans le navigateur).
