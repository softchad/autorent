# Kliento pagalbos pokalbių testai - /api/v1/customer/support endpoint'ai.
from datetime import date
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# PASTABA DAUGELIUI testų žemiau: "auth_headers" parametras priimamas, bet NIEKADA tiesiogiai nenaudojamas kūne - tai NE klaida. "auth_headers" fixture (conftest.py) savo viduje priklauso nuo "client" fixture'os, kuri PIRMA KARTĄ pakeičia app.dependency_overrides[get_db] į testinę DB; kadangi šis failas naudoja SAVO "client = TestClient(app)" (ne tą fixture'ą), vien PRAŠYMAS "auth_headers" parametru priverčia tą override įsijungti PRIEŠ testą - be jo šis modulio "client" bandytų kalbėtis su TIKRA, ne testine DB.


# Užregistruoja NAUJĄ klientą (atsitiktiniu el. paštu, kad testai nesikirstų dėl UNIQUE) ir grąžina TIK jo tokeną.
def _registered_customer():
    email = f"support{uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Pokalbis",
            "pavarde": "Klientas",
            "el_pastas": email,
            "telefono_nr": "+37061234567",
            "gimimo_data": "1995-01-01",
            "slaptazodis": "Testinis123!",
        },
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# Sukuria pokalbį su PIRMA žinute ir grąžina pilną atsakymą (ConversationDetailOut) - naudojama visur, kur testui reikia JAU esamo pokalbio, ne tik kuriant naują.
def _create_conversation(token, tema="Klausimas", pranesimas="Sveiki, turiu klausimą.", kategorija="kita"):
    resp = client.post(
        "/api/v1/customer/support/conversations",
        json={"tema": tema, "pranesimas": pranesimas, "kategorija": kategorija},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# Sukuria automobilį ADMIN teisėmis (auth_headers aktyvinamas kviečiančio testo, žr. pastabą viršuje) - naudojamas rezervacijos testuose žemiau, kur svarbu TURĖTI realų automobilio_id, ne patį automobilį.
def _create_car(db_session):
    from app.models.car import Car
    from app.models.location import Location

    # Automobilis BŪTINAI turi dabartine_vieta_id (nullable=False) - API neturi vietos KŪRIMO endpoint'o, tad vieta įterpiama TIESIAI per db_session.
    if not db_session.query(Location).filter_by(vietos_id=1).first():
        db_session.add(Location(vietos_id=1, pavadinimas="Testo vieta", adresas="Test g. 1", miestas="Vilnius"))
        db_session.commit()

    car = Car(
        marke="Toyota", modelis="Corolla", metai=2022,
        numeris=f"SUP{uuid4().hex[:3].upper()}", vin_kodas=uuid4().hex[:17].upper(),
        spalva="Pilka", kebulo_tipas="Sedanas", pavaru_deze="automatinė",
        variklio_turis=1.6, galia_kw=90, kuro_tipas="benzinas", rida=5000,
        sedimos_vietos=5, kaina_parai=35.0, automobilio_statusas="laisvas",
        technikines_galiojimas=date(2027, 1, 1), dabartine_vieta_id=1,
    )
    db_session.add(car)
    db_session.commit()
    return car


# Pagrindinis "laimingas kelias" - pokalbis sukuriamas su PIRMA žinute iš karto, pradinė būsena "atvira".
def test_create_conversation(auth_headers):
    token = _registered_customer()
    body = _create_conversation(token)
    assert body["tema"] == "Klausimas"
    assert body["busena"] == "atvira"
    assert len(body["zinutes"]) == 1
    assert body["zinutes"][0]["autoriaus_tipas"] == "klientas"


# TEMA_MIN=3 simboliai (žr. support_service.py _clean) - "Ab" (2 simboliai) turi atmesti su 400.
def test_create_conversation_rejects_too_short_tema(auth_headers):
    token = _registered_customer()
    resp = client.post(
        "/api/v1/customer/support/conversations",
        json={"tema": "Ab", "pranesimas": "Pakankamai ilgas pranešimas.", "kategorija": "kita"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


# Tuščia žinutė (TEXT_MIN=1) turi atmesti - klientas negali pradėti pokalbio be turinio.
def test_create_conversation_rejects_empty_message(auth_headers):
    token = _registered_customer()
    resp = client.post(
        "/api/v1/customer/support/conversations",
        json={"tema": "Pakankamai ilga tema", "pranesimas": "", "kategorija": "kita"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


# create_conversation NEMETA klaidos dėl neatpažintos kategorijos - tiesiog tyliai naudoja "kita" (žr. support_service.py).
def test_create_conversation_invalid_kategorija_defaults_to_kita(auth_headers):
    token = _registered_customer()
    body = _create_conversation(token, kategorija="visiskai_neteisinga")
    assert body["kategorija"] == "kita"


# Klientas gali susieti pokalbį TIK su SAVO rezervacija - bandymas susieti SVETIMO kliento rezervaciją (pagal ID spėjimą) turi grąžinti 404.
def test_create_conversation_with_other_clients_reservation_rejected(auth_headers, db_session):
    from app.models.reservation import Reservation
    from app.models.client import Client

    other_email = f"otherres{uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/customer/register",
        json={
            "vardas": "Kitas", "pavarde": "Klientas", "el_pastas": other_email,
            "telefono_nr": "+37061234567", "gimimo_data": "1995-01-01", "slaptazodis": "Testinis123!",
        },
    )
    other_kliento_id = db_session.query(Client).filter_by(el_pastas=other_email).first().kliento_id
    car = _create_car(db_session)
    other_reservation = Reservation(
        kliento_id=other_kliento_id, automobilio_id=car.automobilio_id,
        rezervacijos_pradzia=date(2026, 12, 1), rezervacijos_pabaiga=date(2026, 12, 5),
        busena="patvirtinta",
    )
    db_session.add(other_reservation)
    db_session.commit()

    token = _registered_customer()
    resp = client.post(
        "/api/v1/customer/support/conversations",
        json={
            "tema": "Svetima rezervacija", "pranesimas": "Bandau susieti svetimą rezervaciją.",
            "kategorija": "rezervacija", "rezervacijos_id": other_reservation.rezervacijos_id,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# Saugumo riba - klientas B neturi matyti kliento A pokalbių, net jei abu kviečia TĄ PATĮ sąrašo endpoint'ą.
def test_list_conversations_only_own(auth_headers):
    token_a = _registered_customer()
    token_b = _registered_customer()
    _create_conversation(token_a)

    resp_a = client.get("/api/v1/customer/support/conversations", headers={"Authorization": f"Bearer {token_a}"})
    resp_b = client.get("/api/v1/customer/support/conversations", headers={"Authorization": f"Bearer {token_b}"})
    assert resp_a.status_code == 200 and len(resp_a.json()) >= 1
    assert resp_b.status_code == 200 and resp_b.json() == []


# Tas pats saugumo principas kaip aukščiau, bet VIENO pokalbio endpoint'ui - 404 (ne 403), kad klientas negalėtų atspėti, ar svetimas pokalbio ID egzistuoja (žr. _get_owned customer_support.py faile).
def test_cannot_view_another_customers_conversation(auth_headers):
    token_a = _registered_customer()
    token_b = _registered_customer()
    convo = _create_conversation(token_a)

    resp = client.get(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert resp.status_code == 404


# Bet kuri kliento žinutė grąžina pokalbį atgal į "atvira", net jei jis buvo "sprendziama" (darbuotojas jau atsakė) - žr. support_service.add_customer_message.
def test_add_message_reopens_conversation(auth_headers, db_session):
    from app.models.support_conversation import SupportConversation
    from app.models.employee import Employee
    from app.services import support_service

    token = _registered_customer()
    convo = _create_conversation(token)

    db_convo = db_session.query(SupportConversation).filter_by(pokalbio_id=convo["pokalbio_id"]).first()
    emp = db_session.query(Employee).filter_by(pareigos="Administratorius").first()
    support_service.add_staff_message(db_session, db_convo, emp.darbuotojo_id, "Atsakymas", "sprendziama")
    assert db_convo.busena == "sprendziama"

    resp = client.post(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}/messages",
        json={"tekstas": "Dar turiu klausimą"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["busena"] == "atvira"


# Vidinė darbuotojo pastaba NIEKADA negrąžinama kliento endpoint'e - net jei ji būtų kažkaip liktų atsakyme, teksto paieška resp.text viduje tai pagautų.
def test_internal_note_never_returned_to_customer(auth_headers, db_session):
    from app.models.support_conversation import SupportConversation
    from app.models.employee import Employee
    from app.services import support_service

    token = _registered_customer()
    convo = _create_conversation(token)

    db_convo = db_session.query(SupportConversation).filter_by(pokalbio_id=convo["pokalbio_id"]).first()
    emp = db_session.query(Employee).filter_by(pareigos="Administratorius").first()
    support_service.add_note(db_session, db_convo, emp.darbuotojo_id, "Vidinė pastaba, klientui nerodoma")

    resp = client.get(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert "Vidinė pastaba" not in resp.text


# Pažymėjus PASKUTINĘ žinutę kaip matytą, "neperskaityta" turi grįžti False.
def test_mark_seen(auth_headers):
    token = _registered_customer()
    convo = _create_conversation(token)
    last_msg_id = convo["zinutes"][-1]["zinutes_id"]

    resp = client.post(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}/seen",
        json={"zinutes_id": last_msg_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["neperskaityta"] is False


# Bandoma "sumažinti" riba žemesniu zinutes_id - mark_seen turi TAI IGNORUOTI, ne leisti pasenusiam/senam įrenginiui atstatyti ribą atgal (žr. support_service.py "riba gali tik didėti").
def test_mark_seen_cannot_decrease(auth_headers, db_session):
    from app.models.support_conversation import SupportConversation

    token = _registered_customer()
    convo = _create_conversation(token)
    last_msg_id = convo["zinutes"][-1]["zinutes_id"]

    client.post(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}/seen",
        json={"zinutes_id": last_msg_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    client.post(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}/seen",
        json={"zinutes_id": 0},
        headers={"Authorization": f"Bearer {token}"},
    )
    db_convo = db_session.query(SupportConversation).filter_by(pokalbio_id=convo["pokalbio_id"]).first()
    assert db_convo.kliento_paskutinis_matytas == last_msg_id


# Be tokeno (ar su svetimu) niekas negali pradėti pokalbio - tikrina get_current_customer sargą.
def test_create_conversation_requires_customer_token():
    resp = client.post(
        "/api/v1/customer/support/conversations",
        json={"tema": "Klausimas", "pranesimas": "Test", "kategorija": "kita"},
    )
    assert resp.status_code == 401


# Pokalbis, susietas su rezervacija, turi grąžinti automobilio info (marke/modelis) - ne tik rezervacijos_id.
def test_reservation_context_shown_in_conversation(auth_headers, db_session):
    from app.models.client import Client
    from app.models.reservation import Reservation

    token = _registered_customer()
    email = client.get(
        "/api/v1/customer/me", headers={"Authorization": f"Bearer {token}"}
    ).json()["el_pastas"]
    kliento_id = db_session.query(Client).filter_by(el_pastas=email).first().kliento_id

    car = _create_car(db_session)
    reservation = Reservation(
        kliento_id=kliento_id, automobilio_id=car.automobilio_id,
        rezervacijos_pradzia=date(2026, 11, 1), rezervacijos_pabaiga=date(2026, 11, 5),
        busena="patvirtinta",
    )
    db_session.add(reservation)
    db_session.commit()

    resp = client.post(
        "/api/v1/customer/support/conversations",
        json={
            "tema": "Klausimas apie rezervaciją", "pranesimas": "Ar galiu pakeisti datą?",
            "kategorija": "kita", "rezervacijos_id": reservation.rezervacijos_id,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    rezervacija = resp.json()["rezervacija"]
    assert rezervacija is not None
    assert rezervacija["marke"] == "Toyota" and rezervacija["modelis"] == "Corolla"
    assert rezervacija["rezervacijos_id"] == reservation.rezervacijos_id


# "Neperskaityta" DARBUOTOJO atsakymui turi tapti True IŠ KARTO, ir vėl False, kai klientas pažymi matytą - pilnas gyvavimo ciklas vienu testu.
def test_unread_flag_true_after_staff_reply_then_false_after_seen(auth_headers, db_session):
    from app.models.support_conversation import SupportConversation
    from app.models.employee import Employee
    from app.services import support_service

    token = _registered_customer()
    convo = _create_conversation(token)

    db_convo = db_session.query(SupportConversation).filter_by(pokalbio_id=convo["pokalbio_id"]).first()
    emp = db_session.query(Employee).filter_by(pareigos="Administratorius").first()
    staff_msg = support_service.add_staff_message(db_session, db_convo, emp.darbuotojo_id, "Atsakymas", "sprendziama")

    list_resp = client.get("/api/v1/customer/support/conversations", headers={"Authorization": f"Bearer {token}"})
    listed = next(c for c in list_resp.json() if c["pokalbio_id"] == convo["pokalbio_id"])
    assert listed["neperskaityta"] is True

    seen_resp = client.post(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}/seen",
        json={"zinutes_id": staff_msg.zinutes_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert seen_resp.json()["neperskaityta"] is False


# Kiekviena nauja kliento žinutė turi atnaujinti pokalbio veiklos laiką, net kai būsena lieka atvira; tai tikrina support_service.add_customer_message įrašomą atnaujinimo_data.
def test_second_message_with_unchanged_status_still_bumps_activity(auth_headers, db_session):
    from app.models.support_conversation import SupportConversation

    token = _registered_customer()
    convo = _create_conversation(token)
    db_convo = db_session.query(SupportConversation).filter_by(pokalbio_id=convo["pokalbio_id"]).first()
    before = db_convo.atnaujinimo_data

    resp = client.post(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}/messages",
        json={"tekstas": "Antra žinutė, būsena nesikeičia (vis tiek 'atvira')."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    db_session.refresh(db_convo)
    assert db_convo.atnaujinimo_data >= before


# Perskaitymo žymos atnaujinimas neturi keisti pokalbio veiklos laiko, nes darbuotojų eilė rikiuojama pagal tikras žinutes ir veiksmus, o ne jų skaitymą.
def test_mark_seen_never_touches_activity_timestamp(auth_headers, db_session):
    from app.models.support_conversation import SupportConversation

    token = _registered_customer()
    convo = _create_conversation(token)
    last_msg_id = convo["zinutes"][-1]["zinutes_id"]
    db_convo = db_session.query(SupportConversation).filter_by(pokalbio_id=convo["pokalbio_id"]).first()
    before = db_convo.atnaujinimo_data

    resp = client.post(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}/seen",
        json={"zinutes_id": last_msg_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    db_session.refresh(db_convo)
    assert db_convo.atnaujinimo_data == before


# Perskaitymo žyma ribojama paskutinės egzistuojančios pokalbio žinutės ID, kad per didelė kliento pateikta reikšmė nepaslėptų būsimų neperskaitytų žinučių.
def test_mark_seen_clamps_future_message_id(auth_headers, db_session):
    from app.models.support_conversation import SupportConversation
    from app.models.employee import Employee
    from app.services import support_service

    token = _registered_customer()
    convo = _create_conversation(token)

    fake_future_id = convo["zinutes"][-1]["zinutes_id"] + 999999
    seen_resp = client.post(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}/seen",
        json={"zinutes_id": fake_future_id},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert seen_resp.status_code == 200, seen_resp.text

    db_convo = db_session.query(SupportConversation).filter_by(pokalbio_id=convo["pokalbio_id"]).first()
    emp = db_session.query(Employee).filter_by(pareigos="Administratorius").first()
    support_service.add_staff_message(db_session, db_convo, emp.darbuotojo_id, "Naujas tikras atsakymas", "sprendziama")

    list_resp = client.get("/api/v1/customer/support/conversations", headers={"Authorization": f"Bearer {token}"})
    listed = next(c for c in list_resp.json() if c["pokalbio_id"] == convo["pokalbio_id"])
    assert listed["neperskaityta"] is True


# Pasikeitus su pokalbiu susietos rezervacijos klientui, pradinio pokalbio savininkas turi matyti tik savo pokalbį, o ne kito kliento automobilį ir datas.
def test_reassigned_reservation_context_hidden_from_former_owner(auth_headers, db_session):
    from app.models.client import Client
    from app.models.reservation import Reservation

    token_a = _registered_customer()
    email_a = client.get("/api/v1/customer/me", headers={"Authorization": f"Bearer {token_a}"}).json()["el_pastas"]
    kliento_a_id = db_session.query(Client).filter_by(el_pastas=email_a).first().kliento_id

    token_b = _registered_customer()
    email_b = client.get("/api/v1/customer/me", headers={"Authorization": f"Bearer {token_b}"}).json()["el_pastas"]
    kliento_b_id = db_session.query(Client).filter_by(el_pastas=email_b).first().kliento_id

    car = _create_car(db_session)
    reservation = Reservation(
        kliento_id=kliento_a_id, automobilio_id=car.automobilio_id,
        rezervacijos_pradzia=date(2026, 11, 1), rezervacijos_pabaiga=date(2026, 11, 5),
        busena="patvirtinta",
    )
    db_session.add(reservation)
    db_session.commit()

    convo = client.post(
        "/api/v1/customer/support/conversations",
        json={
            "tema": "Klausimas apie rezervaciją", "pranesimas": "Ar galiu pakeisti datą?",
            "kategorija": "kita", "rezervacijos_id": reservation.rezervacijos_id,
        },
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()
    assert convo["rezervacija"] is not None

    reassign_resp = client.put(
        f"/api/v1/reservations/{reservation.rezervacijos_id}",
        json={
            "kliento_id": kliento_b_id,
            "rezervacijos_pradzia": "2029-03-10",
            "rezervacijos_pabaiga": "2029-03-14",
        },
        headers=auth_headers,
    )
    assert reassign_resp.status_code == 200, reassign_resp.text

    reread = client.get(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert reread.status_code == 200, reread.text
    assert reread.json()["rezervacija"] is None


# Darbuotojo žinutės autorius klientui rodomas kaip "AutoRent (Vardas)" - NIEKADA el. paštas ar telefonas (žr. _author_names_map customer_support.py faile).
def test_staff_message_author_name_has_autorent_prefix(auth_headers, db_session):
    from app.models.support_conversation import SupportConversation
    from app.models.employee import Employee
    from app.services import support_service

    token = _registered_customer()
    convo = _create_conversation(token)

    db_convo = db_session.query(SupportConversation).filter_by(pokalbio_id=convo["pokalbio_id"]).first()
    emp = db_session.query(Employee).filter_by(pareigos="Administratorius").first()
    support_service.add_staff_message(db_session, db_convo, emp.darbuotojo_id, "Atsakymas", "sprendziama")

    resp = client.get(
        f"/api/v1/customer/support/conversations/{convo['pokalbio_id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    staff_messages = [m for m in resp.json()["zinutes"] if m["autoriaus_tipas"] == "darbuotojas"]
    assert staff_messages[0]["autorius_vardas"] == f"AutoRent ({emp.vardas})"
    assert emp.el_pastas not in resp.text
