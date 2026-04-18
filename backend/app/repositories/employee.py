from sqlalchemy.orm import Session
from app.models.employee import Employee

def get_by_email(db: Session, email: str):
    return db.query(Employee).filter(Employee.el_pastas == email).first()

def get_by_id(db: Session, darbuotojo_id: int):
    return db.query(Employee).filter(Employee.darbuotojo_id == darbuotojo_id).first()

def create_employee(db: Session, data: dict):
    naujas = Employee(**data)
    db.add(naujas)
    db.commit()
    db.refresh(naujas)
    return naujas

def get_all(db: Session):
    return db.query(Employee).all()

def update(db: Session, darbuotojo_id: int, updates: dict):
    employee = db.query(Employee).filter(Employee.darbuotojo_id == darbuotojo_id).first()
    if not employee:
        return None
    for key, value in updates.items():
        setattr(employee, key, value)
    db.commit()
    db.refresh(employee)
    return employee

def delete(db: Session, darbuotojo_id: int):
    employee = db.query(Employee).filter(Employee.darbuotojo_id == darbuotojo_id).first()
    if not employee:
        return False
    db.delete(employee)
    db.commit()
    return True
