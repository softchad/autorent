from sqlalchemy.orm import Session
from app.models.client_support import ClientSupport
from app.schemas.client_support import ClientSupportCreate, ClientSupportUpdate
from datetime import datetime

def create_support_request(db: Session, support_data: ClientSupportCreate):
    data = support_data.dict()
    data.pop("pateikimo_data", None)
    db_support = ClientSupport(
        **data,
        pateikimo_data=datetime.utcnow()
    )
    db.add(db_support)
    db.commit()
    db.refresh(db_support)
    return db_support

def get_all_support_requests(db: Session):
    return db.query(ClientSupport).all()

def get_support_request_by_id(db: Session, uzklausos_id: int):
    return db.query(ClientSupport).filter_by(uzklausos_id=uzklausos_id).first()

def update_support_request(db: Session, uzklausos_id: int, data: ClientSupportUpdate):
    support = db.query(ClientSupport).filter(ClientSupport.uzklausos_id == uzklausos_id).first()
    if not support:
        return None
    for key, value in data.dict(exclude_unset=True).items():
        setattr(support, key, value)
    db.commit()
    db.refresh(support)
    return support

def get_unanswered_requests(db: Session):
    return db.query(ClientSupport).filter(ClientSupport.atsakymas == None).all()
