# ABIDI — Rapport Journalier Minoterie (Prototype v0.1)

Application mobile-first / PWA dédiée au rapport **journalier** de la Minoterie.

## Périmètre volontairement limité

Le prototype affiche uniquement :

1. **Production**
2. **Suivi Blé**
3. **Ventes**
4. **Encaissements clients**

Deux rôles sont prévus :

- **ANALYST** : import, prévisualisation, validation et publication.
- **MANAGER** : consultation uniquement des rapports publiés.

Le traitement complexe des fichiers reste sur le PC de l'analyste. L'application reçoit uniquement le résultat quotidien déjà traité/validé.

---

## 1. Test rapide sans Supabase

Le projet démarre en **mode prototype local** si `.env` n'est pas configuré.

### Windows

Double-cliquer sur :

`START_WINDOWS.bat`

Ou dans le terminal VS Code / PowerShell :

```powershell
npm.cmd install
npm.cmd run dev
```

> `npm.cmd` est utilisé pour éviter le blocage fréquent de `npm.ps1` par la politique d'exécution PowerShell.

Ouvrir ensuite :

`http://localhost:4173`

Deux boutons de démonstration sont disponibles :

- **Mon compte** → Analyste
- **Compte manager** → lecture seule

Le prototype contient déjà un rapport exemple.

---

## 2. Tester l'import

Connectez-vous avec **Mon compte**, puis :

1. Cliquer sur **Importer**.
2. Choisir `sample/rapport_exemple.json`.
3. Contrôler l'aperçu des 4 indicateurs.
4. Ajouter éventuellement une observation.
5. Cliquer sur **Valider & publier**.
6. Se déconnecter puis ouvrir le **Compte manager**.

Une nouvelle version est créée si un rapport existe déjà pour la même date.

---

## 3. Format Excel accepté

L'application accepte `.xlsx`, `.xls` et `.json`.

Un fichier Excel doit contenir les quatre feuilles suivantes. Les accents et quelques variantes de noms de colonnes sont tolérés.

### Feuille `Production`

| date | site | produit | quantite_qtx |
|---|---|---|---:|
| 24/09/2026 | G | Farine panifiable | 412.5 |

### Feuille `Suivi Ble`

| date | quota_qtx | livre_groupe_qtx | livre_minoterie_qtx | observation |
|---|---:|---:|---:|---|
| 24/09/2026 | 1000 | 486 | 472 | Livraison CCLS |

### Feuille `Ventes`

| date | client | produit | quantite_qtx | montant_da |
|---|---|---|---:|---:|
| 24/09/2026 | Client A | Farine panifiable | 322 | 1892000 |

### Feuille `Encaissements`

| date | client | montant_da | mode_paiement | reference |
|---|---|---:|---|---|
| 24/09/2026 | Client A | 1500000 | Virement | VIR-2409-A |

Le format pourra être adapté plus tard exactement à votre fichier final réel.

---

## 4. Activer la synchronisation réelle PC → téléphone manager avec Supabase

Le mode local sert uniquement au prototype. Pour que le manager voie depuis son téléphone ce qui est publié depuis votre PC, activez Supabase.

### Étape A — Base de données

Dans Supabase : **SQL Editor** → exécuter :

`supabase/schema.sql`

### Étape B — Créer les deux comptes

Dans **Authentication → Users**, créer :

- votre compte analyste ;
- le compte manager.

Ensuite exécuter les deux exemples `insert into public.profiles ...` qui se trouvent à la fin de `supabase/schema.sql`, après avoir remplacé les emails.

### Étape C — Variables du projet

Copier `.env.example` vers `.env` :

```env
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_ANON_KEY=VOTRE_CLE_ANON_OU_PUBLISHABLE
```

Ne jamais mettre la **service_role key** dans ce projet frontend.

Redémarrer ensuite :

```powershell
npm.cmd run dev
```

L'écran de connexion utilisera alors les vrais comptes Supabase.

---

## 5. Sécurité du prototype cloud

Les règles Supabase incluses font ceci :

- le **manager** peut lire uniquement les rapports `PUBLISHED` ;
- l'**analyste** peut lire et publier ;
- la restriction est appliquée dans la base avec Row Level Security, pas seulement dans l'interface.

---

## 6. Application mobile

L'interface est conçue en priorité pour téléphone et contient un `manifest.webmanifest` + service worker. Après déploiement HTTPS (Cloudflare Pages, par exemple), elle peut être ajoutée à l'écran d'accueil comme PWA.

Pour cette première version, aucun APK n'est nécessaire.

---

## 7. Ce qui est volontairement laissé pour les prochaines versions

- adaptation exacte aux vrais fichiers quotidiens produits sur votre PC ;
- comparaison avec J-1 / semaine / mois ;
- alertes automatiques ;
- stock farine / produit fini ;
- créances détaillées client ;
- export PDF ;
- notifications manager ;
- signature / validation à deux niveaux ;
- intégration avec le dashboard mensuel/global existant.

