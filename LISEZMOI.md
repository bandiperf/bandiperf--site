# Vitrine BandiPerf

Site statique : `index.html`, `mentions-legales.html`, `style.css`, `videos.js`, `videos.json`, `devis.js`, `favicon.svg`.
Le dossier `cloudflare` contient le relais Discord (à installer chez Cloudflare, voir plus bas).
Le fichier `CNAME` indique à GitHub Pages l'adresse `site.bandiperf.fr`.

## Activer le formulaire de devis

Le formulaire est envoyé par **Web3Forms** (gratuit jusqu'à 250 demandes par mois), qui te transmet
chaque demande par e-mail. À faire une seule fois :

1. Va sur **web3forms.com**, saisis `bandiperf@gmail.com` et clique sur « Create Access Key ».
   Tu reçois ta clé par e-mail (une suite de lettres et de chiffres).
2. Sur GitHub, ouvre `index.html`, clique sur le crayon, cherche `COLLE_ICI_TA_CLE_WEB3FORMS`
   et remplace ce texte par ta clé, entre les guillemets. Clique sur « Commit changes ».
3. Une minute plus tard, envoie une demande de test depuis le site : elle doit arriver dans ta boîte.
   Pense à regarder les spams pour la première.

La clé peut être visible dans le code du site : elle permet seulement d'envoyer des demandes vers ta
boîte. Tant qu'elle n'est pas en place, le formulaire affiche « Le formulaire n'est pas encore activé »
avec ton adresse e-mail.

Dans chaque e-mail reçu, le bouton « Répondre » répond directement au client.

## Recevoir les demandes de devis sur Discord

Le site envoie aussi chaque demande sur Discord, en passant par un petit relais gratuit chez
**Cloudflare Workers**. Le relais garde l'adresse du webhook Discord secrète (elle n'apparaît jamais
dans le code du site) et n'accepte que les demandes venant de `site.bandiperf.fr`.
Le code du relais est dans `cloudflare/worker-devis.js`. À faire une seule fois :

1. Dans Discord, crée un salon `#devis` et un webhook pour ce salon (copie son URL).
   Un salon dédié évite de mélanger les devis avec les notifications d'ECURELAY.
2. Crée un compte gratuit sur **dash.cloudflare.com**.
3. Va dans **Workers & Pages → Create → Create Worker**, nomme-le `bandiperf-devis`, puis **Deploy**.
4. Clique sur **Edit code**, efface tout, colle le contenu de `cloudflare/worker-devis.js`, puis **Deploy**.
5. Dans le Worker, ouvre **Settings → Variables and Secrets → Add** :
   type **Secret**, nom `DISCORD_WEBHOOK`, valeur : l'URL du webhook Discord. Enregistre et redéploie.
6. Copie l'adresse du Worker (du type `https://bandiperf-devis.xxxx.workers.dev`).
7. Sur GitHub, dans `index.html`, remplace `COLLE_ICI_ADRESSE_DU_RELAIS_CLOUDFLARE` par cette adresse,
   puis « Commit changes ».

Si tu testes avant d'avoir coché « Enforce HTTPS » sur GitHub Pages, le site est encore en `http://`
et le relais le refusera. Ajoute alors dans le Worker une variable (texte) `ALLOWED_ORIGIN` avec la
valeur `https://site.bandiperf.fr,http://site.bandiperf.fr`.

Le client voit la confirmation dès que la demande est arrivée par au moins un des deux canaux
(e-mail ou Discord) : si l'un tombe en panne, la demande n'est pas perdue.

## Ajouter un avis client en vidéo

Le lecteur façon stories lit la liste `videos.json`. Tant qu'elle est vide (`[]`), il reste masqué.

**1. Prépare la vidéo**
- Format vertical, en **MP4** (le format normal d'un téléphone ou de CapCut).
- **Moins de 25 Mo** : c'est la limite d'envoi par le site de GitHub. Un export en 720p suffit
  largement pour une vidéo de 30 à 60 secondes.
- Donne-lui un nom simple, sans espace ni accent : `julien-golf7.mp4`.
- Facultatif : une image d'aperçu en JPG (`julien-golf7.jpg`), affichée le temps que la vidéo charge.

**2. Envoie-la sur GitHub**
Dans le dépôt, ouvre le dossier `videos`, puis « Add file » → « Upload files ».
Glisse la vidéo (et son image), puis « Commit changes ».

**3. Ajoute-la dans `videos.json`**
Ouvre `videos.json`, clique sur le crayon, et écris (une accolade par vidéo, séparées par une virgule) :

```json
[
  {
    "video": "videos/julien-golf7.mp4",
    "affiche": "videos/julien-golf7.jpg",
    "client": "Julien",
    "vehicule": "Golf 7 2.0 TDI",
    "prestation": "Stage 1",
    "texte": "Une phrase marquante de son avis.",
    "lien": "https://www.instagram.com/reel/xxxxxxxx/"
  },
  {
    "video": "videos/kevin-320d.mp4",
    "client": "Kévin",
    "vehicule": "BMW 320d",
    "prestation": "Stage 2",
    "lien": "https://www.tiktok.com/@bandiperf/video/xxxxxxxx"
  }
]
```

Seul `video` est obligatoire. `lien` affiche « Voir sur Instagram » ou « Voir sur TikTok » selon l'adresse.
L'ordre de la liste est l'ordre de lecture. Clique sur « Commit changes » : le site se met à jour en une minute.

Attention aux guillemets droits `"` et aux virgules : une virgule en trop ou en moins et le lecteur
reste masqué. En cas de doute, colle ton texte sur jsonlint.com pour le vérifier.

## Modifier le reste du site
- Textes : directement dans `index.html`.
- Logo : la marque « BANDIPERF » est écrite en texte en attendant le vrai logo.
  Remplace les blocs `<span class="plein">BANDI</span><span class="contour">PERF</span>` par une image.
- Mentions légales : à compléter dès la création d'une structure (voir le commentaire dans le fichier).
