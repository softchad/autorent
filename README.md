# AutoRent

Automobilių nuomos valdymo sistema su dviem sąsajomis:

- **Darbuotojų administravimo sistema** - automobiliai, klientai, rezervacijos, užsakymai, sąskaitos ir klientų aptarnavimas, apsaugoti vaidmenimis (RBAC).
- **Vieša kliento svetainė** - automobilių paieška/rezervavimas, kliento paskyra, lojalumo programa ir pagalbos pokalbiai su darbuotojais, be prisijungimo arba su atskira kliento paskyra (slaptažodis arba Google/GitHub).

---

## Ekrano vaizdai

| | |
|---|---|
| ![Prisijungimas](docs/screenshots/login.png) | ![Dashboard](docs/screenshots/dashboard.png) |
| ![Rezervacijos](docs/screenshots/reservations.png) | ![Klientai](docs/screenshots/clients.png) |
| ![Sąskaita PDF](docs/screenshots/invoice.png) | ![Pagalbos užklausos](docs/screenshots/support.png) |

---

## Technologijos

| Sluoksnis | Technologija |
|-----------|-------------|
| **Backend** | FastAPI · SQLAlchemy · MySQL · Pydantic v2 · slowapi (rate limiting) |
| **Frontend** | Next.js 15 (App Router) · TypeScript · Redux Toolkit (RTK Query, darbuotojų sąsajai) · Tailwind CSS |
| **Autentifikacija** | JWT · bcrypt · OAuth 2.0 (Google, GitHub) - atskiri darbuotojo ir kliento tokenai |
| **Kiti** | Leaflet · react-pdf · OpenCage Geocoding |

---

## Paleidimas

### Reikalavimai

- Python 3.12+
- Node.js 20+
- MySQL 9+ (paslauga turi būti paleista)
- DBeaver (DB valdymui)

---

### 1. Duomenų bazė (DBeaver)

> Kiekvieną kartą prieš paleidžiant — įsitikink kad MySQL paslauga veikia:  
> `Win + R` → `services.msc` → **MySQL** → Start

**Pirmą kartą (schemos sukūrimas):**

1. Atidaryк DBeaver → prisijunk prie `localhost` MySQL
2. Dešiniu pelės mygtuku ant ryšio → **Create New Database** → pavadink `autorent`
3. Atsidaryk failus iš `database/` aplanko ir vykdyk tokia tvarka:

| Failas | Kaip vykdyti |
|--------|-------------|
| `schema.sql` | Atidaryк → `Ctrl+A` → `Ctrl+Enter` |
| `seed.sql` | Atidaryк → `Ctrl+A` → `Ctrl+Enter` |
| `triggers.sql` | Kiekvieną `CREATE TRIGGER ... END` bloką **pažymėk atskirai** → `Ctrl+Enter` |

> **Admin paskyra:** `admin@autorent.lt` / `Admin123!`

---

### 2. Backend

**Pirmą kartą:**
```bash
cd backend
py -3.12 -m venv .venv
pip install -r requirements.txt
```

Sukurk `backend/.env` failą (nukopijuok iš `backend/.env.example` ir užpildyk):
```env
SECRET_KEY=bet_koks_ilgas_raktas
DATABASE_URL=mysql+pymysql://root:tavo_slaptazodis@localhost:3306/autorent
FRONTEND_URL=http://localhost:3000

# Privalomas - OAuth sesijos cookie pasirašymui (min. 32 simboliai)
SESSION_SECRET_KEY=bet_koks_ilgas_raktas

# Google OAuth - privalomas (žr. GOOGLE_CLIENT_ID/SECRET žemiau), GitHub neprivalomas
GOOGLE_CLIENT_ID=raktas_is_google_cloud_console
GOOGLE_CLIENT_SECRET=raktas_is_google_cloud_console
GOOGLE_REDIRECT_URL=http://localhost:8000/api/v1/google/callback

# GitHub OAuth - neprivalomas, be šių GitHub prisijungimas tiesiog neaktyvus
GITHUB_CLIENT_ID=raktas_is_github_developer_settings
GITHUB_CLIENT_SECRET=raktas_is_github_developer_settings
GITHUB_REDIRECT_URL=http://localhost:8000/api/v1/github/callback

# Neprivalomas - be jo žemėlapio adresų paieška tiesiog neveiks
OPENCAGE_API_KEY=raktas_is_opencage.com
```

**Kiekvieną kartą:**
```bash
cd backend
.venv\Scripts\activate
uvicorn app.main:app --reload
```
→ veikia adresu `http://localhost:8000/docs`

---

### 3. Frontend

**Pirmą kartą:**
```bash
cd frontend
npm install
```

Sukurk `frontend/.env.local` failą (nukopijuok iš `frontend/.env.local.example`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**Kiekvieną kartą:**
```bash
cd frontend
npm run dev
```
→ veikia adresu `http://localhost:3000`

---

## Funkcionalumas

### Darbuotojų administravimo sistema (`/dashboard`, `/cars`, `/clients`, ...)

| Modulis | Aprašymas |
|---------|-----------|
| **Automobiliai** | CRUD, statusų valdymas, žemėlapis, panaudojimo statistika |
| **Rezervacijos** | Datų rezervavimas, SELECT ... FOR UPDATE apsauga nuo persidengimo lenktynių |
| **Užsakymai** | Nuomos valdymas, kainos įvedimas, būsenų valdymas |
| **Klientai** | Registras, lojalumo (bonus) taškai (keisti gali tik administratorius) |
| **Sąskaitos** | Generavimas, PDF atsisiuntimas |
| **Darbuotojai** | Valdymas, rolės, prisijungimo paskyros |
| **Klientų aptarnavimas** | Pokalbių eilė, priskyrimas, atsakymai, vidinės pastabos |
| **Profilis** | Paskyros peržiūra ir keitimas |

### Vieša kliento svetainė (`/`, `/automobiliai`, `/paskyra`, ...)

| Modulis | Aprašymas |
|---------|-----------|
| **Automobilių paieška** | Filtrai, rikiavimas, žemėlapis, laisvumo tikrinimas pasirinktam laikotarpiui |
| **Rezervavimas** | Kliento paskyra (slaptažodis arba Google/GitHub) → rezervacijos kūrimas |
| **Kliento paskyra** | Profilis, rezervacijų istorija, lojalumo progresas ir atlygiai |
| **Pagalbos pokalbiai** | Klientas rašo darbuotojams, susietas su konkrečia rezervacija |

---

## Rolės (darbuotojų sąsaja)

| Rolė | Skaityti | Redaguoti | Trinti | Administravimas |
|------|:--------:|:---------:|:------:|:---------------:|
| **Administratorius** | ✓ | ✓ | ✓ | ✓ |
| **Vadybininkas** | ✓ | ✓ | — | — |
| **Mechanikas** | ✓ | ✓ | — | — |
| **Klientų aptarnavimas** | ✓ | ✓ | — | — |

Klientų aptarnavimo pokalbiai (ne bendras EDIT) matomi tik Administratorius/Vadybininkas/Klientų aptarnavimas rolėms - žr. `backend/app/api/v1/endpoints/staff_support.py`.

---

## DB diagrama

[dbdiagram.io](https://dbdiagram.io/d/Autorent-6a1ae349f15b4b0452368d56)

---

## Projekto struktūra

Aukšto lygio apžvalga - tiksli failų struktūra keičiasi dažniau nei šis README, tad
žemiau tik aplankų paskirtis. Pilną sąrašą žr. tiesiai repo.

```
autorent/
├── backend/
│   ├── app/
│   │   ├── main.py                    FastAPI app, middleware, rate limiter, routeriai
│   │   ├── rate_limit.py              bendras slowapi Limiter (main.py + endpoint'ai)
│   │   ├── api/
│   │   │   ├── deps.py                get_current_user / get_current_customer / get_db
│   │   │   ├── permissions.py         RBAC: Perm enum, ROLE_PERMS, require_perm
│   │   │   └── v1/endpoints/          darbuotojų endpoint'ai (auth, car, client, employee,
│   │   │                              order, reservation, invoice, staff_support, geocode)
│   │   │                              IR kliento endpoint'ai (customer_auth, customer,
│   │   │                              customer_loyalty, customer_support, public)
│   │   ├── models/ · schemas/ · repositories/   SQLAlchemy modeliai, Pydantic schemos,
│   │   │                                         DB prieigos sluoksnis (1 failas/esybė)
│   │   └── services/                  verslo logika: auth_service, availability_service
│   │                                   (SELECT ... FOR UPDATE rezervacijų persidengimui),
│   │                                   support_service
│   ├── tests/                         pytest - api/ (endpoint'ai, SQLite TestClient) ir
│   │                                   services/ (vienetų testai)
│   └── utils/config.py                pydantic Settings, .env skaitymas
├── frontend/
│   └── src/
│       ├── app/                       Next.js App Router
│       │   ├── (darbuotojų puslapiai) dashboard/, cars/, clients/, employees/, invoices/,
│       │   │                          orders/, reservations/, support/, login/, profile/
│       │   ├── (vieši puslapiai)      page.tsx, automobiliai/, paskyra/, apie-mus/,
│       │   │                          kontaktai/, karjera/, kelioniu-patarimai/, ...
│       │   ├── components/            darbuotojų UI (DataTable, EntityModal, ...) ir
│       │   │   └── public/            viešos svetainės komponentai (AutomobiliaiClient,
│       │   │                          AccountClient, SupportInbox, ...)
│       │   ├── sitemap.ts / robots.ts
│       │   └── guards/ · providers/   AuthGuard (darbuotojas), CustomerAuthProvider
│       ├── hooks/                     RTK Query hook'ai (darbuotojams) + paprasti fetch
│       │                              hook'ai (klientui): usePublicCars, useCustomerLoyalty,
│       │                              useCustomerReservations, useCustomerConversations,
│       │                              useStaffSupport, ...
│       ├── store/                     Redux Toolkit + RTK Query (darbuotojų API)
│       └── utils/                     formatLt, formatApiError, carPhoto, locations, ...
├── database/
│   ├── schema.sql · seed.sql          DDL ir pradiniai duomenys
│   ├── triggers.sql                   duomenų vientisumo trigeriai
│   └── queries.sql                    analitinės SQL užklausos
└── docs/
    └── screenshots/
```
