# Αποκομιδή / Collection

Appointment booking for commercial waste pickup in a Greek municipality. A shop registers with one address and a draggable pin, the municipality approves it, and the shop books a green, blue, yellow, or brown bin. Kilograms are checked against the truck on a 6-hour shift. The driver starts once, the stop order locks, and the shop sees the truck until it is within 50 metres.

Ραντεβού αποκομιδής για επιχειρήσεις ενός Δήμου. Η επιχείρηση δηλώνει μία διεύθυνση και καρφίτσα, ο Δήμος εγκρίνει, και κλείνει κάδο (πράσινο, μπλε, κίτρινο, καφέ). Τα κιλά ελέγχονται πάνω στο απορριμματοφόρο μιας βάρδιας 6 ωρών. Ο οδηγός πατά έναρξη, η σειρά κλειδώνει, και η επιχείρηση βλέπει το όχημα ώσπου να μπει στα 50 μέτρα.

Maps are OpenStreetMap, Nominatim, and OSRM. No Google key.

The database starts empty except for one admin.

| | |
| --- | --- |
| Username | `admin` |
| Password | `Dimarcheio!2026` |

Change them with `ADMIN_USERNAME` and `ADMIN_PASSWORD`. `OVERFLOW_KG` (default 75) is the weight used for a 50+ booking.

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

1. Open http://localhost:4108 and sign in as `admin` / `Dimarcheio!2026`.
2. Create a driver (Accounts) and a truck: bin type and capacity in kg.
3. Create a shift: truck, driver, start time. It lasts exactly 6 hours. Slots inside it are every 15 minutes.
4. In a private window, **Register a business**. Street and number, drag the pin, confirm the location, submit.
5. As admin, approve the request. The pin can be adjusted. If a sub-area polygon contains the pin, the shop is assigned to it.
6. As the business, tick one or more bins, pick a kilogram bracket and a time for each, and book. Each bin becomes its own pickup. A time with no remaining kilograms is grey. The second 50+ booking on a 100 kg truck is refused.
7. Cancel is allowed until 15 minutes before the slot.
8. As the driver, open **Drive**. The assigned shift is already there. Press **START**. The stop order is computed from the current position and then locked. The route ends at the last stop.
9. **Simulate 30 m** on the web (or walk the phone) to the current stop. The business sees «Το απορριμματοφόρο έφτασε» and the banner stays until **Ολοκληρώθηκε**.
10. The driver marks the stop complete. After the last stop the shift ends. Pause freezes progress. GPS still updates while the screen is open.

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

1. Μπες ως `admin` / `Dimarcheio!2026`.
2. Φτιάξε οδηγό και απορριμματοφόρο (κάδος + κιλά).
3. Φτιάξε βάρδια 6 ωρών με αυτό το όχημα και τον οδηγό.
4. Σε άλλο παράθυρο κάνε εγγραφή επιχείρησης, σύρε την καρφίτσα, επιβεβαίωσε τη θέση.
5. Ως admin ενέκρινε την αίτηση.
6. Η επιχείρηση τσεκάρει κάδους, διαλέγει κιλά και ώρα για τον καθένα. Κάθε κάδος είναι ξεχωριστό ραντεβού. Ώρα χωρίς κιλά είναι γκρι.
7. Ακύρωση μέχρι 15 λεπτά πριν.
8. Ο οδηγός πατά **ΕΝΑΡΞΗ**. Η σειρά κλειδώνει από το τρέχον GPS και τελειώνει στην τελευταία στάση.
9. Προσομοίωση 30 μ. (ή πραγματικό GPS). Η επιχείρηση βλέπει «Το απορριμματοφόρο έφτασε» μέχρι το **Ολοκληρώθηκε**.
10. Μετά την τελευταία στάση η βάρδια κλείνει. Η παύση παγώνει την πρόοδο. Η θέση συνεχίζει όσο η οθόνη είναι ανοιχτή.

Το γραφείο φιλτράρει, αλλάζει ώρα, ακυρώνει και στέλνει ερώτηση. Η απάντηση γυρίζει από τις ειδοποιήσεις.

### Εκτός έκδοσης

- Πραγματικά Expo push tokens. Οι ειδοποιήσεις είναι μέσα στην εφαρμογή και στο socket.
- SMS και email.
- Δικός μας διακομιστής OSRM.
- Αλλαγή σειράς μετά την έναρξη.
- Φωτογραφίες ή αιτίες αποτυχίας.
