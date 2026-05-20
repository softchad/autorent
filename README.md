# AutoRent

Žiniatinklinė automobilių nuomos valdymo sistema. Darbuotojai valdo automobilius, klientus, rezervacijas, užsakymus ir sąskaitas per vaidmenimis apsaugotą sąsają.

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
| **Backend** | FastAPI · SQLAlchemy · MySQL · Pydantic v2 |
| **Frontend** | Next.js 15 · TypeScript · Redux Toolkit (RTK Query) · Tailwind CSS |
| **Autentifikacija** | JWT · bcrypt · OAuth 2.0 (Google, GitHub) |
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
| `transactions.sql` | `DROP PROCEDURE` eilutę vykdyk atskirai, tada visą `CREATE PROCEDURE ... END` bloką pažymėk → `Ctrl+Enter` |

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
SESSION_SECRET_KEY=bet_koks_ilgas_raktas
OPENCAGE_API_KEY=raktas_is_opencage.com

# OAuth (neprivaloma — be šių veikia tik paprastas prisijungimas)
GOOGLE_CLIENT_ID=raktas_is_google_cloud_console
GOOGLE_CLIENT_SECRET=raktas_is_google_cloud_console
GOOGLE_REDIRECT_URL=http://localhost:8000/api/v1/google/callback

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

**Kiekvieną kartą:**
```bash
cd frontend
npm run dev
```
→ veikia adresu `http://localhost:3000`

---

## Funkcionalumas

| Modulis | Aprašymas |
|---------|-----------|
| **Automobiliai** | CRUD, statusų valdymas, žemėlapis |
| **Rezervacijos** | Datų rezervavimas |
| **Užsakymai** | Nuomos valdymas, automatinis kainos skaičiavimas |
| **Klientai** | Registras, bonus taškai |
| **Sąskaitos** | Generavimas, PDF atsisiuntimas |
| **Darbuotojai** | Valdymas, rolės, prisijungimo paskyros |
| **Pagalbos užklausos** | Klientų užklausų administravimas |
| **Profilis** | Paskyros peržiūra ir keitimas |

---

## Rolės

| Rolė | Skaityti | Redaguoti | Trinti |
|------|:--------:|:---------:|:------:|
| **Admin** | ✓ | ✓ | ✓ |
| **Emplo** | ✓ | ✓ | — |

---

## DB diagrama

[dbdiagram.io](https://dbdiagram.io/d/Autorent-6a1ae349f15b4b0452368d56)

---

## Projekto struktūra

```
autorent/
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   ├── permissions.py
│   │   │   └── v1/
│   │   │       └── endpoints/
│   │   │           ├── auth.py
│   │   │           ├── car.py
│   │   │           ├── client.py
│   │   │           ├── client_support.py
│   │   │           ├── employee.py
│   │   │           ├── geocode.py
│   │   │           ├── invoice.py
│   │   │           ├── order.py
│   │   │           └── reservation.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   ├── models/
│   │   │   ├── car.py
│   │   │   ├── client.py
│   │   │   ├── client_support.py
│   │   │   ├── employee.py
│   │   │   ├── invoice.py
│   │   │   ├── location.py
│   │   │   ├── order.py
│   │   │   └── reservation.py
│   │   ├── repositories/
│   │   │   ├── car.py
│   │   │   ├── client.py
│   │   │   ├── client_support.py
│   │   │   ├── employee.py
│   │   │   ├── geocode.py
│   │   │   ├── invoice.py
│   │   │   ├── order.py
│   │   │   └── reservation.py
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── car.py
│   │   │   ├── client.py
│   │   │   ├── client_support.py
│   │   │   ├── employee.py
│   │   │   ├── geocode.py
│   │   │   ├── invoice.py
│   │   │   ├── location.py
│   │   │   ├── order.py
│   │   │   └── reservation.py
│   │   └── services/
│   │       └── auth_service.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── init_test_db.sql
│   │   ├── api/
│   │   │   ├── test_auth.py
│   │   │   ├── test_car.py
│   │   │   ├── test_car_extended.py
│   │   │   ├── test_client.py
│   │   │   ├── test_client_extended.py
│   │   │   ├── test_client_support.py
│   │   │   ├── test_employee.py
│   │   │   ├── test_geocode.py
│   │   │   ├── test_invoice.py
│   │   │   ├── test_order.py
│   │   │   ├── test_reservation.py
│   │   │   ├── test_reservation_extended.py
│   │   │   ├── test_roles_permissions.py
│   │   │   └── test_validation.py
│   │   ├── services/
│   │   │   ├── test_auth_service.py
│   │   │   └── test_permissions.py
│   │   └── utils/
│   │       └── test_hateoas.py
│   └── utils/
│       ├── config.py
│       └── hateoas.py
├── frontend/
│   ├── next.config.ts
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── openapi.config.js
│   ├── public/
│   │   └── fonts/
│   │       ├── Roboto-Bold.ttf
│   │       └── Roboto-Regular.ttf
│   └── src/
│       ├── middleware.ts
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   ├── login/
│       │   │   └── page.tsx
│       │   ├── oauth/
│       │   │   ├── page.tsx
│       │   │   └── OAuthClient.tsx
│       │   ├── profile/
│       │   │   └── page.tsx
│       │   ├── cars/
│       │   │   └── page.tsx
│       │   ├── clients/
│       │   │   └── page.tsx
│       │   ├── employees/
│       │   │   └── page.tsx
│       │   ├── invoices/
│       │   │   └── page.tsx
│       │   ├── orders/
│       │   │   └── page.tsx
│       │   ├── reservations/
│       │   │   └── page.tsx
│       │   ├── support/
│       │   │   └── page.tsx
│       │   ├── components/
│       │   │   ├── ActionButtons.tsx
│       │   │   ├── BarChartBox.tsx
│       │   │   ├── BaseModal.tsx
│       │   │   ├── ClientProvider.tsx
│       │   │   ├── CreateEntityButton.tsx
│       │   │   ├── DataTable.tsx
│       │   │   ├── InvoicePdfDocument.tsx
│       │   │   ├── InvoicePdfModal.tsx
│       │   │   ├── Layout.tsx
│       │   │   ├── LogoutButton.tsx
│       │   │   ├── MapComponent.tsx
│       │   │   ├── PieChartBox.tsx
│       │   │   ├── Sidebar.tsx
│       │   │   ├── StatCard.tsx
│       │   │   ├── StatusBadge.tsx
│       │   │   ├── loadingScreen.tsx
│       │   │   └── modals/
│       │   │       └── EntityModal.tsx
│       │   ├── guards/
│       │   │   └── AuthGuard.tsx
│       │   └── providers/
│       │       └── AuthHydrate.tsx
│       ├── assets/
│       │   ├── autorentLOGO.png
│       │   └── autorenttext.png
│       ├── hooks/
│       │   ├── useCarsData.ts
│       │   ├── useClientsData.ts
│       │   ├── useDashboardStats.ts
│       │   ├── useEmployeesData.ts
│       │   ├── useInvoiceModals.ts
│       │   ├── useInvoicesData.ts
│       │   ├── useOrdersData.ts
│       │   ├── useReservationData.ts
│       │   └── useSupportData.ts
│       ├── store/
│       │   ├── authSlice.ts
│       │   ├── baseApi.ts
│       │   ├── carRentalApi.ts
│       │   ├── enhanceEndpoints.ts
│       │   ├── hooks.ts
│       │   ├── index.ts
│       │   └── store.ts
│       └── utils/
│           └── formatApiError.ts
├── database/
│   ├── schema.sql
│   ├── seed.sql
│   ├── triggers.sql
│   ├── transactions.sql
│   └── queries.sql
└── docs/
    └── screenshots/
        ├── login.png
        ├── dashboard.png
        ├── reservations.png
        ├── clients.png
        ├── invoice.png
        └── support.png
```
