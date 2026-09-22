# Užsakymų CRUD endpointai - darbuotojų pusėje realiai sukuriamas/nuomojamas automobilis (ne tas pats, kas kliento SAVITARNOS rezervacija customer.py faile).
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import order as schemas
from app.repositories import order as repo
from app.services import availability_service  # availability_service.lock_car_row - naudojamas žemiau, prieš tikrinant laisvumą
from app.api.deps import get_current_user
from app.api.permissions import require_perm, Perm

router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
    dependencies=[Depends(get_current_user)]
)


# Paverčia DB objektą į atsakymo formatą ir prideda HATEOAS nuorodas (į susietą klientą/automobilį) - naudojama VISŲ 4 endpoint'ų grąžinamame atsakyme, kad formatas būtų vienodas.
def _order_out(order) -> dict:
    return {
        **order.__dict__,
        "links": [
            {"rel": "self", "href": f"/orders/{order.uzsakymo_id}"},
            {"rel": "client", "href": f"/clients/{order.kliento_id}"},
            {"rel": "car", "href": f"/cars/{order.automobilio_id}"},
            {"rel": "delete", "href": f"/orders/{order.uzsakymo_id}"},
        ],
    }

# Grąžina VISŲ užsakymų sąrašą - reikalauja bent VIEW teisės.
@router.get("/", response_model=list[schemas.OrderOut], operation_id="getAllOrders",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_all_orders(db: Session = Depends(get_db)):
    orders = repo.get_all(db)
    return [_order_out(order) for order in orders]

# Naujo užsakymo kūrimas - patikrina DVI persidengimo taisykles (tas pats automobilis, tas pats klientas) PRIEŠ įrašant, kad vienas automobilis nebūtų priskirtas dviem užsakymams tomis pačiomis dienomis, ir klientas negalėtų vienu metu nuomotis dviejų automobilių.
@router.post("/", response_model=schemas.OrderOut, operation_id="createOrder",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    # SELECT ... FOR UPDATE - užrakina automobilio eilutę, kad du vienu metu kuriami užsakymai dėl TO PATIES automobilio negalėtų abu pamatyti "laisva" prieš bet kuriam užsicommit'inant.
    availability_service.lock_car_row(db, order.automobilio_id)
    if repo.find_car_conflict(db, order.automobilio_id, order.nuomos_data, order.grazinimo_data):
        raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas arba išnuomotas tomis dienomis.")
    if repo.find_client_conflict(db, order.kliento_id, order.nuomos_data, order.grazinimo_data):
        raise HTTPException(status_code=409, detail="Klientas jau turi kitą rezervuotą automobilį tomis dienomis.")

    created = repo.create(db, order)
    return _order_out(created)

# Ištrina užsakymą - reikalauja ADMIN teisės, nes tai negrįžtamas veiksmas, ne tik būsenos pakeitimas (ta plačiau leidžiama update_order).
@router.delete("/{uzsakymo_id}", operation_id="deleteOrder",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_order(uzsakymo_id: int, db: Session = Depends(get_db)):
    success = repo.delete(db, uzsakymo_id)
    if not success:
        raise HTTPException(status_code=404, detail="Užsakymas nerastas")
    return {"ok": True}

# Redaguoja esamą užsakymą - TIK šie 3 laukai (būsena, grąžinimo data, papildomos paslaugos) keičiami per PUT; klientas/automobilis/kaina NEkeičiami, nes tai reikštų NAUJĄ užsakymą, ne redagavimą seno.
@router.put("/{uzsakymo_id}", response_model=schemas.OrderOut, operation_id="updateOrder",
            dependencies=[Depends(require_perm(Perm.EDIT))])
def update_order(uzsakymo_id: int, order_update: schemas.OrderUpdate, db: Session = Depends(get_db)):
    order = repo.get_by_id(db, uzsakymo_id)
    if not order:
        raise HTTPException(status_code=404, detail="Užsakymas nerastas")
    if order_update.uzsakymo_busena is not None:
        order.uzsakymo_busena = order_update.uzsakymo_busena
    if order_update.grazinimo_data is not None:
        # OrderUpdate schema NEGALI patikrinti "grazinimo_data > nuomos_data" pati (nuomos_data nėra jos lauko dalis, ji žinoma tik ČIA, ORM objekte) - tad patikra atliekama RANKA prieš priskyrimą.
        if order_update.grazinimo_data <= order.nuomos_data:
            raise HTTPException(status_code=400, detail="Grąžinimo data turi būti vėlesnė nei nuomos data")
        order.grazinimo_data = order_update.grazinimo_data
    if order_update.turi_papildomas_paslaugas is not None:
        order.turi_papildomas_paslaugas = order_update.turi_papildomas_paslaugas
    db.commit()
    db.refresh(order)
    return _order_out(order)
