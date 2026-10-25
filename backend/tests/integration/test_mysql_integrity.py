# Šie testai naudoja tik atskirai nurodytą laikiną MySQL bazę, nes SQLite neatkuria eilučių užraktų ir REPEATABLE READ skaitymo taisyklių.
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from threading import Event, Barrier

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Car, Client, Employee, Location, Order, Reservation
from app.models.invoice import Invoice
from app.models.loyalty_reward import LoyaltyReward
from app.services import availability_service, discount_code_service
from app.api.endpoints.employee import _lock_administrators
from app.api.endpoints.order import update_order
from app.schemas.order import OrderUpdate
from fastapi import HTTPException


# Atsisako bet kokios ne testavimui pavadintos bazės ir kiekvienam testui paruošia tuščią schemą su tikrais išoriniais raktais.
@pytest.fixture
def mysql_engine():
    target = os.environ.get("AUTORENT_MYSQL_TEST_URL")
    if not target:
        pytest.skip("Atskira MySQL testų bazė nenurodyta")
    if not (make_url(target).database or "").startswith("autorent_verify_"):
        pytest.fail("MySQL testų bazės vardas nesaugus")
    engine = create_engine(target)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


# Sukuria minimalų klientą, padalinį ir automobilį, kad užraktų bandymas priklausytų nuo tikrų nuomos duomenų.
@pytest.fixture
def records(mysql_engine):
    with Session(mysql_engine) as db:
        db.add(Location(vietos_id=1, pavadinimas="Test", adresas="Test 1", miestas="Vilnius"))
        db.add(Client(kliento_id=1, vardas="Test", pavarde="Client", el_pastas="test@example.com", telefono_nr="+37060000000", gimimo_data=date(1990, 1, 1)))
        db.flush()
        db.add(Car(automobilio_id=1, marke="Test", modelis="Test", metai=2025, numeris="TEST001", vin_kodas="TEST0000000000001", spalva="Test", kebulo_tipas="Test", pavaru_deze="Test", variklio_turis=1, galia_kw=100, kuro_tipas="Test", rida=0, sedimos_vietos=5, kaina_parai=40, automobilio_statusas="laisvas", technikines_galiojimas=date(2030, 1, 1), dabartine_vieta_id=1))
        db.commit()


# Antras sandoris pradeda seną skaitymo momentinę kopiją, bet po pirmojo įrašo privalo pastebėti konfliktą tiek automobilio, tiek kliento patikroje.
def test_booking_checks_see_committed_competitor(mysql_engine, records):
    ready = Event()
    proceed = Event()

    # Užklausa palaukia konkurento įrašo po savo pirmo įprasto skaitymo, todėl tikrinama būtent pasenusios momentinės kopijos rizika.
    def competitor():
        with Session(mysql_engine) as db:
            db.query(Client).filter_by(kliento_id=1).first()
            ready.set()
            assert proceed.wait(10)
            availability_service.lock_car_row(db, 1)
            availability_service.lock_client_row(db, 1)
            return (availability_service.car_has_conflict(db, 1, date(2028, 1, 1), date(2028, 1, 4)), availability_service.client_has_conflict(db, 1, date(2028, 1, 1), date(2028, 1, 4)))

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(competitor)
        assert ready.wait(10)
        with Session(mysql_engine) as db:
            availability_service.lock_car_row(db, 1)
            availability_service.lock_client_row(db, 1)
            db.add(Reservation(kliento_id=1, automobilio_id=1, rezervacijos_pradzia=date(2028, 1, 1), rezervacijos_pabaiga=date(2028, 1, 4), busena="patvirtinta", kaina_parai=40))
            db.commit()
        proceed.set()
        assert future.result(timeout=15) == (True, True)


# Du administratoriai vienu metu bando atsisakyti teisių, tačiau po nuoseklių užraktų turi likti vienas administratorius.
def test_administrator_locks_preserve_one_admin(mysql_engine):
    ready = Barrier(2)
    with Session(mysql_engine) as db:
        for number in (1, 2):
            db.add(Employee(darbuotojo_id=number, vardas="Admin", pavarde="Test", el_pastas=f"admin{number}@example.com", telefono_nr="+37060000000", pareigos="Administratorius", atlyginimas=1000, isidarbinimo_data=date(2020, 1, 1)))
        db.commit()

    # Tikrina tą patį užrakinimo ir likusių administratorių sprendimą, kurį naudoja darbuotojo keitimo ir trynimo operacijos.
    def demote(number):
        with Session(mysql_engine) as db:
            ready.wait(timeout=10)
            admins = _lock_administrators(db)
            if not any(admin.darbuotojo_id != number for admin in admins):
                return False
            employee = db.get(Employee, number)
            employee.pareigos = "Mechanikas"
            db.commit()
            return True

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sum(pool.map(demote, (1, 2))) == 1
    with Session(mysql_engine) as db:
        assert db.query(Employee).filter_by(pareigos="Administratorius").count() == 1


# Patikrina, kad po kodo kolizijos išlieka to paties sandorio žymė: pilnas rollback ją prarastų kartu su atlygio užraktu.
def test_coupon_collision_preserves_outer_transaction(mysql_engine, records, monkeypatch):
    with Session(mysql_engine) as db:
        discount_code_service.issue_code(db, 1, 10, "lojalumas", None)
        db.add(LoyaltyReward(kliento_id=1, etapo_numeris=1))
        db.commit()
        existing = db.execute(text("SELECT kodas FROM Nuolaidos_Kodai LIMIT 1")).scalar()
        values = iter([existing, "AUTORENT987654"])
        monkeypatch.setattr(discount_code_service, "generate_unique_code", lambda _db: next(values))
        reward = db.query(LoyaltyReward).with_for_update().first()
        client = db.get(Client, 1)
        client.vardas = "Preserved"
        code = discount_code_service.issue_code(db, 1, 10, "lojalumas", None)
        with Session(mysql_engine) as competitor:
            with pytest.raises(OperationalError) as locked:
                competitor.query(LoyaltyReward).filter_by(atlygio_id=reward.atlygio_id).with_for_update(nowait=True).first()
            assert locked.value.orig.args[0] == 3572
        db.commit()
        assert code.kodas == "AUTORENT987654"
        assert db.get(Client, 1).vardas == "Preserved"


# Duomenų bazė pati privalo atmesti antrą to paties užsakymo sąskaitą, net jeigu abu prašymai praeitų išankstinę patikrą.
def test_invoice_unique_constraint(mysql_engine, records):
    with Session(mysql_engine) as db:
        employee = Employee(vardas="Admin", pavarde="Test", el_pastas="admin@example.com", telefono_nr="+37060000000", pareigos="Administratorius", atlyginimas=1000, isidarbinimo_data=date(2020, 1, 1))
        db.add(employee)
        db.flush()
        order = Order(kliento_id=1, automobilio_id=1, darbuotojo_id=employee.darbuotojo_id, nuomos_data=date(2028, 1, 1), grazinimo_data=date(2028, 1, 3), paemimo_vietos_id=1, grazinimo_vietos_id=1, bendra_kaina=80, uzsakymo_busena="patvirtinta")
        db.add(order)
        db.flush()
        db.add(Invoice(uzsakymo_id=order.uzsakymo_id, suma=80, saskaitos_data=date(2028, 1, 1)))
        db.commit()
        db.add(Invoice(uzsakymo_id=order.uzsakymo_id, suma=80, saskaitos_data=date(2028, 1, 1)))
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()


# Kol vienas redagavimas laukia automobilio užrakto, baigta nuoma negali būti grąžinta į aktyvią būseną pagal seną ORM objektą.
def test_waiting_update_cannot_reopen_completed_rental(mysql_engine, records, monkeypatch):
    with Session(mysql_engine) as db:
        employee = Employee(vardas="Admin", pavarde="Test", el_pastas="admin@example.com", telefono_nr="+37060000000", pareigos="Administratorius", atlyginimas=1000, isidarbinimo_data=date(2020, 1, 1))
        db.add(employee)
        db.flush()
        order = Order(kliento_id=1, automobilio_id=1, darbuotojo_id=employee.darbuotojo_id, nuomos_data=date(2028, 1, 1), grazinimo_data=date(2028, 1, 3), paemimo_vietos_id=1, grazinimo_vietos_id=1, bendra_kaina=80, uzsakymo_busena="patvirtinta")
        db.add(order)
        db.commit()
        order_id = order.uzsakymo_id
    ready, proceed = Event(), Event()
    delayed = []
    real_lock = availability_service.lock_car_row

    # Pristabdo tik seno redagavimo sesiją, kad kitas sandoris tuo metu tikrai spėtų užbaigti nuomą.
    def controlled_lock(db, car_id):
        if delayed and db is delayed[0]:
            ready.set()
            assert proceed.wait(10)
        return real_lock(db, car_id)

    monkeypatch.setattr(availability_service, "lock_car_row", controlled_lock)

    # Pradeda aktyvinimą prieš konkurento užbaigimą ir tikisi konflikto, o ne sėkmingo senos būsenos įrašymo.
    def reactivate():
        with Session(mysql_engine) as db:
            delayed.append(db)
            with pytest.raises(HTTPException) as rejected:
                update_order(order_id, OrderUpdate(uzsakymo_busena="vykdoma"), db)
            return rejected.value.status_code

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(reactivate)
        assert ready.wait(10)
        with Session(mysql_engine) as db:
            update_order(order_id, OrderUpdate(uzsakymo_busena="užbaigta"), db)
        proceed.set()
        assert future.result(timeout=15) == 409
