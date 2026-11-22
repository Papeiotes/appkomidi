# Δημοσίευση APPkomidi στο Railway

Οι εντολές τρέχουν στον υπολογιστή σου, από τη ρίζα του αποθετηρίου. Το Railway CLI ανεβάζει τον κώδικα με `railway up`. Δεν χρειάζεται σύνδεση Git.

Τα Dockerfiles χτίζονται μόνο από τη ρίζα του monorepo (`docker build -f apps/api/Dockerfile .`), γιατί το pnpm workspace περιλαμβάνει `packages/shared`.

## 1. Εγκατάσταση και project

```bash
npm i -g @railway/cli
railway login
railway init --name appkomidi
```

Αν το CLI ζητήσει workspace, διάλεξε το δικό σου.

```bash
railway add --database postgres --service appkomidi-db
railway add --service appkomidi-api
railway add --service appkomidi-web
```

Στις ρυθμίσεις κάθε service (Railway → service → Settings):

- Root directory: κενό (ρίζα του repo).
- Config file: `railway.api.toml` για το API, `railway.web.toml` για το web.

Έτσι το API χρησιμοποιεί το `apps/api/Dockerfile` και το web το `apps/web/Dockerfile`.

## 2. Μεταβλητές

Δες τα ονόματα των services με `railway service list`.

API (`appkomidi-api`):

```bash
railway variable set 'DATABASE_URL=${{appkomidi-db.DATABASE_URL}}' --service appkomidi-api --skip-deploys
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
```

Το `PORT` το δίνει το Railway. Μην το ορίσεις εσύ. Το `SEED_DEMO=0` μένει έτσι ώστε κάθε επανεκκίνηση να μην ξαναγράφει τις βάρδιες.

Web (`appkomidi-web`), αφού υπάρχει δημόσιο URL για το API (βήμα 3):

```bash
railway variable set NEXT_PUBLIC_API_URL=https://ΔΙΕΥΘΥΝΣΗ-API --service appkomidi-web --skip-deploys
```

Χωρίς κάθετο στο τέλος. Το Next την ενσωματώνει στο build, γι' αυτό την βάζεις πριν το `railway up` του web και ξανακάνεις deploy αν την αλλάξεις.

Μετά το δημόσιο URL του web:

```bash
railway variable set CORS_ORIGINS=https://ΔΙΕΥΘΥΝΣΗ-WEB --service appkomidi-api
```

Πολλά origins χωρίζονται με κόμμα. Το Socket.IO χρησιμοποιεί το ίδιο HTTPS, άρα ο browser ανοίγει `wss`.

## 3. Domains και deploy

```bash
railway domain --service appkomidi-api
railway domain --service appkomidi-web
railway up --service appkomidi-api --detach
railway up --service appkomidi-web --detach
```

Παρακολούθηση:

```bash
railway logs --service appkomidi-api
railway deployment list --service appkomidi-api
```

Σε κάθε εκκίνηση το API τρέχει `prisma migrate deploy` και μετά τον server. Το health check είναι `GET /health`.

Ξανά deploy μετά από αλλαγές: ίδιο `railway up --service …` από τη ρίζα.

## 4. Demo seed, μία φορά

Όταν το `/health` απαντά, μέσα στο container (έχει ήδη το `DATABASE_URL`):

```bash
railway ssh --service appkomidi-api -- node dist/seed.js
```

Πριν από αυτή την εντολή, για μία εκτέλεση μόνο, βάλε `SEED_DEMO=1` μπροστά:

```bash
railway ssh --service appkomidi-api -- env SEED_DEMO=1 node dist/seed.js
```

Ο κατάλογος εργασίας στο image είναι το `apps/api`, όπου βρίσκεται το `dist/seed.js`. Κωδικός κάθε λογαριασμού `demo_*`: `demo1234`. Ο admin είναι `admin` / `Dimarcheio!2026`.

Μην αφήσεις `SEED_DEMO=1` στις μεταβλητές του service. Το επόμενο deploy θα ξαναγράψει τις σημερινές βάρδιες.

## 5. Έλεγχος

- `https://ΔΙΕΥΘΥΝΣΗ-API/health` → `{"ok":true,...}`
- `https://ΔΙΕΥΘΥΝΣΗ-WEB` → σελίδα σύνδεσης
- `demo_admin`, `demo_business`, `demo_driver` με `demo1234`

## 6. Android APK

Στο `apps/mobile/eas.json` το `EXPO_PUBLIC_API_URL` πρέπει να είναι το δημόσιο HTTPS του API. Μετά:

```bash
cd apps/mobile
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Το profile `preview` βγάζει APK (`android.buildType: apk`). Πακέτο: `gr.appkomidi.app`.
