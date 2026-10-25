# Užsakymų CRUD endpointai - darbuotojų pusėje realiai sukuriamas/nuomojamas automobilis (ne tas pats, kas kliento SAVITARNOS rezervacija customer.py faile).
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import order as schemas
from app.models.order import Order
from app.models.employee import Employee
from app.models.location import Location
from app.models.reservation import Reservation
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
    # SELECT ... FOR UPDATE - užrakina automobilio IR kliento eilutes, kad du vienu metu kuriami užsakymai/rezervacijos dėl TO PATIES automobilio ARBA TO PATIES kliento (skirtingais automobiliais) negalėtų abu pamatyti "laisva" prieš bet kuriam užsicommit'inant.
    car = availability_service.lock_car_row(db, order.automobilio_id)
    if not car:
        raise HTTPException(status_code=404, detail="Automobilis nerastas")
    if not availability_service.lock_client_row(db, order.kliento_id):
        raise HTTPException(status_code=404, detail="Klientas nerastas")
    # Be šių patikrų neegzistuojantis darbuotojo_id/vietos_id praeitų iki db.commit() ir lūžtų kaip neaiškus 500 (FK apribojimo IntegrityError), ne aiškus 404 - lygiai ta pati logika, kaip car/client patikros aukščiau.
    if not db.query(Employee).filter(Employee.darbuotojo_id == order.darbuotojo_id).first():
        raise HTTPException(status_code=404, detail="Darbuotojas nerastas")
    if not db.query(Location).filter(Location.vietos_id == order.paemimo_vietos_id).first():
        raise HTTPException(status_code=404, detail="Paėmimo vieta nerasta")
    if not db.query(Location).filter(Location.vietos_id == order.grazinimo_vietos_id).first():
        raise HTTPException(status_code=404, detail="Grąžinimo vieta nerasta")
    # "paemimo_vietos_id" PRIVALO sutapti su JAU UŽRAKINTO (lock_car_row aukščiau) automobilio DABARTINE vieta - be šios patikros kažkas gali pateikti PASENUSĮ (kito darbuotojo tarpe pakeistą) paėmimo adresą, ir jis PRAEITŲ vien todėl, kad TOKIA vieta egzistuoja apskritai (žr. patikrą aukščiau), nepriklausomai nuo to, ar automobilis TEN realiai yra. Atmetame su 409 (ne tyliai pataisome), kad darbuotojas IŠ NAUJO patvirtintų teisingą adresą, ne nepastebėtų tylaus pakeitimo.
    if car.dabartine_vieta_id != order.paemimo_vietos_id and order.uzsakymo_busena != "atšaukta":
        raise HTTPException(status_code=409, detail="Automobilis šiuo metu yra kitoje vietoje - atnaujinkite paėmimo vietą.")

    # "rezervacijos_id" PASIRENKAMAS - PAVERČIA konkrečią rezervaciją realia nuoma (žr. schemas/order.py komentarą). Užrakinama ČIA PAT (dar PRIEŠ konflikto patikras žemiau), kad rezervacija NEBŪTŲ "exclude'inta" iš patikros, jei ji realiai priklauso KITAM klientui/automobiliui, nei šis kuriamas užsakymas - tai apsaugotų nuo klaidingo susiejimo, kuris tyliai "atrakintų" SVETIMos rezervacijos blokuojamas datas.
    converting_reservation = None
    if order.rezervacijos_id is not None:
        converting_reservation = (
            db.query(Reservation).filter(Reservation.rezervacijos_id == order.rezervacijos_id).with_for_update().first()
        )
        if not converting_reservation:
            raise HTTPException(status_code=404, detail="Rezervacija nerasta")
        if converting_reservation.kliento_id != order.kliento_id or converting_reservation.automobilio_id != order.automobilio_id:
            raise HTTPException(status_code=400, detail="Rezervacija priklauso kitam klientui arba automobiliui.")
        if converting_reservation.busena != "patvirtinta":
            raise HTTPException(status_code=409, detail="Konvertuoti galima tik patvirtintą, dar neįvykdytą rezervaciją.")
        if order.uzsakymo_busena not in {"patvirtinta", "vykdoma"}:
            raise HTTPException(status_code=400, detail="Rezervaciją turi pakeisti aktyvus užsakymas.")
        if (order.nuomos_data != converting_reservation.rezervacijos_pradzia
                or order.grazinimo_data != converting_reservation.rezervacijos_pabaiga):
            raise HTTPException(status_code=400, detail="Užsakymo datos turi sutapti su rezervacija.")
        rate = converting_reservation.kaina_parai
        if rate is not None:
            order.bendra_kaina = round(float(rate) * (order.grazinimo_data - order.nuomos_data).days, 2)

    # Automobilio fizinė būsena tikrinama nepriklausomai nuo datų: servise ar remonte esantis automobilis nerezervuojamas ir neišnuomojamas; tas pats ribojimas taikomas klientų savitarnos API.
    if car and car.automobilio_statusas in availability_service.NOT_BOOKABLE_STATUSES and order.uzsakymo_busena != "atšaukta":
        raise HTTPException(status_code=409, detail="Šis automobilis šiuo metu neišnuomojamas (servise/remonte).")
    # Atšauktas užsakymas neužima laikotarpio; availability_service automobilio ir kliento konfliktai tikrinami tik kitoms būsenoms.
    # "atšaukta" būsena pati savaime negali konfliktuoti su kuo nors - IŠIMTIS taikoma ABIEM patikroms žemiau (automobilio IR kliento), ne tik automobilio, nes atšauktas užsakymas negali "užimti" nei automobilio, nei kliento.
    if order.uzsakymo_busena != "atšaukta":
        # Konvertuojamos rezervacijos ID perduodamas availability_service konflikto patikroms kaip išimtis, kad ji netrukdytų sukurti jos pačios nuomos užsakymo.
        exclude_res_id = converting_reservation.rezervacijos_id if converting_reservation else None
        if availability_service.car_has_conflict(
            db, order.automobilio_id, order.nuomos_data, order.grazinimo_data, exclude_reservation_id=exclude_res_id
        ):
            raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas arba išnuomotas tomis dienomis.")
        if availability_service.client_has_conflict(
            db, order.kliento_id, order.nuomos_data, order.grazinimo_data, exclude_reservation_id=exclude_res_id
        ):
            raise HTTPException(status_code=409, detail="Klientas jau turi kitą rezervuotą automobilį tomis dienomis.")

    # "nuolaidos_kodas" PASIRENKAMAS - jei nurodytas, kodas PRIVALO priklausyti TAM kliento_id (ne bet kuriam) ir būti dar nepanaudotas; verte_eur atimama iš bendra_kaina (apatinė riba 0, kad nuolaida netaptų priedu). "code.panaudojimo_data" priskiriama ČIA, bet COMMIT'inama TIK KARTU su naujo užsakymo įrašymu žemiau (viena transakcija) - jei Order įrašymas nepavyktų, kodo panaudojimas automatiškai atšaukiamas KARTU su juo, ne lieka sunaudotas be jokio užsakymo.
    # Nuolaidos kodas sunaudojamas tik ne atšauktam užsakymui: atšauktas įrašas nesuteikia aktyvios nuomos, todėl klientas išlaiko teisę panaudoti kodą.
    taikyta_nuolaida_eur = 0.0
    base_rate = Decimal(str(order.bendra_kaina)) / Decimal(max(1, (order.grazinimo_data - order.nuomos_data).days))
    if order.nuolaidos_kodas and order.uzsakymo_busena != "atšaukta":
        code = discount_code_service.find_valid_code(db, order.nuolaidos_kodas, order.kliento_id)
        if not code:
            raise HTTPException(status_code=400, detail="Nuolaidos kodas negalioja arba jau panaudotas.")
        taikyta_nuolaida_eur = float(code.verte_eur)
        order.bendra_kaina = max(0.0, float(order.bendra_kaina) - taikyta_nuolaida_eur)
        code.panaudojimo_data = datetime.now(timezone.utc)

    # "exclude={"nuolaidos_kodas", "rezervacijos_id"}" - ABU šie laukai egzistuoja TIK OrderCreate schemoje (vienkartiniai nurodymai), Uzsakymai lentelė/Order modelis jų NETURI, tad Order(**order.dict()) kitaip mestų klaidą dėl nežinomo argumento.
    # "taikyta_nuolaida_eur" UŽFIKSUOJAMA ČIA (sukūrimo metu) ir NIEKADA nebekinta per update_order - žr. to endpoint'o kainos pertaikymo komentarą, kodėl tai būtina, kad pratęsimas/sutrumpinimas NEpaverstų fiksuoto €X kodo procentine nuolaida.
    created = Order(**order.dict(exclude={"nuolaidos_kodas", "rezervacijos_id"}), taikyta_nuolaida_eur=taikyta_nuolaida_eur, bazine_kaina_parai=base_rate)
    db.add(created)
    if converting_reservation:
        # "atšaukta" ČIA reiškia "pakeista realiu užsakymu", NE "klientas atšaukė" - rezervacija ir užsakymas yra DVI atskiros lentelės/eilutės, ir be šio žingsnio KONVERTUOTA rezervacija toliau blokuotų busimus booking'us kaip "kitas", nesusijęs įrašas . COMMIT'inama VIENA transakcija KARTU su naujo užsakymo įrašymu - jei Order įrašymas nepavyktų, rezervacijos būsena NEpasikeistų.
        converting_reservation.busena = "atšaukta"
        db.add(converting_reservation)
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
    # Sąskaitos išorinis raktas saugo susietą užsakymą nuo ištrynimo; IntegrityError paverčiama 409 atsakymu, kad darbuotojų portalas parodytų suprantamą konflikto priežastį.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Užsakymo ištrinti negalima - jam priklauso sąskaita.")
    return {"ok": True}

# Redaguoja esamą užsakymą - TIK šie 3 laukai (būsena, grąžinimo data, papildomos paslaugos) keičiami per PUT; klientas/automobilis/kaina NEkeičiami, nes tai reikštų NAUJĄ užsakymą, ne redagavimą seno.
@router.put("/{uzsakymo_id}", response_model=schemas.OrderOut, operation_id="updateOrder",
            dependencies=[Depends(require_perm(Perm.EDIT))])
def update_order(uzsakymo_id: int, order_update: schemas.OrderUpdate, db: Session = Depends(get_db)):
    order = db.query(Order).filter(Order.uzsakymo_id == uzsakymo_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Užsakymas nerastas")
    # "užbaigta" - GALUTINĖ būsena; be šio patikrinimo PUT galėtų "atgaivinti" jau baigtą nuomą atgal į aktyvią (pvz. uzsakymo_busena="vykdoma"), o nuo to priklauso IR sąskaitos/automobilio statusas, IR lojalumo programos užbaigtų nuomų skaičiavimas (žr. customer_loyalty.py) - baigtas užsakymas turi likti nepakeičiamas.
    if order.uzsakymo_busena == "užbaigta":
        raise HTTPException(status_code=409, detail="Baigto užsakymo keisti negalima.")

    # Galutinė (po pakeitimo) būsena/data - patikros žemiau turi vertinti GALUTINĘ reikšmę, ne tik tai, kas realiai buvo atsiųsta užklausoje.
    busena = order_update.uzsakymo_busena if order_update.uzsakymo_busena is not None else order.uzsakymo_busena
    grazinimo_data = order.grazinimo_data
    if order_update.grazinimo_data is not None:
        # "<", NE "<=" - OrderCreate's validate_dates (schemas/order.py) LEIDŽIA grazinimo_data == nuomos_data (vienos dienos nuoma); ČIA turi būti TA PATI taisyklė, kitaip kūrimo metu priimtą reikšmę vėlesnis PUT (net nepakeisdamas jos) atmestų kaip "neteisingą".
        if order_update.grazinimo_data < order.nuomos_data:
            raise HTTPException(status_code=400, detail="Grąžinimo data turi būti vėlesnė arba lygi nuomos datai")
        grazinimo_data = order_update.grazinimo_data

    # Persidengimo PATIKRA ČIA PAT (automobilio IR kliento) - be jos užsakymas galėtų būti perjungtas į aktyvią būseną arba pratęstas datomis, kurios dabar susidengia su kitu automobilio/kliento booking'u, ir tai NIEKADA nebūtų pagauta (skirtingai nei create_order aukščiau).
    car = availability_service.lock_car_row(db, order.automobilio_id)
    availability_service.lock_client_row(db, order.kliento_id)
    # Kol laukėme automobilio užrakto, kita užklausa galėjo užbaigti ar pratęsti nuomą, todėl sprendžiame tik pagal pakartotinai užrakintą dabartinį įrašą.
    order = db.query(Order).filter(Order.uzsakymo_id == uzsakymo_id).populate_existing().with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Užsakymas nerastas")
    if order.uzsakymo_busena == "užbaigta":
        raise HTTPException(status_code=409, detail="Baigto užsakymo keisti negalima.")
    busena = order_update.uzsakymo_busena if order_update.uzsakymo_busena is not None else order.uzsakymo_busena
    grazinimo_data = order_update.grazinimo_data if order_update.grazinimo_data is not None else order.grazinimo_data
    if car and car.automobilio_statusas in availability_service.NOT_BOOKABLE_STATUSES and busena != "atšaukta":
        raise HTTPException(status_code=409, detail="Šis automobilis šiuo metu neišnuomojamas (servise/remonte).")
    if busena != "atšaukta":
        if availability_service.car_has_conflict(
            db, order.automobilio_id, order.nuomos_data, grazinimo_data, exclude_order_id=order.uzsakymo_id
        ):
            raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas arba išnuomotas tomis dienomis.")
        if availability_service.client_has_conflict(
            db, order.kliento_id, order.nuomos_data, grazinimo_data, exclude_order_id=order.uzsakymo_id
        ):
            raise HTTPException(status_code=409, detail="Klientas jau turi kitą rezervuotą automobilį tomis dienomis.")

    # Keičiant trukmę suma skaičiuojama iš užsakymo bazine_kaina_parai ir naujo dienų skaičiaus, tada vieną kartą atimama fiksuota taikyta_nuolaida_eur; vienos dienos nuomai taikoma bent viena diena, o nežinomas istorinis tarifas atkuriamas tik kai duomenys leidžia jį nustatyti vienareikšmiškai.
    if grazinimo_data != order.grazinimo_data:
        senas_dienu_sk = (order.grazinimo_data - order.nuomos_data).days or 1
        naujas_dienu_sk = (grazinimo_data - order.nuomos_data).days or 1
        nuolaida = float(order.taikyta_nuolaida_eur or 0)
        if order.bazine_kaina_parai is None and nuolaida > 0 and float(order.bendra_kaina) == 0:
            raise HTTPException(status_code=409, detail="Nulinės sumos užsakymo su nuolaida trukmės automatiškai keisti negalima.")
        rate = order.bazine_kaina_parai
        if rate is None:
            rate = (order.bendra_kaina + (order.taikyta_nuolaida_eur or Decimal(0))) / Decimal(senas_dienu_sk)
        order.bazine_kaina_parai = rate
        total = Decimal(rate) * Decimal(naujas_dienu_sk) - Decimal(str(nuolaida))
        order.bendra_kaina = max(Decimal(0), total).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # kai nuoma PASIBAIGIA ("užbaigta"), automobilis REALIAI yra "grazinimo_vietos_id" vietoje (gali skirtis nuo "paemimo_vietos_id" vienpusės nuomos atveju), bet jo DB įrašas (Car.dabartine_vieta_id) be šio žingsnio NIEKADA neatsinaujintų - viešas sąrašas/filtras ir KITO užsakymo paėmimo vieta toliau rodytų SENĄ (paėmimo) vietą. "car" čia JAU UŽRAKINTAS (lock_car_row aukščiau), tad priskyrimas saugus tos pačios transakcijos ribose.
    if busena == "užbaigta" and car:
        car.dabartine_vieta_id = order.grazinimo_vietos_id
        db.add(car)

    order.uzsakymo_busena = busena
    order.grazinimo_data = grazinimo_data
    if order_update.turi_papildomas_paslaugas is not None:
        order.turi_papildomas_paslaugas = order_update.turi_papildomas_paslaugas
    db.commit()
    db.refresh(order)
    return _order_out(order)
