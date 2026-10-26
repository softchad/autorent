# Klientų CRUD endpointai - darbuotojų administravimo sąsajai (ne tas pats, kas kliento savitarna customer_auth.py faile).
import random
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError  # klaida, kurią duomenų bazė meta, kai veiksmas atmetamas dėl susijusių įrašų arba UNIQUE pažeidimo (žr. create_client ir delete_client žemiau)
from app.api.deps import get_db
from app.schemas import client as schemas_client
from app.schemas import order as schemas_order  # reikalinga, nes get_client_orders žemiau grąžina KLIENTO užsakymus (Order formatu)
from app.models.client import Client
from app.models.order import Order
from app.models.reservation import Reservation
from app.services import availability_service  # availability_service.BLOCKING_RESERVATION_STATUSES - naudojama žemiau tikrinti, ar klientas turi AKTYVIŲ rezervacijų prieš leidžiant jį ištrinti (ta pati reikšmė, kaip order.py/reservation.py naudoja booking'o konfliktams, kad niekada neišsiskirtų)
from utils.hateoas import generate_links
from app.api.deps import get_current_user

# require_perm - "visas arba nieko" sargas prieš VISĄ endpoint'ą (dependencies=[...] žemiau).
from app.api.permissions import require_perm, Perm

router = APIRouter(
    prefix="/clients",
    dependencies=[Depends(get_current_user)]
)

# Tokias būsenas turintis užsakymas yra NEBAIGTAS - jo klientą ištrinti/anonimizuoti negalima (žr. delete_client žemiau).
UNFINISHED_ORDER_STATUSES = ["laukiama", "patvirtinta", "vykdoma"]

# Grąžina VISŲ klientų sąrašą - reikalauja bent VIEW teisės.
@router.get("/", response_model=list[schemas_client.ClientOut], operation_id="getAllClients",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_all_clients(db: Session = Depends(get_db)):
    clients = db.query(Client).all()
    return [
        {
            **client.__dict__,
            "links": generate_links("clients", client.kliento_id, ["update", "delete"])
        }
        for client in clients
    ]

# Redaguoja esamą klientą - keičiami TIK TIE laukai, kurie realiai buvo atsiųsti užklausoje (exclude_unset=True), kiti lieka nepakitę.
@router.put(
    "/{kliento_id}",
    response_model=schemas_client.ClientOut,
    operation_id="updateClient",
    dependencies=[Depends(require_perm(Perm.EDIT))]
)
def update_client(
    kliento_id: int,
    client_update: schemas_client.ClientUpdate,
    db: Session = Depends(get_db),
):
    client = db.query(Client).filter(Client.kliento_id == kliento_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Klientas nerastas")
    # Jei funkcija tęsiasi iki čia - klientas tikrai rastas, "client" žemiau saugu naudoti.
    updates = client_update.dict(exclude_unset=True)
    for field, value in updates.items():
        setattr(client, field, value)

    try:
        db.commit()
    except IntegrityError:
        # Tas pats UNIQUE apribojimas kaip create_client aukščiau - galima, jei keičiamas el_pastas į jau užimtą.
        db.rollback()
        raise HTTPException(status_code=409, detail="Klientas su šiuo el. paštu jau užregistruotas.")
    db.refresh(client)

    return {
        **client.__dict__,
        "links": generate_links("clients", client.kliento_id, ["update", "delete"]),
    }

# Sukuria naują klientą - reikalauja EDIT teisės.
@router.post("/", response_model=schemas_client.ClientOut, operation_id="createClient",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_client(client: schemas_client.ClientCreate, db: Session = Depends(get_db)):
    try:
        # "exclude_unset=True" - ClientCreate.registracijos_data turi numatytąją reikšmę None (žr. schemas/client.py); be šito "client.dict()" VISADA grąžintų "registracijos_data": None EXPLICITINIAI (net kai iškvietėjas jo visai neatsiuntė), o Client modelio "default=datetime.utcnow" veikia TIK kai atributas NIEKADA nepriskirtas - explicitinis None jį PERRAŠYTŲ, tad registracijos_data visada liktų NULL.
        created = Client(**client.dict(exclude_unset=True))
        db.add(created)
        db.commit()
        db.refresh(created)
    except IntegrityError:
        # el_pastas yra UNIQUE DB lygmeniu - čia tą klaidą paverčiame suprantamu pranešimu, ne 500 serverio klaida.
        db.rollback()
        raise HTTPException(status_code=409, detail="Klientas su šiuo el. paštu jau užregistruotas.")
    return {
        **created.__dict__,
        "links": generate_links("clients", created.kliento_id, ["update", "delete"])
    }

# Pakeičia kliento ASMENINIUS duomenis neatsekamomis reikšmėmis, PALIEKANT pačią eilutę (kliento_id) nepakeistą - naudojama, kai kliento ištrinti NEGALIMA (su juo susiję užsakymai/rezervacijos/pokalbiai), bet "teisė būti pamirštam" vis tiek turi būti įgyvendinta: po šito niekas nebegali susekti, kuriam realiam asmeniui šie įrašai priklausė, bet pačios susijusios eilutės (nuomos istorija) nenukenčia.
def _anonymize_client(db: Session, kliento_id: int) -> Client | None:
    db_client = db.query(Client).filter(Client.kliento_id == kliento_id).first()
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

# Ištrina klientą (ADMIN) - aktyvius užsakymus/rezervacijas atmeta su klaida, baigtus/atšauktus anonimizuoja (žr. _anonymize_client aukščiau), kitaip ištrina pilnai.
@router.delete("/{kliento_id}", operation_id="deleteClient",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_client(kliento_id: int, db: Session = Depends(get_db)):
    unfinished_orders = (
        db.query(Order)
        .filter(Order.kliento_id == kliento_id, Order.uzsakymo_busena.in_(UNFINISHED_ORDER_STATUSES))
        .all()
    )
    if unfinished_orders:
        ids = ", ".join(f"#{o.uzsakymo_id}" for o in unfinished_orders)
        raise HTTPException(
            status_code=409,
            detail=f"Kliento ištrinti negalima - yra aktyvių (nebaigtų) užsakymų: {ids}. Pirmiausia užbaikite arba atšaukite šiuos užsakymus.",
        )

    # Jei užsakymų patikra aukščiau nesustabdė - tikrinam LYGIAI TĄ PATĮ dalyką rezervacijoms.
    unfinished_reservations = (
        db.query(Reservation)
        .filter(Reservation.kliento_id == kliento_id, Reservation.busena.in_(availability_service.BLOCKING_RESERVATION_STATUSES))
        .all()
    )
    if unfinished_reservations:
        ids = ", ".join(f"#{r.rezervacijos_id}" for r in unfinished_reservations)
        raise HTTPException(
            status_code=409,
            detail=f"Kliento ištrinti negalima - yra aktyvių rezervacijų: {ids}. Pirmiausia jas atšaukite arba palaukite, kol baigsis.",
        )

    # Nei aktyvių užsakymų, nei rezervacijų nėra - dabar saugu bandyti ištrinti (arba anonimizuoti, jei DB to neleidžia).
    client = db.query(Client).filter(Client.kliento_id == kliento_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Klientas nerastas")
    try:
        db.delete(client)
        db.commit()
    except IntegrityError:
        db.rollback()
        anonymized_client = _anonymize_client(db, kliento_id)
        if not anonymized_client:
            raise HTTPException(status_code=404, detail="Klientas nerastas")
        return {"ok": True, "anonymized": True}
    return {"ok": True, "anonymized": False}

# Grąžina kliento užsakymų sąrašą - dalis standartinio REST rašto, šiuo metu frontend'e niekur nebekviečiamas.
@router.get("/{kliento_id}/orders", response_model=list[schemas_order.OrderOut],
            operation_id="getClientOrder", dependencies=[Depends(require_perm(Perm.VIEW))])
def get_client_orders(kliento_id: int, db: Session = Depends(get_db)):
    orders = db.query(Order).filter(Order.kliento_id == kliento_id).all()
    return [
        {
            **order.__dict__,
            "links": [
                {"rel": "self", "href": f"/orders/{order.uzsakymo_id}"},
                {"rel": "car", "href": f"/cars/{order.automobilio_id}"},
                {"rel": "delete", "href": f"/orders/{order.uzsakymo_id}"}
            ]
        }
        for order in orders
    ]
