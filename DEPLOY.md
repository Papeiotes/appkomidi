# Δημοσίευση APPkomidi

Αυτές οι οδηγίες είναι για τον ιδιοκτήτη. Ο κώδικας είναι έτοιμος. Δεν έχει γίνει deploy και δεν έχουν δημιουργηθεί λογαριασμοί Render ή Expo.

Το site ανοίγει στο `https://appkomidi-web.onrender.com`. Το API είναι στο `https://appkomidi-api.onrender.com`. Η εφαρμογή Android εγκαθίσταται από το APK που βγάζει το Expo.

## 1. Render (ιστοσελίδα και API)

1. Φτιάξε λογαριασμό στο [render.com](https://render.com).
2. New → Blueprint. Σύνδεσε το Git αποθετήριο (Origin ή το mirror στο GitHub, αν το Render δεν βλέπει απευθείας το Origin).
3. Το αρχείο `render.yaml` στη ρίζα φτιάχνει βάση PostgreSQL, το API και την ιστοσελίδα.
4. Πριν πατήσεις Apply, στο web service `appkomidi-web` βάλε το `NEXT_PUBLIC_API_URL` ίσο με τη διεύθυνση του API, για παράδειγμα `https://appkomidi-api.onrender.com`. Το Next το διαβάζει την ώρα του build, οπότε αν το αλλάξεις μετά κάνε ξανά deploy στο web.
5. Στο API συμπλήρωσε:
   - `ADMIN_PASSWORD`: ένας δικός σου κωδικός για τον λογαριασμό `admin`.
   - `CORS_ORIGINS`: `https://appkomidi-web.onrender.com` (χωρίς κάθετο στο τέλος). Αν έχεις και δεύτερο domain, χώρισέ τα με κόμμα.
   - Το `JWT_SECRET` το γεννάει το Render. Το `DATABASE_URL` έρχεται μόνο του από τη βάση. Το `TZ` είναι `Europe/Athens`.
6. Το `SEED_DEMO` είναι `0`, ώστε κάθε επανεκκίνηση να μην σβήνει τα ραντεβού. Με την πρώτη εκκίνηση δημιουργείται μόνο ο admin, αν δεν υπάρχει.
7. Όταν το API γίνει πράσινο, άνοιξε ένα Shell στο service `appkomidi-api` και τρέξε μία φορά τη δοκιμαστική βάση:

```bash
SEED_DEMO=1 node apps/api/dist/seed.js
```

Κωδικός για κάθε `demo_*` λογαριασμό: `demo1234`. Ο admin του περιβάλλοντος μένει αυτός που έβαλες στο `ADMIN_PASSWORD`.

8. Άνοιξε `https://appkomidi-api.onrender.com/health`. Πρέπει να δεις `{"ok":true,...}`.
9. Άνοιξε `https://appkomidi-web.onrender.com` και συνδέσου.

Το Socket.IO δουλεύει πάνω στο ίδιο HTTPS του API, άρα το πρόγραμμα περιήγησης χρησιμοποιεί `wss`. Το API διαβάζει το `PORT` του Render και εμπιστεύεται τον proxy (`trust proxy`).

### Ξύπνημα πριν το demo

Τα δωρεάν services κοιμούνται μετά από αδράνεια. Πέντε λεπτά πριν την παρουσίαση άνοιξε και τις δύο διευθύνσεις (API `/health` και το site) και περίμενε να φορτώσουν. Η πρώτη κλήση μπορεί να πάρει περίπου ένα λεπτό.

## 2. Android APK (Expo)

1. Φτιάξε λογαριασμό στο [expo.dev](https://expo.dev).
2. Στον υπολογιστή σου, μέσα στο αποθετήριο:

```bash
cd apps/mobile
npx eas-cli login
```

3. Στο `apps/mobile/eas.json`, στο profile `preview`, το `EXPO_PUBLIC_API_URL` πρέπει να είναι η δημόσια διεύθυνση του API, με `https://`. Άλλαξέ το αν το Render έδωσε άλλο όνομα, και κάνε commit.
4. Χτίσε το APK (δεν το ανεβάζουμε εμείς στο Play Store):

```bash
npx eas-cli build -p android --profile preview
```

5. Όταν τελειώσει, το Expo δίνει έναν σύνδεσμο. Κατέβασε το `.apk` ή στείλε τον σύνδεσμο στο τηλέφωνο.
6. Στο Android επίτρεψε εγκατάσταση από αυτή την πηγή και άνοιξε το αρχείο. Το πακέτο είναι `gr.appkomidi.app`.
7. Η τοποθεσία ζητιέται μόνο όταν ο οδηγός ξεκινάει βάρδια. Ο χάρτης είναι OpenStreetMap μέσω HTTPS, χωρίς κλειδί Google.

Το profile `preview` βγάζει APK (`android.buildType: apk`), όχι AAB, ώστε να εγκαθίσταται κατευθείαν.

## 3. Τι να μην αλλάξεις

- Μην βάλεις `SEED_DEMO=1` μόνιμα στο Render. Κάθε νέο deploy θα ξαναγράφει τις βάρδιες της επίδειξης.
- Μην χρησιμοποιήσεις `http://` στο τηλέφωνο. Το APK μιλάει μόνο με `https://`.
