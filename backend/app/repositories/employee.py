# DB užklausos Darbuotojai lentelei - naudoja IR employee.py (administravimas), IR auth.py (prisijungimas).
from sqlalchemy.orm import Session
from app.models.employee import Employee

# Naudojama PRISIJUNGIMUI (auth.py) ir dublikato patikrai kuriant naują darbuotoją (employee.py) - el. paštas yra UNIQUE, tad daugiausiai viena eilutė.
def get_by_email(db: Session, email: str):
    return db.query(Employee).filter(Employee.el_pastas == email).first()

# Priima ŽODYNĄ (ne EmployeeCreate) - endpoint'as (employee.py) pats paruošia duomenis RANKA PRIEŠ kviečiant (pakeičia tekstinį slaptažodį jo hash'u), tad čia tiesiog įrašoma, kas atsiųsta.
def create_employee(db: Session, data: dict):
    naujas = Employee(**data)
    db.add(naujas)
    db.commit()
    db.refresh(naujas)
    return naujas

def get_all(db: Session):
    return db.query(Employee).all()

# Dalinis atnaujinimas - "updates" žodynas turi TIK tuos laukus, kuriuos endpoint'as nusprendė leisti keisti (žr. employee.py ADMIN_ONLY_FIELDS patikrą PRIEŠ šį kvietimą).
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
