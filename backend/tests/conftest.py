import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = "sqlite:///./test_autorent.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},  # SQLite reikalauja šio parametro
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.db.base import Base
import app.models
from app.main import app


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


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


@pytest.fixture(scope="module")
def client(db_session):
    from app.api.deps import get_db

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="module")
def auth_headers(client, db_session):
    """Sukuria admin darbuotoją tiesiai per DB sesiją ir grąžina Authorization header.

    /register dabar reikalauja ADMIN teisės (žr. auth.py), todėl pirmas admin
    testams sukuriamas tiesiogiai, taip kaip realioje sistemoje jį sukurtų seed.sql.
    """
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
            pareigos="Admin",
            atlyginimas=1500,
            isidarbinimo_data=date(2024, 1, 1),
            slaptazodis=get_password_hash(password),
        ))
        db_session.commit()

    resp = client.post("/api/v1/login", json={"el_pastas": email, "slaptazodis": password})
    assert resp.status_code == 200, resp.text

    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
