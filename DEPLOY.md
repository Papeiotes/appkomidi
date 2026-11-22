# Δημοσίευση APPkomidi στο Railway

Η εφαρμογή είναι ήδη δημόσια:

- Web: `https://appkomidi-web-production.up.railway.app`
- API: `https://appkomidi-api-production.up.railway.app`

Οι εντολές τρέχουν από τη ρίζα του αποθετηρίου. Το Railway CLI ανεβάζει τον κώδικα με `railway up`. Δεν χρειάζεται σύνδεση Git.

Τα Dockerfiles χτίζονται από τη ρίζα του monorepo, γιατί το pnpm workspace περιλαμβάνει το `packages/shared`.

## 1. Project και services

```bash
npm i -g @railway/cli
railway login
railway init --name appkomidi
railway add --database postgres
railway add --service appkomidi-api
railway add --service appkomidi-web
```

Η βάση που φτιάχνει το `railway add --database postgres` ονομάζεται `Postgres`. Το API παίρνει τη σύνδεση με αναφορά σε αυτό το όνομα:

```bash
railway variable set 'DATABASE_URL=${{Postgres.DATABASE_URL}}' --service appkomidi-api --skip-deploys
```

Το Dockerfile κάθε service ορίζεται με `RAILWAY_DOCKERFILE_PATH` (ρίζα του repo, όχι φάκελος του app):

```bash
railway variable set RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile --service appkomidi-api --skip-deploys
railway variable set RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile --service appkomidi-web --skip-deploys
```

Τα `railway.api.toml` και `railway.web.toml` δείχνουν τα ίδια paths αν το Railway διαβάζει config-as-code.

## 2. Μεταβλητές

API (`appkomidi-api`):

```bash
railway variable set "JWT_SECRET=$(openssl rand -hex 32)" --service appkomidi-api --skip-deploys
railway variable set TZ=Europe/Athens --service appkomidi-api --skip-deploys
railway variable set ADMIN_USERNAME=admin --service appkomidi-api --skip-deploys
railway variable set 'ADMIN_PASSWORD=Dimarcheio!2026' --service appkomidi-api --skip-deploys
railway variable set ADMIN_NAME=Διαχειριστής --service appkomidi-api --skip-deploys
railway variable set 'MUNICIPALITY_NAME=Δήμος Αθηναίων' --service appkomidi-api --skip-deploys
railway variable set OVERFLOW_KG=75 --service appkomidi-api --skip-deploys
railway variable set SEED_DEMO=0 --service appkomidi-api --skip-deploys
railway variable set NOMINATIM_URL=https://nominatim.openstreetmap.org --service appkomidi-api --skip-deploys
railway variable set OSRM_URL=https://router.project-osrm.org --service appkomidi-api --skip-deploys
railway variable set CORS_ORIGINS=https://appkomidi-web-production.up.railway.app --service appkomidi-api --skip-deploys
```

Το `PORT` το δίνει το Railway. Μην το ορίσεις εσύ.

Web (`appkomidi-web`). Το Next ενσωματώνει τη διεύθυνση στο build, γι' αυτό μπαίνει πριν το `railway up`:

```bash
railway variable set NEXT_PUBLIC_API_URL=https://appkomidi-api-production.up.railway.app --service appkomidi-web --skip-deploys
```

Χωρίς κάθετο στο τέλος. Αν την αλλάξεις, ξανακάνε deploy το web.

Το Socket.IO χρησιμοποιεί το ίδιο HTTPS του API, άρα ο browser ανοίγει `wss`.

## 3. Domains και deploy

```bash
railway domain --service appkomidi-api
railway domain --service appkomidi-web
railway up --service appkomidi-api --detach
railway up --service appkomidi-web --detach
```

Logs και κατάσταση:

```bash
railway logs --service appkomidi-api
railway deployment list --service appkomidi-api
```

Σε κάθε εκκίνηση το API τρέχει `prisma migrate deploy` και μετά τον server. Έλεγχος: `GET /health`.

Νέο deploy μετά από αλλαγές στον κώδικα: το ίδιο `railway up --service …` από τη ρίζα.

## 4. Demo seed

Το `SEED_DEMO=0` μένει η κανονική τιμή, ώστε ένα απλό restart να μην σβήνει ραντεβού.

Για να ξαναγεμίσει η βάση με τους λογαριασμούς `demo_*` και βάρδιες και για τους τέσσερις κάδους:

```bash
railway variable set SEED_DEMO=1 --service appkomidi-api
```

Περίμενε να τελειώσει το redeploy που ξεκινάει αυτή η αλλαγή (`railway logs --service appkomidi-api`, μέχρι το `/health` να απαντά). Μετά γύρνα τη σημαία πίσω:

```bash
railway variable set SEED_DEMO=0 --service appkomidi-api
```

Κωδικός κάθε `demo_*`: `demo1234`. Admin: `admin` / `Dimarcheio!2026`.

Μην αφήσεις `SEED_DEMO=1`. Το επόμενο deploy θα ξαναγράψει τις σημερινές βάρδιες.

## 5. Έλεγχος

- `https://appkomidi-api-production.up.railway.app/health`
- `https://appkomidi-web-production.up.railway.app`
- `demo_admin`, `demo_business`, `demo_driver` με `demo1234`

## 6. Android APK (EAS)

Project: `@papeiotess-team/appkomidi`. Το `owner` και το `extra.eas.projectId` είναι στο `apps/mobile/app.json` και στο `apps/mobile/app.config.ts`. Το `eas.json` έχει ήδη `EXPO_PUBLIC_API_URL=https://appkomidi-api-production.up.railway.app`. Το `eas-build-post-install` χτίζει το `@vardia/shared` πριν το bundle.

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Το profile `preview` βγάζει APK (`android.buildType: apk`). Πακέτο: `gr.appkomidi.app`.
