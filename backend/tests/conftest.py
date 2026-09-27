import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = "sqlite:///./test_autorent.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite reikalauja šio parametro
)


# SQLite pagal nutylėjimą NEtikrina FK apribojimų (skirtingai nei tikra MySQL DB) - be šito testai praleistų realius FK konfliktus (pvz. trinant klientą su susijusiais užsakymais), kurie produkcijoje realiai įvyktų.
@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.db.base import Base
import app.models
from app.main import app
from app.rate_limit import limiter

# Testai per kelias sekundes daro gerokai daugiau /login kreipinių nei realus brute-force limitas (5/min) leistų - limiterį testų metu išjungiame, o ne kiekvieną testą derinam prie jo.
limiter.enabled = False


# Paleidžiama VIENĄ kartą visai testų sesijai (scope="session", autouse=True) - sukuria VISAS lenteles PRIEŠ pirmą testą ir išvalo PO paskutinio, kad sekantis paleidimas startuotų nuo tuščios DB.
@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


# VIENA transakcija VISAM testų moduliui (scope="module") - visi to paties failo testai DALIJASI ta pačia sesija/duomenimis, o "finally" rollback'as grąžina DB į pradinę būseną, kai modulio testai baigiasi.
@pytest.fixture(scope="module")
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


# Pakeičia tikrą get_db (žr. deps.py) testine db_session, kad endpoint'ai per TestClient naudotų TĄ PAČIĄ, modulio lygio sesiją, ne naują ryšį su realia MySQL baze.
@pytest.fixture(scope="module")
def client(db_session):
    from app.api.deps import get_db

    # SĄMONINGAI neuždaro ir neatšaukia sesijos po kiekvienos užklausos (skirtingai nuo tikro get_db deps.py) - tai padaro TIK db_session fixture'os "finally" aukščiau, kai baigiasi visas modulis.
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# Sukuria ADMIN darbuotoją tiesiai per DB sesiją ir grąžina Authorization antraštę testams - /register PATS reikalauja ADMIN teisės (žr. auth.py), tad pirmas admin negali būti sukurtas per API, kaip jį realioje sistemoje sukurtų seed.sql.
@pytest.fixture(scope="module")
def auth_headers(client, db_session):
    from datetime import date
    from app.models.employee import Employee
    from app.services.auth_service import get_password_hash

    email = "admin.cars@viko.lt"
    password = "Slaptas123!"

    existing = db_session.query(Employee).filter_by(el_pastas=email).first()
    if not existing:
        db_session.add(Employee(
            vardas="Admin",
            pavarde="Testuotojas",
            el_pastas=email,
            telefono_nr="+37060000000",
            pareigos="Administratorius",
            atlyginimas=1500,
            isidarbinimo_data=date(2024, 1, 1),
            slaptazodis=get_password_hash(password),
        ))
        db_session.commit()

    resp = client.post("/api/v1/login", json={"el_pastas": email, "slaptazodis": password})
    assert resp.status_code == 200, resp.text

    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
