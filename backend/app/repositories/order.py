from sqlalchemy.orm import Session
from app.models.order import Order
from app.schemas.order import OrderCreate

# Tik ŠIOS būsenos realiai blokuoja automobilį/klientą - atšauktas ar užbaigtas užsakymas laisvų dienų NEbeužima.
AKTYVIOS_BUSENOS = ["patvirtinta", "vykdoma"]


def get_all(db: Session):
    return db.query(Order).all()


# Patikrina, ar automobilis JAU turi kitą AKTYVŲ užsakymą persidengiančiomis datomis - naudojama create_order endpoint'e PRIEŠ įrašymą.
def find_car_conflict(db: Session, automobilio_id: int, nuomos_data, grazinimo_data):
    # Pusiau atviras intervalas: esamo.pradzia < naujo.pabaiga AND esamo.pabaiga > naujo.pradzia.
    return db.query(Order).filter(
        Order.automobilio_id == automobilio_id,
        Order.uzsakymo_busena.in_(AKTYVIOS_BUSENOS),
        Order.nuomos_data < grazinimo_data,
        Order.grazinimo_data > nuomos_data,
    ).first()


# Patikrina, ar KLIENTAS jau turi kitą AKTYVŲ užsakymą (KITAM automobiliui) persidengiančiomis datomis - klientas negali vienu metu nuomotis dviejų automobilių.
def find_client_conflict(db: Session, kliento_id: int, nuomos_data, grazinimo_data):
    return db.query(Order).filter(
        Order.kliento_id == kliento_id,
        Order.uzsakymo_busena.in_(AKTYVIOS_BUSENOS),
        Order.nuomos_data < grazinimo_data,
        Order.grazinimo_data > nuomos_data,
    ).first()


def get_by_id(db: Session, uzsakymo_id: int):
    return db.query(Order).filter(Order.uzsakymo_id == uzsakymo_id).first()


# Naudojama client.py delete_client - patikrinti, ar klientas turi NEBAIGTŲ užsakymų prieš leidžiant jį ištrinti/anonimizuoti.
def get_by_client_id(db: Session, kliento_id: int):
    return db.query(Order).filter(Order.kliento_id == kliento_id).all()


def create(db: Session, order: OrderCreate):
    db_order = Order(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order


def delete(db: Session, uzsakymo_id: int):
    order = get_by_id(db, uzsakymo_id)
    if order:
        db.delete(order)
        db.commit()
        return True
    return False


