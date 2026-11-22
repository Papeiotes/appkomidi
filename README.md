# Βάρδια / Vardia

Shift shuttles for businesses that clock in together. A workplace pin, an admin approval, seats with a hard capacity, a driver route, and a notification when the van is inside 50 metres.

Μεταφορά προσωπικού για επιχειρήσεις που δουλεύουν με βάρδιες. Καρφίτσα στην έδρα, έγκριση από διαχειριστή, θέσεις με κλειδωμένη χωρητικότητα, διαδρομή οδηγού, και ειδοποίηση όταν το βαν μπει στα 50 μέτρα.

Maps are OpenStreetMap tiles, Nominatim search, and OSRM routes. No Google key.

## English

### What you get

- Web (Next.js) for the business, the admin, the employee, and the driver.
- Phone app (Expo) for the employee and the driver, including a draggable workplace pin.
- API (Node, Prisma, Socket.IO) and Postgres.
- Greek and English, switchable in the header.

An empty database already contains one admin:

| | |
| --- | --- |
| Email | `admin@vardia.gr` |
| Password | `VardiaAdmin!2026` |

### Run everything with Docker

From the repo root, with Docker running:

```bash
docker compose up --build
```

- Web: http://localhost:4108
- API: http://localhost:4107/health
- Postgres: `localhost:5432`, user `vardia`, password `vardia`, database `vardia`

The API applies migrations and creates the admin on startup. Stop with `Ctrl+C`. Add `-d` to leave it in the background.

### Run the database in Docker and the apps on the host

```bash
docker compose up -d db
pnpm install
pnpm dev
```

`pnpm dev` copies `.env` files if they are missing, builds the shared package, and starts the API on port **4107** and the web app on port **4108**. The API migrates and seeds on boot.

Useful extras:

```bash
pnpm test          # booking, capacity, row-lock, and 50 m tests
pnpm db:migrate    # prisma migrate deploy
pnpm db:seed       # creates the admin if missing
pnpm dev:mobile    # Expo, see below
```

Postgres must already be reachable at `postgresql://vardia:vardia@localhost:5432/vardia` before `pnpm test`. `docker compose up -d db` does that.

### Expo Go

The phone has to reach the computer, so `localhost` on the phone is the phone itself.

```bash
cd apps/mobile
pnpm start
```

In Expo Go, open the project from the QR code. On the login screen, set the API address to your computer’s LAN IP, for example `http://192.168.1.20:4107`. The API container publishes `4107` on the host.

- iOS simulator on the same Mac: `http://localhost:4107` works.
- Android emulator: `http://10.0.2.2:4107`.

Keep the driver screen open while a route is running. Location is sent only in the foreground.

### Demo walkthrough

1. Open http://localhost:4108 and sign in as the admin above.
2. In a private window, choose **Register a business**. Search or drag the pin onto the workplace and submit. The business stays pending.
3. As admin, open **Approvals** and approve it. The invite code appears on the business home.
4. Register a **driver** (any email, password at least 8 characters).
5. As the business, add a vehicle if you want, then **New shift**. Set capacity to `1`, put the driver’s email, set the muster pin and the workplace, and choose **Open for booking**.
6. Register two **employees** with that invite code.
7. Each employee opens **Book** and takes a seat. The second request is refused: the shift is full. That check runs inside a Postgres row lock.
8. As the driver, open **Drive**, then the shift, and press **Start route**. The line is an OSRM drive route (a straight line if OSRM is unreachable).
9. Press **Simulate arrival at 30 m** next to the passenger. The employee gets an in-app notification, «Το βαν είναι κοντά», because 30 m is inside the 50 m ring. The same control exists on the phone.
10. **Complete** the route. Confirmed seats become completed.

Switch language with **ΕΛ / EN** in the header. The phone has the same toggle.

### Tests

`packages/shared` checks the booking decision, the cutoff lock, cancellation, start/complete, the in-process lock that lets only `capacity` parallel bookings through, and the 50 m radius.

`apps/api` checks the same capacity rule against Postgres: two concurrent bookings for the last seat, one `SHIFT_FULL`, then a cancel that frees the seat, then a duplicate booking refused.

### What is not in this build

- Email and SMS. The invite code is shown on screen. Notifications are in-app and over the socket.
- Password reset by email. A signed-in user can change their password.
- Card payments, invoicing, ratings.
- A repeating shift rule. Duplicate makes one draft copy.
- Background GPS after the driver leaves the screen.
- A private Nominatim/OSRM instance. The public servers are used, with a one-request-per-second pause for Nominatim and a straight-line route if OSRM fails.

## Ελληνικά

### Τι περιλαμβάνει

- Web (Next.js) για επιχείρηση, διαχειριστή, εργαζόμενο και οδηγό.
- Εφαρμογή τηλεφώνου (Expo) για εργαζόμενο και οδηγό, με συρόμενη καρφίτσα στην έδρα.
- API (Node, Prisma, Socket.IO) και Postgres.
- Ελληνικά και αγγλικά, με διακόπτη στην κορυφή.

Σε άδεια βάση υπάρχει ήδη ένας διαχειριστής:

| | |
| --- | --- |
| Email | `admin@vardia.gr` |
| Κωδικός | `VardiaAdmin!2026` |

### Όλα με Docker

Από τη ρίζα του repo, με το Docker σε λειτουργία:

```bash
docker compose up --build
```

- Web: http://localhost:4108
- API: http://localhost:4107/health
- Postgres: `localhost:5432`, χρήστης `vardia`, κωδικός `vardia`, βάση `vardia`

Το API τρέχει τα migrations και φτιάχνει τον διαχειριστή μόλις ξεκινήσει. Τερματισμός με `Ctrl+C`. Με `-d` μένει στο παρασκήνιο.

### Βάση σε Docker, εφαρμογές στον υπολογιστή

```bash
docker compose up -d db
pnpm install
pnpm dev
```

Η `pnpm dev` αντιγράφει τα `.env` αν λείπουν, χτίζει το κοινό πακέτο, και σηκώνει το API στη θύρα **4107** και το web στη θύρα **4108**.

```bash
pnpm test          # κρατήσεις, χωρητικότητα, κλείδωμα γραμμής, 50 μ.
pnpm db:migrate
pnpm db:seed
pnpm dev:mobile
```

Η `pnpm test` θέλει Postgres στο `postgresql://vardia:vardia@localhost:5432/vardia`. Το δίνει η `docker compose up -d db`.

### Expo Go

Το τηλέφωνο πρέπει να βλέπει τον υπολογιστή. Το `localhost` στο τηλέφωνο είναι το ίδιο το τηλέφωνο.

```bash
cd apps/mobile
pnpm start
```

Άνοιξε το project στο Expo Go από το QR. Στην οθόνη σύνδεσης βάλε τη διεύθυνση API με το LAN IP του υπολογιστή, π.χ. `http://192.168.1.20:4107`.

- Προσομοιωτής iOS στον ίδιο Mac: `http://localhost:4107`.
- Εξομοιωτής Android: `http://10.0.2.2:4107`.

Η οθόνη του οδηγού πρέπει να μείνει ανοιχτή. Η θέση στέλνεται μόνο όσο η εφαρμογή είναι μπροστά.

### Διαδρομή δοκιμής

1. Άνοιξε το http://localhost:4108 και μπες ως διαχειριστής.
2. Σε ιδιωτικό παράθυρο δήλωσε επιχείρηση. Σύρε την καρφίτσα στην έδρα. Η αίτηση μένει σε αναμονή.
3. Ως διαχειριστής, στις **Εγκρίσεις**, ενέκρινε. Ο κωδικός πρόσκλησης φαίνεται στην αρχική της επιχείρησης.
4. Φτιάξε λογαριασμό **οδηγού**.
5. Ως επιχείρηση, άνοιξε βάρδια με χωρητικότητα `1`, το email του οδηγού, αφετηρία και έδρα, και πάτα **Άνοιγμα κρατήσεων**.
6. Δήλωσε δύο **εργαζομένους** με τον κωδικό.
7. Ο πρώτος κλείνει θέση. Ο δεύτερος παίρνει άρνηση: η βάρδια είναι γεμάτη. Ο έλεγχος γίνεται με κλείδωμα γραμμής στην Postgres.
8. Ως οδηγός, άνοιξε **Οδήγηση**, τη βάρδια, και **Έναρξη διαδρομής**. Η γραμμή έρχεται από το OSRM (ευθεία αν το OSRM δεν απαντήσει).
9. Πάτα **Προσομοίωση άφιξης 30 μ.** δίπλα στον επιβάτη. Ο εργαζόμενος βλέπει «Το βαν είναι κοντά», γιατί τα 30 μέτρα είναι μέσα στα 50. Το ίδιο κουμπί υπάρχει και στο τηλέφωνο.
10. **Ολοκλήρωση**. Οι επιβεβαιωμένες θέσεις κλείνουν.

Η γλώσσα αλλάζει με **ΕΛ / EN**.

### Τι δεν υπάρχει ακόμα

- Email και SMS. Ο κωδικός πρόσκλησης φαίνεται στην οθόνη. Οι ειδοποιήσεις είναι μέσα στην εφαρμογή και στο socket.
- Επαναφορά κωδικού με email. Όποιος είναι συνδεδεμένος αλλάζει κωδικό από τον λογαριασμό.
- Πληρωμές, τιμολόγια, αξιολογήσεις.
- Επαναλαμβανόμενος κανόνας βάρδιας. Το αντίγραφο φτιάχνει ένα πρόχειρο.
- Θέση στο παρασκήνιο αφού ο οδηγός φύγει από την οθόνη.
- Δικός μας διακομιστής Nominatim/OSRM. Χρησιμοποιούνται οι δημόσιοι, με παύση ενός δευτερολέπτου στο Nominatim και ευθεία γραμμή αν πέσει το OSRM.
