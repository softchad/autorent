# issue_code lenktynių spragos (žr. discount_code_service.py komentarą) testas - generate_unique_code PATIKRA (SELECT) ir issue_code flush (INSERT) NĖRA atominiai.
# SAVO ATSKIRA DB sesija (ne bendras conftest.py "db_session") - issue_code viduje kviečiamas "db.rollback()" lenktynių atveju, o bendras modulio lygio "db_session" yra PRIJUNGTAS prie IŠORINĖS, per visą modulį besitęsiančios transakcijos (žr. conftest.py), kuri mid-test "rollback()" NEpalaiko - tikram HTTP užklausimui (žr. deps.py get_db) kiekviena sesija yra SAVA, tad šis skirtumas yra tik testinės infrastruktūros, ne produkcinio kodo, ribotumas.
from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
import app.models  # noqa: F401 - registruoja VISUS modelius Base.metadata'oje PRIEŠ create_all žemiau
from app.models.client import Client
from app.models.discount_code import DiscountCode
from app.services import discount_code_service


# Atskira sesija neleidžia kolizijos bandymui atšaukti kitų testų duomenų.
@pytest.fixture
def isolated_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session = sessionmaker(autocommit=False, autoflush=False, bind=engine)()
    try:
        yield session
    finally:
        session.close()


# Nuolaida privalo priklausyti tikram klientui, todėl testas paruošia jo įrašą.
@pytest.fixture
def sample_client(isolated_db):
    client_row = Client(
        vardas="Testas", pavarde="Testaitis", el_pastas="discountrace@example.com",
        telefono_nr="+37060000099", gimimo_data=date(1995, 1, 1), slaptazodis=None,
    )
    isolated_db.add(client_row)
    isolated_db.commit()
    return client_row.kliento_id


# PRIVERČIAME koliziją - "generate_unique_code" pirmą kartą grąžina kodą, kuris JAU egzistuoja DB (imituoja lygiagretų kvietimą, kuris "laimėjo" lenktynes PRIEŠ šį); issue_code turi TYLIAI bandyti iš naujo su KITU kodu, ne nulūžti su IntegrityError.
def test_issue_code_retries_on_collision(isolated_db, sample_client):
    real_generate = discount_code_service.generate_unique_code
    calls = {"n": 0}

    # Pirmas kodo sutapimas priverčia testą patikrinti tikrą pakartotinio bandymo kelią.
    def fake_generate(db):
        calls["n"] += 1
        if calls["n"] == 1:
            return "AUTORENT000111"
        return real_generate(db)

    isolated_db.add(DiscountCode(
        kodas="AUTORENT000111", kliento_id=sample_client, verte_eur=5.0, kilme="aptarnavimas",
    ))
    isolated_db.commit()

    with patch.object(discount_code_service, "generate_unique_code", side_effect=fake_generate):
        code = discount_code_service.issue_code(isolated_db, sample_client, 10.0, "aptarnavimas", "test")
        isolated_db.commit()

    assert calls["n"] >= 2
    assert code.kodas != "AUTORENT000111"
    assert code.kodo_id is not None
