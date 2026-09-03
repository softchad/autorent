from sqlalchemy.orm import Session
from app.models.client import Client
from app.schemas.client import ClientCreate


def get_all(db: Session):
    return db.query(Client).all()


def get_by_id(db: Session, kliento_id: int):
    return db.query(Client).filter(Client.kliento_id == kliento_id).first()


def get_by_email(db: Session, email: str):
    return db.query(Client).filter(Client.el_pastas == email).first()


def create_customer(db: Session, data: dict):
    db_client = Client(**data)
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


def create(db: Session, client: ClientCreate):
    db_client = Client(**client.dict())
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


def delete(db: Session, kliento_id: int):
    db_client = get_by_id(db, kliento_id)
    if db_client:
        db.delete(db_client)
        db.commit()
        return True
    return False
