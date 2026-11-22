# APPkomidi

Appointment booking for commercial waste pickup in a Greek municipality. A shop registers with one address and a draggable pin, the municipality approves it, and the shop books a green, blue, yellow, or brown bin. Kilograms are checked against the truck on a 6-hour shift. Times are every 30 minutes with a ±30 minute arrival window. The driver route is ordered to keep travel short inside those windows, and the shop sees the truck until it is within 50 metres.

Ραντεβού αποκομιδής για επιχειρήσεις ενός Δήμου. Η επιχείρηση δηλώνει μία διεύθυνση και καρφίτσα, ο Δήμος εγκρίνει, και κλείνει κάδο (πράσινο, μπλε, κίτρινο, καφέ). Τα κιλά ελέγχονται πάνω στο απορριμματοφόρο μιας βάρδιας 6 ωρών. Οι ώρες είναι ανά 30 λεπτά, με παράθυρο άφιξης ±30 λεπτά. Η διαδρομή του οδηγού μπαίνει σε σειρά ώστε να είναι σύντομη μέσα σε αυτά τα παράθυρα, και η επιχείρηση βλέπει το όχημα ώσπου να μπει στα 50 μέτρα.

Maps are OpenStreetMap, Nominatim, and OSRM. No Google key.

Demo data is for **Δήμος Αθηναίων**. Every demo account uses the password `demo1234`.

| Username | Role |
| --- | --- |
| `demo_admin` | Admin |
| `demo_office` | Office |
| `demo_driver` | Driver, green / mixed truck, today’s route |
| `demo_driver_blue` | Driver, blue truck |
| `demo_driver_yellow` | Driver, yellow truck |
| `demo_driver_brown` | Driver, brown truck |
| `demo_business` | Shop in Plaka |

`pnpm db:seed` loads that demo. `pnpm db:seed:empty` or `SEED_DEMO=0` keeps only the env admin (`admin` / `Dimarcheio!2026` unless you change it). `OVERFLOW_KG` (default 75) is the weight used for a 50+ booking.

## English

### Run with Docker

```bash
docker compose up --build
```

- Web: http://localhost:4108
- API: http://localhost:4107/health
- Postgres: `localhost:5432`, user `vardia`, password `vardia`, database `vardia`

The API migrates and creates the admin when it starts.

### Apps on the host, database in Docker

```bash
docker compose up -d db
pnpm install
pnpm dev
pnpm test
```

`pnpm dev` starts the API on **4107** and the web app on **4108**.

### Expo Go

```bash
cd apps/mobile
pnpm start
```

On the phone, set the API address to the computer’s LAN IP, for example `http://192.168.1.20:4107`. `localhost` on the phone is the phone.

### Demo

1. Open http://localhost:4108 and sign in as `demo_admin` / `demo1234`. The sidebar is one task per page. Adding an account, a truck, a shift, or a sub-area is a wizard: one question, Back/Next, then review.
2. Sign in as `demo_driver`. The screen is a full-screen map and a large **START**. After start, only the route to the current stop is shown, with that booking’s details and **Ολοκληρώθηκε** in the bottom card. Pause and end sit in the menu.
3. Sign in as `demo_business`. Home is one **Κλείσε ραντεβού** button and upcoming cards. Booking is bin cards, kilograms, day, time (the suggestion is highlighted), then review.
4. `demo_office` filters pickups and changes, cancels, or asks a question one step at a time.

Office (a user the admin creates with the Office role) can filter pickups, move or cancel them, and send a question. The business answers from Notifications. Office accounts receive every office permission unless you change the list later.

### Tests

`pnpm test` covers bracket weights, the 7-day horizon, the 15-minute cancel cutoff, AFM checksum, slot suggestion, polygon assignment, route order, and a Postgres test where two parallel 50+ bookings fight for 100 kg and only one is stored.

### Not in this build

- Real Expo push tokens. Notifications are in-app and over the socket. The mobile app shows them when it loads notifications or the arrival banner.
- SMS and email.
- A private OSRM server. The public demo is used, with a straight line if it does not answer.
- Reordering a route after START. Going off the line only redraws the path to the same next stop.
- Photos or failure reasons. Completion is one button.

## Ελληνικά

### Εκκίνηση με Docker

```bash
docker compose up --build
```

- Web: http://localhost:4108
- API: http://localhost:4107/health
- Postgres: `localhost:5432`, χρήστης `vardia`, κωδικός `vardia`, βάση `vardia`

### Εφαρμογές στον υπολογιστή

```bash
docker compose up -d db
pnpm install
pnpm dev
pnpm test
```

### Expo Go

```bash
cd apps/mobile
pnpm start
```

Στο τηλέφωνο βάλε το LAN IP του υπολογιστή, π.χ. `http://192.168.1.20:4107`.

### Δοκιμή

1. Μπες ως `demo_admin` / `demo1234`. Κάθε σελίδα του μενού κάνει μία δουλειά. Νέος λογαριασμός, όχημα, βάρδια και υποπεριοχή είναι οδηγός βήμα-βήμα.
2. `demo_driver`: χάρτης σε όλη την οθόνη και μεγάλο **ΕΝΑΡΞΗ**. Μετά φαίνεται μόνο η διαδρομή προς την τρέχουσα στάση και κάρτα με **Ολοκληρώθηκε**. Παύση και τέλος είναι στο μενού.
3. `demo_business`: ένα κουμπί **Κλείσε ραντεβού** και κάρτες από κάτω. Η κράτηση είναι κάδος, κιλά, μέρα, ώρα, έλεγχος.
4. `demo_office` φιλτράρει και αλλάζει, ακυρώνει ή ρωτά σε ξεχωριστά βήματα.

Το γραφείο φιλτράρει, αλλάζει ώρα, ακυρώνει και στέλνει ερώτηση. Η απάντηση γυρίζει από τις ειδοποιήσεις.

### Εκτός έκδοσης

- Πραγματικά Expo push tokens. Οι ειδοποιήσεις είναι μέσα στην εφαρμογή και στο socket.
- SMS και email.
- Δικός μας διακομιστής OSRM.
- Αλλαγή σειράς μετά την έναρξη.
- Φωτογραφίες ή αιτίες αποτυχίας.
