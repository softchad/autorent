# Užsakymų CRUD endpointai - darbuotojų pusėje realiai sukuriamas/nuomojamas automobilis (ne tas pats, kas kliento SAVITARNOS rezervacija customer.py faile).
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import order as schemas
from app.models.order import Order
from app.services import availability_service, discount_code_service  # availability_service.lock_car_row - naudojamas žemiau, prieš tikrinant laisvumą
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
    orders = db.query(Order).all()
    return [_order_out(order) for order in orders]

# Naujo užsakymo kūrimas - patikrina DVI persidengimo taisykles (tas pats automobilis - ir Uzsakymai, IR Rezervavimas lentelėse, tas pats klientas) PRIEŠ įrašant, kad vienas automobilis nebūtų priskirtas dviem užsakymams/rezervacijoms tomis pačiomis dienomis, ir klientas negalėtų vienu metu nuomotis dviejų automobilių.
@router.post("/", response_model=schemas.OrderOut, operation_id="createOrder",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    # SELECT ... FOR UPDATE - užrakina automobilio eilutę, kad du vienu metu kuriami užsakymai/rezervacijos dėl TO PATIES automobilio negalėtų abu pamatyti "laisva" prieš bet kuriam užsicommit'inant.
    availability_service.lock_car_row(db, order.automobilio_id)
    # "atšaukta" būsena pati savaime negali konfliktuoti su kuo nors (VALID_BUSENA leidžia kurti užsakymą TIESIAI šia būsena, pvz. istoriniam įrašui) - lygiai ta pati išimtis kaip reservation.py create_reservation.
    if order.uzsakymo_busena != "atšaukta" and availability_service.car_has_conflict(
        db, order.automobilio_id, order.nuomos_data, order.grazinimo_data
    ):
        raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas arba išnuomotas tomis dienomis.")
    client_conflict = db.query(Order).filter(
        Order.kliento_id == order.kliento_id,
        Order.uzsakymo_busena.in_(availability_service.BLOCKING_ORDER_STATUSES),
        Order.nuomos_data < order.grazinimo_data,
        Order.grazinimo_data > order.nuomos_data,
    ).first()
    if client_conflict:
        raise HTTPException(status_code=409, detail="Klientas jau turi kitą rezervuotą automobilį tomis dienomis.")

    # "nuolaidos_kodas" PASIRENKAMAS - jei nurodytas, kodas PRIVALO priklausyti TAM kliento_id (ne bet kuriam) ir būti dar nepanaudotas; verte_eur atimama iš bendra_kaina (apatinė riba 0, kad nuolaida netaptų priedu). "code.panaudojimo_data" priskiriama ČIA, bet COMMIT'inama TIK KARTU su naujo užsakymo įrašymu žemiau (viena transakcija) - jei Order įrašymas nepavyktų, kodo panaudojimas automatiškai atšaukiamas KARTU su juo, ne lieka sunaudotas be jokio užsakymo.
    if order.nuolaidos_kodas:
        code = discount_code_service.find_valid_code(db, order.nuolaidos_kodas, order.kliento_id)
        if not code:
            raise HTTPException(status_code=400, detail="Nuolaidos kodas negalioja arba jau panaudotas.")
        order.bendra_kaina = max(0.0, float(order.bendra_kaina) - float(code.verte_eur))
        code.panaudojimo_data = datetime.now(timezone.utc)

    # "exclude={"nuolaidos_kodas"}" - tas laukas egzistuoja TIK OrderCreate schemoje (nuolaidos panaudojimo nurodymui), Uzsakymai lentelė/Order modelis tokio stulpelio NETURI, tad Order(**order.dict()) kitaip mestų klaidą dėl nežinomo argumento.
    created = Order(**order.dict(exclude={"nuolaidos_kodas"}))
    db.add(created)
    db.commit()
    db.refresh(created)
    return _order_out(created)

# Ištrina užsakymą - reikalauja ADMIN teisės, nes tai negrįžtamas veiksmas, ne tik būsenos pakeitimas (ta plačiau leidžiama update_order).
@router.delete("/{uzsakymo_id}", operation_id="deleteOrder",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_order(uzsakymo_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.uzsakymo_id == uzsakymo_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Užsakymas nerastas")
    db.delete(order)
    db.commit()
    return {"ok": True}

# Redaguoja esamą užsakymą - TIK šie 3 laukai (būsena, grąžinimo data, papildomos paslaugos) keičiami per PUT; klientas/automobilis/kaina NEkeičiami, nes tai reikštų NAUJĄ užsakymą, ne redagavimą seno.
@router.put("/{uzsakymo_id}", response_model=schemas.OrderOut, operation_id="updateOrder",
            dependencies=[Depends(require_perm(Perm.EDIT))])
def update_order(uzsakymo_id: int, order_update: schemas.OrderUpdate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.uzsakymo_id == uzsakymo_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Užsakymas nerastas")

    # Galutinė (po pakeitimo) būsena/data - patikros žemiau turi vertinti GALUTINĘ reikšmę, ne tik tai, kas realiai buvo atsiųsta užklausoje.
    busena = order_update.uzsakymo_busena if order_update.uzsakymo_busena is not None else order.uzsakymo_busena
    grazinimo_data = order.grazinimo_data
    if order_update.grazinimo_data is not None:
        # OrderUpdate schema NEGALI patikrinti "grazinimo_data > nuomos_data" pati (nuomos_data nėra jos lauko dalis, ji žinoma tik ČIA, ORM objekte) - tad patikra atliekama RANKA prieš priskyrimą.
        if order_update.grazinimo_data <= order.nuomos_data:
            raise HTTPException(status_code=400, detail="Grąžinimo data turi būti vėlesnė nei nuomos data")
        grazinimo_data = order_update.grazinimo_data

    # Persidengimo PATIKRA ČIA PAT - be jos užsakymas galėtų būti perjungtas į aktyvią būseną arba pratęstas datomis, kurios dabar susidengia su kitu automobilio booking'u, ir tai NIEKADA nebūtų pagauta (skirtingai nei create_order aukščiau).
    availability_service.lock_car_row(db, order.automobilio_id)
    if busena != "atšaukta" and availability_service.car_has_conflict(
        db, order.automobilio_id, order.nuomos_data, grazinimo_data, exclude_order_id=order.uzsakymo_id
    ):
        raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas arba išnuomotas tomis dienomis.")

    order.uzsakymo_busena = busena
    order.grazinimo_data = grazinimo_data
    if order_update.turi_papildomas_paslaugas is not None:
        order.turi_papildomas_paslaugas = order_update.turi_papildomas_paslaugas
    db.commit()
    db.refresh(order)
    return _order_out(order)
