# AutoRent

Automobilių nuomos valdymo sistema su dviem sąsajomis:

- **Darbuotojų administravimo sistema** - automobiliai, klientai, rezervacijos, užsakymai, sąskaitos ir klientų aptarnavimas, apsaugoti vaidmenimis (RBAC).
- **Vieša kliento svetainė** - automobilių paieška/rezervavimas, kliento paskyra, lojalumo programa ir pagalbos pokalbiai su darbuotojais, be prisijungimo arba su atskira kliento paskyra (slaptažodis arba Google/GitHub).

---

## Ekrano vaizdai

| | |
|---|---|
| **Automobilių katalogas** | **Automobilio informacija ir rezervavimas** |
| ![Automobilių katalogas](docs/ekrano_nuotraukos/04_automobiliu_katalogas.png) | ![Automobilio informacija ir rezervavimas](docs/ekrano_nuotraukos/05_automobilio_puslapis.png) |
| **Kliento paskyra ir lojalumo programa** | **Kliento susirašinėjimas su darbuotoju** |
| ![Kliento paskyra ir lojalumo programa](docs/ekrano_nuotraukos/06_kliento_paskyra.png) | ![Kliento susirašinėjimas su darbuotoju](docs/ekrano_nuotraukos/12_kliento_susirasinejimas.png) |
| **Darbuotojų informacinis skydelis** | **Rezervacijų valdymas** |
| ![Darbuotojų informacinis skydelis](docs/ekrano_nuotraukos/14_informacinis_skydelis.png) | ![Rezervacijų valdymas](docs/ekrano_nuotraukos/17_rezervaciju_valdymas.png) |
| **Sąskaitos PDF** | **Pokalbio tvarkymas darbuotojų portale** |
| ![Sąskaitos PDF](docs/ekrano_nuotraukos/24_saskaitos_pdf.png) | ![Pokalbio tvarkymas darbuotojų portale](docs/ekrano_nuotraukos/26_darbuotojo_susirasinejimas.png) |

---

## Technologijos

| Sluoksnis | Technologija |
|-----------|-------------|
| **Backend** | FastAPI · SQLAlchemy · MySQL · Pydantic v2 · slowapi (rate limiting) |
| **Frontend** | Next.js 15 (App Router) · TypeScript · Redux Toolkit (RTK Query, darbuotojų sąsajai) · Tailwind CSS |
| **Autentifikacija** | JWT · bcrypt · OAuth 2.0 (Google, GitHub) - atskiri darbuotojo ir kliento tokenai |
| **Kiti** | Leaflet · react-pdf · Nominatim |

Adresų paieška abiejuose portaluose naudoja Nominatim per backend, be API rakto. Žinomi padaliniai turi iš anksto įrašytas koordinates. Kitų adresų rezultatai saugomi proceso atmintyje, išorinės užklausos siunčiamos ne dažniau kaip kas 1,1 sekundės. Vieša paieška vykdoma tik vartotojui ją pasirinkus, ne kiekvieno simbolio įvedimo metu.

Viešojo [Nominatim naudojimo taisyklės](https://operations.osmfoundation.org/policies/nominatim/) riboja visos programos srautą iki 1 užklausos per sekundę. Dabartinė eilė skirta vienam backend procesui (vienam `uvicorn` paleidimui); keliems procesams ar serveriams reikėtų bendro ribotuvo arba kito tiekėjo. Tiekėjo adresą galima pakeisti per `NOMINATIM_URL`. Nesiųskite konfidencialių adresų ar kitų asmens duomenų į viešą servisą.

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

Naujam diegimui naudok dabartinį `database/schema.sql`, kuris jau turi visus reikalingus laukus.

### 2. Backend

**Pirmą kartą:**
```bash
cd backend
py -3.12 -m venv .venv
pip install -r requirements.txt
```

Sukurk `backend/.env` failą (nukopijuok iš `backend/.env.example` ir užpildyk):
```env
SECRET_KEY=pakeisk_siuos_zenklus_savo_atsitiktiniu_raktu
DATABASE_URL=mysql+pymysql://root:tavo_slaptazodis@localhost:3306/autorent
FRONTEND_URL=http://localhost:3000

# Privalomas - OAuth sesijos cookie pasirašymui (min. 32 simboliai)
SESSION_SECRET_KEY=pakeisk_siuos_zenklus_kitu_atsitiktiniu_raktu

# Google OAuth - privalomas (žr. GOOGLE_CLIENT_ID/SECRET žemiau), GitHub neprivalomas
GOOGLE_CLIENT_ID=raktas_is_google_cloud_console
GOOGLE_CLIENT_SECRET=raktas_is_google_cloud_console
GOOGLE_REDIRECT_URL=http://localhost:8000/api/v1/google/callback

# GitHub OAuth - neprivalomas, be šių GitHub prisijungimas tiesiog neaktyvus
GITHUB_CLIENT_ID=raktas_is_github_developer_settings
GITHUB_CLIENT_SECRET=raktas_is_github_developer_settings
GITHUB_REDIRECT_URL=http://localhost:8000/api/v1/github/callback

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

### Darbuotojų administravimo sistema (`/dashboard`, `/fleet`, `/clients`, ...)

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

Darbuotojo sesija galioja **12 valandų nuo prisijungimo**, kliento – **1 valandą**. Darbuotojo profilyje rodoma tikroji išduoto tokeno galiojimo pabaiga. Pakeista trukmė taikoma naujiems prisijungimams; jau išduoti tokenai automatiškai nepratęsiami.

Darbuotojų lentelės rūšiuojamos paspaudus duomenų stulpelio antraštę: pirmas paspaudimas rikiuoja didėjančiai, kitas – mažėjančiai. Kainos ir atlyginimai lyginami skaitmeniškai, datos chronologiškai, tekstas pagal lietuvišką tvarką. Rūšiavimas taikomas visam įkeltam sąrašui prieš puslapiavimą; tuščios reikšmės lieka gale abiem kryptimis. Antraštes galima valdyti klaviatūra, o veiksmų mygtukų stulpelis nerūšiuojamas.

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

Klientų aptarnavimo pokalbiai (ne bendras EDIT) matomi tik Administratorius/Vadybininkas/Klientų aptarnavimas rolėms - žr. `backend/app/api/endpoints/staff_support.py`.

---

## DB diagrama

[DB ryšių diagrama](docs/diagramos/priedas_4_autorent_sistemos_esybiu_rysiu_diagrama.svg) · [Redaguojamas XML](docs/diagramos/priedas_4_autorent_sistemos_esybiu_rysiu_diagrama.xml)

Tiksli lentelių, laukų ir apribojimų struktūra aprašyta [database/schema.sql](database/schema.sql).

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
│   │   │   └── endpoints/             darbuotojų endpoint'ai (auth, car, client, employee,
│   │   │                              order, reservation, invoice, staff_support, geocode)
│   │   │                              IR kliento endpoint'ai (customer_auth, customer,
│   │   │                              customer_loyalty, customer_support, public)
│   │   ├── models/ · schemas/          SQLAlchemy modeliai, Pydantic schemos - DB užklausos
│   │   │                               atskiro sluoksnio neturi, rašomos tiesiog endpoint'uose
│   │   └── services/                  verslo logika: auth_service, availability_service
│   │                                   (SELECT ... FOR UPDATE rezervacijų persidengimui),
│   │                                   support_service, discount_code_service, geocode_service
│   ├── tests/                         pytest - api/ (endpoint'ai, SQLite TestClient) ir
│   │                                   services/ (vienetų testai)
│   └── utils/config.py                pydantic Settings, .env skaitymas
├── frontend/
│   └── src/
│       ├── app/                       Next.js App Router
│       │   ├── (staff)/               dashboard/, fleet/, clients/, employees/, invoices/,
│       │   │                          orders/, reservations/, support/, profile/
│       │   ├── (public)/              page.tsx, automobiliai/, paskyra/, login/, apie-mus/,
│       │   │                          kontaktai/, karjera/, kelioniu-patarimai/, ...
│       │   ├── components/            bendri UI (DataTable, ActionButtons, ...)
│       │   │   ├── staff/             darbuotojų specifiniai (EntityModal, Sidebar, ...)
│       │   │   └── public/            viešos svetainės komponentai (AutomobiliaiClient,
│       │   │                          AccountClient, SupportInbox, ...)
│       │   ├── sitemap.ts / robots.ts
│       │   └── providers/             AuthGuard (darbuotojas), CustomerAuthProvider
│       ├── hooks/                     RTK Query hook'ai (darbuotojams) + paprasti fetch
│       │                              hook'ai (klientui): usePublicCars, useCustomerLoyalty,
│       │                              useCustomerReservations, useCustomerConversations,
│       │                              useStaffSupport, ...
│       ├── store/                     Redux Toolkit + RTK Query (darbuotojų API)
│       └── utils/                     formatLt, formatApiError, carPhoto, locations, ...
├── database/
│   ├── schema.sql · seed.sql          DDL ir pradiniai duomenys
│   ├── triggers.sql                   duomenų vientisumo trigeriai
│   └── reset_demo_data.py             atstato DB į švarią pradinę demo būseną
└── docs/
    ├── diagramos/
    └── ekrano_nuotraukos/
```
