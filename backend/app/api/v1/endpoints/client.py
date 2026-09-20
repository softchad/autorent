# Klientų CRUD endpointai - darbuotojų administravimo sąsajai (ne tas pats, kas kliento savitarna customer_auth.py faile).
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError  # klaida, kurią duomenų bazė meta, kai veiksmas atmetamas dėl susijusių įrašų arba UNIQUE pažeidimo (žr. create_client ir delete_client žemiau)
from app.api.deps import get_db
from app.schemas import client as schemas_client
from app.schemas import order as schemas_order  # reikalinga, nes get_client_orders žemiau grąžina KLIENTO užsakymus (Order formatu)

from app.repositories import client as repo
from app.repositories import order as order_repo  # DB užklausos Užsakymai lentelei - naudoja ir delete_client (aktyvių užsakymų patikra), ir get_client_orders žemiau
from app.repositories import reservation as reservation_repo  # naudojama delete_client žemiau - tikrinti AKTYVIAS rezervacijas
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
    clients = repo.get_all(db)
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
    client = repo.get_by_id(db, kliento_id)
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
        created = repo.create(db, client)
    except IntegrityError:
        # el_pastas yra UNIQUE DB lygmeniu - čia tą klaidą paverčiame suprantamu pranešimu, ne 500 serverio klaida.
        db.rollback()
        raise HTTPException(status_code=409, detail="Klientas su šiuo el. paštu jau užregistruotas.")
    return {
        **created.__dict__,
        "links": generate_links("clients", created.kliento_id, ["update", "delete"])
    }

# Ištrina klientą (ADMIN) - aktyvius užsakymus/rezervacijas atmeta su klaida, baigtus/atšauktus anonimizuoja (repo.anonymize), kitaip ištrina pilnai.
@router.delete("/{kliento_id}", operation_id="deleteClient",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_client(kliento_id: int, db: Session = Depends(get_db)):
    unfinished_orders = [
        o for o in order_repo.get_by_client_id(db, kliento_id)
        if o.uzsakymo_busena in UNFINISHED_ORDER_STATUSES
    ]
    if unfinished_orders:
        ids = ", ".join(f"#{o.uzsakymo_id}" for o in unfinished_orders)
        raise HTTPException(
            status_code=409,
            detail=f"Kliento ištrinti negalima - yra aktyvių (nebaigtų) užsakymų: {ids}. Pirmiausia užbaikite arba atšaukite šiuos užsakymus.",
        )

    # Jei užsakymų patikra aukščiau nesustabdė - tikrinam LYGIAI TĄ PATĮ dalyką rezervacijoms.
    unfinished_reservations = [
        r for r in reservation_repo.get_by_client_id(db, kliento_id)
        if r.busena in reservation_repo.BLOKUOJANCIOS_BUSENOS
    ]
    if unfinished_reservations:
        ids = ", ".join(f"#{r.rezervacijos_id}" for r in unfinished_reservations)
        raise HTTPException(
            status_code=409,
            detail=f"Kliento ištrinti negalima - yra aktyvių rezervacijų: {ids}. Pirmiausia jas atšaukite arba palaukite, kol baigsis.",
        )

    # Nei aktyvių užsakymų, nei rezervacijų nėra - dabar saugu bandyti ištrinti (arba anonimizuoti, jei DB to neleidžia).
    try:
        success = repo.delete(db, kliento_id)
    except IntegrityError:
        db.rollback()
        anonymized_client = repo.anonymize(db, kliento_id)
        if not anonymized_client:
            raise HTTPException(status_code=404, detail="Klientas nerastas")
        return {"ok": True, "anonymized": True}
    if not success:
        raise HTTPException(status_code=404, detail="Klientas nerastas")
    return {"ok": True, "anonymized": False}

# Grąžina kliento užsakymų sąrašą - dalis standartinio REST rašto, šiuo metu frontend'e niekur nebekviečiamas.
@router.get("/{kliento_id}/orders", response_model=list[schemas_order.OrderOut],
            operation_id="getClientOrder", dependencies=[Depends(require_perm(Perm.VIEW))])
def get_client_orders(kliento_id: int, db: Session = Depends(get_db)):
    orders = order_repo.get_by_client_id(db, kliento_id)
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
