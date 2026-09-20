# DB užklausos Klientai lentelei - naudoja IR darbuotojų administravimo client.py, IR kliento savitarnos customer_auth.py/auth.py (OAuth).
import random
from datetime import date
from sqlalchemy.orm import Session
from app.models.client import Client
from app.schemas.client import ClientCreate


def get_all(db: Session):
    return db.query(Client).all()


def get_by_id(db: Session, kliento_id: int):
    return db.query(Client).filter(Client.kliento_id == kliento_id).first()


def get_by_email(db: Session, email: str):
    return db.query(Client).filter(Client.el_pastas == email).first()


# Priima ŽODYNĄ (ne ClientCreate) - naudojama kliento SAVIREGISTRACIJAI (customer_auth.py) ir Google OAuth (auth.py), kur reikšmės (pvz. užšifruotas slaptažodis, ar iš Google gauti laukai) paruošiamos RANKA PRIEŠ kviečiant, ne per pilną admin'o ClientCreate schemą.
def create_customer(db: Session, data: dict):
    db_client = Client(**data)
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


# Priima ClientCreate (ne žodyną) - naudojama TIK darbuotojų administravimo client.py, kuri klientą kuria per pilną, validuotą formą.
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


# Pakeičia kliento ASMENINIUS duomenis neatsekamomis reikšmėmis, PALIEKANT pačią eilutę (kliento_id) nepakeistą - naudojama, kai kliento ištrinti NEGALIMA (su juo susiję užsakymai/rezervacijos/pokalbiai), bet BDAR "teisė būti pamirštam" vis tiek turi būti įgyvendinta: po šito niekas nebegali susekti, kuriam realiam asmeniui šie įrašai priklausė, bet pačios susijusios eilutės (nuomos istorija) nenukenčia.
def anonymize(db: Session, kliento_id: int):
    db_client = get_by_id(db, kliento_id)
    if not db_client:
        return None

    db_client.vardas = "Pašalintas"
    db_client.pavarde = "Klientas"
    # El. paštas TURI būti unikalus ir atitikti DB CHECK šabloną (žr. database/schema.sql) - kliento_id pridėjimas garantuoja unikalumą be jokios papildomos patikros.
    db_client.el_pastas = f"pasalinta.{kliento_id}@pasalinta.autorent.lt"
    db_client.telefono_nr = "+00000000000"
    # Atsitiktinė, akivaizdžiai ne tikra data (1900-1950) - niekaip neatsekama iki realaus gimtadienio.
    db_client.gimimo_data = date(random.randint(1900, 1950), random.randint(1, 12), random.randint(1, 28))
    db_client.slaptazodis = None

    db.commit()
    db.refresh(db_client)
    return db_client
