import pytest
import uuid


# ----------------------------------------------------------------
# Pagalbiniai duomenys - ATSKIRTA nuo testų žemiau, nes VALID_* šablonai ir unique_*() funkcijos naudojamos VISOSE penkiose sekcijose (automobilis/klientas/darbuotojas/užsakymas/rezervacija), ne tik vienoje - laikomi faile viršuje, kad būtų matomi PRIEŠ pirmą jų naudojimą.
# ----------------------------------------------------------------

# Grąžina UNIKALŲ automobilio numerį - numeris yra UNIQUE DB lygmeniu, tad be šito testai susidurtų su dublikato klaida.
def unique_numeris():
    return f"V{uuid.uuid4().hex[:6].upper()}"


# Grąžina UNIKALŲ VIN kodą - vin_kodas TAIP PAT UNIQUE DB lygmeniu.
def unique_vin():
    return uuid.uuid4().hex[:17].upper()


VALID_CAR = {
    "marke": "Toyota", "modelis": "Corolla", "metai": 2022,
    "spalva": "Balta", "kebulo_tipas": "Sedanas",
    "pavaru_deze": "automatinė", "variklio_turis": 1.8,
    "galia_kw": 103, "kuro_tipas": "benzinas",
    "rida": 10000, "sedimos_vietos": 5,
    "klimato_kontrole": True, "navigacija": False,
    "kaina_parai": 50.0, "automobilio_statusas": "laisvas",
    "technikines_galiojimas": "2026-12-31",
    "dabartine_vieta_id": 1, "pastabos": None,
}

VALID_CLIENT = {
    "vardas": "Testas", "pavarde": "Validuotojas",
    "el_pastas": "valid@test.lt",
    "telefono_nr": "+37060000001",
    "gimimo_data": "1990-01-01",
}

VALID_EMPLOYEE = {
    "vardas": "Darbuotojas", "pavarde": "Testinis",
    "el_pastas": "emp.valid@test.lt",
    "telefono_nr": "+37060000002",
    "pareigos": "Vadybininkas",
    "atlyginimas": 1500.0,
    "isidarbinimo_data": "2023-01-01",
    "slaptazodis": "Slaptas123!",
}

VALID_ORDER = {
    "kliento_id": 1, "automobilio_id": 1, "darbuotojo_id": 1,
    "nuomos_data": "2025-01-01", "grazinimo_data": "2025-01-05",
    "paemimo_vietos_id": 1, "grazinimo_vietos_id": 1,
    "bendra_kaina": 100.0, "uzsakymo_busena": "laukiama",
    "turi_papildomas_paslaugas": False,
}

VALID_RESERVATION = {
    "kliento_id": 1, "automobilio_id": 1,
    "rezervacijos_pradzia": "2025-06-01",
    "rezervacijos_pabaiga": "2025-06-05",
    "busena": "laukia",
}


# "autouse=True" - paleidžiama AUTOMATIŠKAI prieš VISUS šio failo testus; automobiliui (dabartine_vieta_id NOT NULL) reikia egzistuojančios vietos, o API neturi vietos KŪRIMO endpoint'o, tad ji įterpiama TIESIAI per db_session.
@pytest.fixture(scope="module", autouse=True)
def ensure_location(db_session):
    from app.models import Location
    vieta = db_session.query(Location).filter_by(vietos_id=1).first()
    if not vieta:
        vieta = Location(vietos_id=1, pavadinimas="Testo vieta", adresas="Test g. 1", miestas="Vilnius")
        db_session.add(vieta)
        db_session.commit()


# ================================================================
# Automobilio validacija - ŠI sekcija turi DAUGIAUSIA atvejų (10) iš visų penkių, nes CarBase turi DAUGIAUSIA skirtingų taisyklių tipų: skaičių ribas (metai, kaina, rida, sėdimos vietos) IR ENUM sąrašus (pavarų dėžė, kuro tipas, statusas) - kitos esybės žemiau turi tik 1-3 validatorius.
# ================================================================

# Kiekviena (laukas, bloga reikšmė) pora turi SAVO field_validator'į CarBase faile (žr. schemas/car.py) - viena parametrizuota funkcija vietoj 10 pakartotų, nes visos tikrina TĄ PATĮ raštą ("1 blogas laukas -> 422").
@pytest.mark.parametrize("field,value", [
    ("metai", 1800),               # per sena (< 1900)
    ("metai", 2099),                # per nauja (> 2030)
    ("kaina_parai", 0),              # kaina turi būti TEIGIAMA, 0 neleidžiama
    ("kaina_parai", -10),
    ("rida", -1),                    # rida negali būti neigiama
    ("sedimos_vietos", 1),           # per mažai (< 2)
    ("sedimos_vietos", 10),          # per daug (> 9)
    ("pavaru_deze", "robotas"),      # ne VALID_PAVARU_DEZE
    ("kuro_tipas", "vandenilis"),    # ne VALID_KURO_TIPAS
    ("automobilio_statusas", "parduotas"),  # ne VALID_STATUSAS
])
def test_car_create_rejects_invalid_field(client, auth_headers, field, value):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin(), field: value}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# Priešinga patikra visoms aukščiau - VISI laukai teisingi, kūrimas turi PAVYKTI (sugauna atvejį, kai validatorius per griežtas net TEISINGIEMS duomenims).
def test_car_valid_passes(client, auth_headers):
    data = {**VALID_CAR, "numeris": unique_numeris(), "vin_kodas": unique_vin()}
    resp = client.post("/api/v1/cars/", json=data, headers=auth_headers)
    assert resp.status_code == 200
    client.delete(f"/api/v1/cars/{resp.json()['automobilio_id']}", headers=auth_headers)


# ================================================================
# Kliento validacija - ATSKIRA sekcija, nes ClientBase turi MAŽIAUSIA validatorių iš visų (tik vardo ilgis ir EmailStr formatas) - telefono_nr/gimimo_data neturi papildomos field_validator patikros, tik tipo tikrinimą.
# ================================================================

# Analogiškai automobiliui aukščiau - kiekviena pora turi SAVO validatorių ClientBase faile (žr. schemas/client.py).
@pytest.mark.parametrize("field,value", [
    ("vardas", "A"),              # trumpiau nei 2 simboliai
    ("el_pastas", "ne-el-pastas"),  # EmailStr formato patikra
])
def test_client_create_rejects_invalid_field(client, auth_headers, field, value):
    data = {**VALID_CLIENT, "el_pastas": f"{uuid.uuid4().hex[:6]}@test.lt", field: value}
    resp = client.post("/api/v1/clients/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# ================================================================
# Darbuotojo validacija - ATSKIRA sekcija, nes EmployeeCreate (skirtingai nei Car/Client aukščiau) turi "slaptazodis" lauką su SAVO minimalaus ilgio patikra - vienintelė šiame faile testuojama validacija, susijusi su autentikacija, ne su pačiais duomenimis.
# ================================================================

# Analogiškai aukščiau - EmployeeBase validatoriai (žr. schemas/employee.py); atlyginimas<=0 PRIVALO atmesti abu (0 IR neigiamą), ne tik neigiamą.
@pytest.mark.parametrize("field,value", [
    ("atlyginimas", 0),
    ("atlyginimas", -100),
    ("slaptazodis", "abc"),       # trumpiau nei 8 simboliai
])
def test_employee_create_rejects_invalid_field(client, auth_headers, field, value):
    data = {**VALID_EMPLOYEE, "el_pastas": f"{uuid.uuid4().hex[:6]}@test.lt", field: value}
    resp = client.post("/api/v1/employees/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# ================================================================
# Užsakymo validacija - ATSKIRA sekcija, nes OrderBase (skirtingai nei Car/Client/Employee aukščiau, kurie tikrina VIENĄ lauką atskirai) naudoja IR model_validator - "grazinimo_data < nuomos_data" lygina DU laukus TARPUSAVYJE, ne vieną izoliuotai (žr. schemas/order.py validate_dates).
# ================================================================

# kliento_id/automobilio_id/darbuotojo_id=1 ČIA nereikia egzistuoti realiai DB - validacija (field_validator/model_validator) vyksta PRIEŠ pasiekiant DB, tad neteisinga reikšmė atmetama anksčiau, nei kas tikrina FK.
@pytest.mark.parametrize("overrides", [
    {"uzsakymo_busena": "neteisinga"},                                    # ne VALID_BUSENA
    {"nuomos_data": "2025-01-10", "grazinimo_data": "2025-01-05"},        # pabaiga ANKSTESNĖ nei pradžia
])
def test_order_create_rejects_invalid_field(client, auth_headers, overrides):
    data = {**VALID_ORDER, **overrides}
    resp = client.post("/api/v1/orders/", json=data, headers=auth_headers)
    assert resp.status_code == 422


# ================================================================
# Rezervacijos validacija - ATSKIRA sekcija nuo Užsakymo aukščiau, nes nors ŠI esybė naudoja TĄ PATĮ model_validator raštą (datos palyginimas), ReservationBase yra VISIŠKAI KITA Pydantic klasė (schemas/reservation.py, ne order.py) - skirtinga DB lentelė (Rezervavimas, ne Uzsakymai), tad patikra turi būti pakartota ATSKIRAI, ne tikima, kad viena apima kitą.
# ================================================================

# Tas pats FK principas kaip Užsakymo aukščiau - kliento_id/automobilio_id=1 nereikia egzistuoti realiai DB, nes validacija vyksta PRIEŠ pasiekiant DB.
@pytest.mark.parametrize("overrides", [
    {"busena": "neteisinga"},                                             # ne VALID_BUSENA
    {"rezervacijos_pradzia": "2025-06-10", "rezervacijos_pabaiga": "2025-06-05"},  # pabaiga ANKSTESNĖ nei pradžia
])
def test_reservation_create_rejects_invalid_field(client, auth_headers, overrides):
    data = {**VALID_RESERVATION, **overrides}
    resp = client.post("/api/v1/reservations/", json=data, headers=auth_headers)
    assert resp.status_code == 422
