# Les Paniers de Sandrine

Commandes de légumes en ligne — maraîchage à Fauillet (47).

## Liens

- **Page clients** : https://panier-de-sandrine.netlify.app
- **Espace de Sandrine** : https://panier-de-sandrine.netlify.app/sandrine (code requis)

Les clients ne voient aucun lien vers l'espace de Sandrine.
À la première ouverture de `/sandrine`, Sandrine crée elle-même son code (4 à 8 chiffres).

## Ce que Sandrine règle elle-même

- **Date et heure du retrait** + heure limite des commandes (bouton « Changer la date et l'heure »).
  Passée l'heure limite, les commandes se ferment toutes seules.
- **Légumes et prix** : nom, prix, unité, disponible ou non (onglet « Légumes et prix »).
- **Tickets pour les poches** : un ticket par client (nom, légumes, prix, total à payer au dépôt).

## Pour les clients

- Ils composent leur panier légume par légume.
- **Paiement au dépôt**, rien à payer en ligne.

## Technique

- Hébergement : Netlify (projet `panier-de-sandrine`), mis à jour automatiquement à chaque modification de ce dépôt.
- Fichiers : `index.html` (les pages), `netlify/functions/api.mjs` (le serveur des commandes), `netlify.toml` (réglages).
- Données : Netlify Blobs (inclus, gratuit).
- En cas de problème : Netlify → Déploiements → choisir une ancienne version → « Publier ce déploiement ».
