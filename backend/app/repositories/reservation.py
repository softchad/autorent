from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.reservation import Reservation
from app.schemas.reservation import ReservationCreate
from app.models.car import Car
from app.models.client import Client

# Tos pačios būsenos, kurios blokuoja automobilį, kaip ir užsakymuose (order.py) - "atšaukta" nebeblokuoja.
BLOKUOJANCIOS_BUSENOS = ["patvirtinta", "laukia"]


def get_all(db: Session):
    return db.query(Reservation).all()

def get_by_id(db: Session, rezervacijos_id: int):
    return db.query(Reservation).filter(Reservation.rezervacijos_id == rezervacijos_id).first()

# Naudojama client.py delete_client - patikrinti, ar klientas turi NEBAIGTŲ rezervacijų prieš leidžiant jį ištrinti/anonimizuoti.
def get_by_client_id(db: Session, kliento_id: int):
    return db.query(Reservation).filter(Reservation.kliento_id == kliento_id).all()

# Patikrina, ar automobilis JAU turi kitą AKTYVIĄ rezervaciją persidengiančiomis datomis - naudojama create/update_reservation endpoint'uose PRIEŠ įrašymą.
def find_conflict(
    db: Session,
    automobilio_id: int,
    rezervacijos_pradzia,
    rezervacijos_pabaiga,
    exclude_id: int = None,
):
    # Ta pati pusiau atviro intervalo taisyklė kaip užsakymuose: esamo.pradzia < naujo.pabaiga AND esamo.pabaiga > naujo.pradzia.
    query = db.query(Reservation).filter(
        Reservation.automobilio_id == automobilio_id,
        Reservation.busena.in_(BLOKUOJANCIOS_BUSENOS),
        Reservation.rezervacijos_pradzia < rezervacijos_pabaiga,
        Reservation.rezervacijos_pabaiga > rezervacijos_pradzia,
    )
    # exclude_id - naudojama REDAGUOJANT esamą rezervaciją, kad JI PATI nebūtų palaikyta "konfliktu" su savimi.
    if exclude_id is not None:
        query = query.filter(Reservation.rezervacijos_id != exclude_id)
    return query.first()

def create(db: Session, reservation: ReservationCreate):
    db_res = Reservation(**reservation.dict())
    db.add(db_res)
    db.commit()
    db.refresh(db_res)
    return db_res

def delete(db: Session, rezervacijos_id: int):
    db_res = get_by_id(db, rezervacijos_id)
    if db_res:
        db.delete(db_res)
        db.commit()
        return True
    return False

# Grąžina N naujausių rezervacijų KARTU su automobilio ir kliento info (JOIN) - naudojama darbuotojų dashboard'o endpoint'e, kad frontend'ui nereikėtų atskirai užklausti kiekvienos eilutės susijusių duomenų.
def get_latest_reservations_with_details(db: Session, limit: int = 5):
    return (
        db.query(
            Reservation.rezervacijos_id,
            Reservation.kliento_id,
            Reservation.automobilio_id,
            Reservation.rezervacijos_pradzia,
            Reservation.rezervacijos_pabaiga,
            Reservation.busena,
            Car.marke,
            Car.modelis,
            Client.vardas,
            Client.pavarde,
        )
        .join(Car, Reservation.automobilio_id == Car.automobilio_id)
        .join(Client, Reservation.kliento_id == Client.kliento_id)
        .order_by(desc(Reservation.rezervacijos_pradzia))
        .limit(limit)
        .all()
    )

