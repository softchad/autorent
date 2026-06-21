from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.models.order import Order
from app.schemas.order import OrderCreate

AKTYVIOS_BUSENOS = ["patvirtinta", "vykdoma"]


def get_all(db: Session):
    return db.query(Order).all()


def find_car_conflict(db: Session, automobilio_id: int, nuomos_data, grazinimo_data):
    return db.query(Order).filter(
        Order.automobilio_id == automobilio_id,
        Order.uzsakymo_busena.in_(AKTYVIOS_BUSENOS),
        or_(
            Order.nuomos_data.between(nuomos_data, grazinimo_data),
            Order.grazinimo_data.between(nuomos_data, grazinimo_data),
        ),
    ).first()


def find_client_conflict(db: Session, kliento_id: int, nuomos_data, grazinimo_data):
    return db.query(Order).filter(
        Order.kliento_id == kliento_id,
        Order.uzsakymo_busena.in_(AKTYVIOS_BUSENOS),
        or_(
            Order.nuomos_data.between(nuomos_data, grazinimo_data),
            Order.grazinimo_data.between(nuomos_data, grazinimo_data),
        ),
    ).first()


def get_by_id(db: Session, uzsakymo_id: int):
    return db.query(Order).filter(Order.uzsakymo_id == uzsakymo_id).first()


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


def get_order_counts_by_status(db: Session):
    results = (
        db.query(Order.uzsakymo_busena, func.count().label("value"))
        .group_by(Order.uzsakymo_busena)
        .all()
    )

    status_map = {
        "vykdomas": "Vykdomi",
        "užbaigtas": "Užbaigti",
        "atšauktas": "Atšaukti"
    }

    return [
        {"name": status_map.get(busena, busena), "value": count}
        for busena, count in results
    ]
