# Rezervacijų CRUD endpointai - darbuotojų pusėje IŠ ANKSTO pažymima, kad klientas ateityje pasiims konkretų automobilį (dar NE realus užsakymas, žr. order.py).
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import reservation as schemas
from app.models.reservation import Reservation
from app.models.car import Car
from app.models.client import Client
from app.services import availability_service  # availability_service.lock_car_row - naudojamas žemiau, prieš tikrinant laisvumą
from utils.hateoas import generate_links  # naudojama create/update žemiau (prideda TIK "delete" nuorodą) - skirtinga nuo _reservation_links aukščiau, kuri skirta PERŽIŪROS sąrašams su klientas/automobilis nuorodomis
from app.api.deps import get_current_user
from app.api.permissions import require_perm, Perm

router = APIRouter(
    prefix="/reservations",
    tags=["Reservations"],
    dependencies=[Depends(get_current_user)]
)

# Savos rankos nuorodos (ne utils/hateoas.generate_links, kaip žemiau create/update) - šios PRIDEDA nuorodas į SUSIJUSĮ klientą ir automobilį, kad sąrašą rodantis frontend'as galėtų iš karto nueiti pažiūrėti juos, bet SĄMONINGAI neduoda "delete" nuorodos tiesiog peržiūros sąraše.
def _reservation_links(res) -> list[dict]:
    return [
        {"rel": "self", "href": f"/reservations/{res.rezervacijos_id}"},
        {"rel": "client", "href": f"/clients/{res.kliento_id}"},
        {"rel": "car", "href": f"/cars/{res.automobilio_id}"},
    ]


# Grąžina N NAUJAUSIŲ rezervacijų su automobilio/kliento info (JOIN repozitorijoje) - naudojama dashboard'o "pastarosios rezervacijos" sąrašui, ne pilnam katalogui.
@router.get("/latest", response_model=list[schemas.ReservationSummary],
            operation_id="getLatestReservations", dependencies=[Depends(require_perm(Perm.VIEW))])
def get_latest_reservations(db: Session = Depends(get_db), limit: int = 5):
    # Grąžina N naujausių rezervacijų KARTU su automobilio ir kliento info (JOIN) - naudojama rodyti, su kokiu automobiliu/klientu susijusi kiekviena, be atskiros užklausos kiekvienai eilutei.
    results = (
        db.query(
            Reservation.rezervacijos_id,
            Reservation.kliento_id,
            Reservation.automobilio_id,
            Reservation.rezervacijos_pradzia,
            Reservation.rezervacijos_pabaiga,
            Reservation.busena,
            Car.marke,
            Car.modelis,
            Client.vardas,
            Client.pavarde,
        )
        .join(Car, Reservation.automobilio_id == Car.automobilio_id)
        .join(Client, Reservation.kliento_id == Client.kliento_id)
        # Atšauktos NEĖINA į "limit" - kitaip, jei kelios iš NAUJAUSIŲ būtų atšauktos, dashboard'as gautų MAŽIAU nei "limit" įrašų, nors senesnių galiojančių rezervacijų yra daugiau.
        .filter(Reservation.busena != "atšaukta")
        .order_by(desc(Reservation.rezervacijos_pradzia))
        .limit(limit)
        .all()
    )
    # Laukai surenkami RANKA, ne "**r.__dict__" (kaip get_all_reservations žemiau) - "results" yra atskirų stulpelių rinkiniai iš JOIN užklausos aukščiau, ne pilni Reservation objektai, tad "__dict__" tiesiog neturėtų tų pačių laukų.
    return [
        {
            "rezervacijos_id": r.rezervacijos_id,
            "rezervacijos_pradzia": r.rezervacijos_pradzia,
            "rezervacijos_pabaiga": r.rezervacijos_pabaiga,
            "automobilio_id": r.automobilio_id,
            "kliento_id": r.kliento_id,
            "busena": r.busena,
            "marke": r.marke,
            "modelis": r.modelis,
            "vardas": r.vardas,
            "pavarde": r.pavarde,
            "links": _reservation_links(r),
        }
        for r in results
    ]

# Grąžina VISŲ rezervacijų sąrašą - reikalauja bent VIEW teisės.
@router.get("/", response_model=list[schemas.ReservationOut], operation_id="getAllReservations",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_all_reservations(db: Session = Depends(get_db)):
    reservations = db.query(Reservation).all()
    return [
        {**res.__dict__, "links": _reservation_links(res)}
        for res in reservations
    ]

# Naujos rezervacijos kūrimas - persidengimo patikra PRALEIDŽIAMA, jei kuriama JAU "atšaukta" būsena (atšaukta rezervacija nieko neblokuoja, tad su ja konfliktas neįmanomas iš principo).
@router.post("/", response_model=schemas.ReservationOut, operation_id="createReservation",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_reservation(reservation: schemas.ReservationCreate, db: Session = Depends(get_db)):
    # SELECT ... FOR UPDATE - užrakina automobilio IR kliento eilutes, kad du vienu metu kuriami rezervavimai/užsakymai dėl TO PATIES automobilio ARBA TO PATIES kliento negalėtų abu pamatyti "laisva" prieš bet kuriam užsicommit'inant.
    car = availability_service.lock_car_row(db, reservation.automobilio_id)
    if not car:
        raise HTTPException(status_code=404, detail="Automobilis nerastas")
    if not availability_service.lock_client_row(db, reservation.kliento_id):
        raise HTTPException(status_code=404, detail="Klientas nerastas")
    # Automobilio fizinė būsena tikrinama nepriklausomai nuo datų: servise ar remonte esantis automobilis nerezervuojamas ir neišnuomojamas; tas pats ribojimas taikomas klientų savitarnos API.
    if car and car.automobilio_statusas in availability_service.NOT_BOOKABLE_STATUSES and reservation.busena != "atšaukta":
        raise HTTPException(status_code=409, detail="Šis automobilis šiuo metu neišnuomojamas (servise/remonte).")
    if reservation.busena != "atšaukta":
        # Tikrina KARTU rezervacijas IR užsakymus (ne tik Rezervavimas lentelę) - automobilis, kurį kažkas JAU nuomojasi (Uzsakymai), negali būti vėl rezervuotas tomis pačiomis dienomis.
        if availability_service.car_has_conflict(
            db, reservation.automobilio_id, reservation.rezervacijos_pradzia, reservation.rezervacijos_pabaiga
        ):
            raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas šiomis dienomis.")
        # availability_service tikrina kliento aktyvias rezervacijas ir užsakymus, kad jis tuo pačiu laikotarpiu negalėtų užimti kelių automobilių.
        if availability_service.client_has_conflict(
            db, reservation.kliento_id, reservation.rezervacijos_pradzia, reservation.rezervacijos_pabaiga
        ):
            raise HTTPException(status_code=409, detail="Klientas jau turi kitą rezervuotą automobilį tomis dienomis.")

    created = Reservation(**reservation.dict(), kaina_parai=car.kaina_parai)
    db.add(created)
    db.commit()
    db.refresh(created)
    return {
        **created.__dict__,
        "links": generate_links("reservations", created.rezervacijos_id, ["delete"])
    }

# Redaguoja esamą rezervaciją - "changes.get(lauką, existing.lauką)" visur žemiau reiškia "naudok NAUJĄ reikšmę, jei ji atsiųsta, kitaip PALIK senąją", kad patikros būtų atliekamos su GALUTINE (po pakeitimo) būsena, ne tik su tuo, kas realiai buvo atsiųsta.
@router.put("/{rezervacijos_id}", response_model=schemas.ReservationOut, operation_id="updateReservation",
            dependencies=[Depends(require_perm(Perm.EDIT))])
def update_reservation(rezervacijos_id: int, updated: schemas.ReservationUpdate, db: Session = Depends(get_db)):
    existing = db.query(Reservation).filter(Reservation.rezervacijos_id == rezervacijos_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Rezervacija nerasta")

    changes = updated.dict(exclude_unset=True)
    automobilio_id = changes.get("automobilio_id", existing.automobilio_id)
    pradzia = changes.get("rezervacijos_pradzia", existing.rezervacijos_pradzia)
    pabaiga = changes.get("rezervacijos_pabaiga", existing.rezervacijos_pabaiga)
    busena = changes.get("busena", existing.busena)

    # Ši data patikra ReservationUpdate schemoje NEgalima (tam reikėtų ŽINOTI SENĄJĄ reikšmę, kurios dalinė schema neturi) - tad atliekama ČIA, po sujungimo su esamais laukais.
    if pabaiga <= pradzia:
        raise HTTPException(status_code=400, detail="Pabaigos data turi būti vėlesnė nei pradžios data")

    kliento_id = changes.get("kliento_id", existing.kliento_id)
    original_owner = (existing.automobilio_id, existing.kliento_id)
    car = availability_service.lock_car_row(db, automobilio_id)
    if not car:
        raise HTTPException(status_code=404, detail="Automobilis nerastas")
    if not availability_service.lock_client_row(db, kliento_id):
        raise HTTPException(status_code=404, detail="Klientas nerastas")
    # Po laukimo perskaitome dabartinę rezervaciją; pakeitus jos savininką ar automobilį reikia naujo prašymo su teisingais užraktais.
    existing = db.query(Reservation).filter(Reservation.rezervacijos_id == rezervacijos_id).populate_existing().with_for_update().first()
    if not existing or (existing.automobilio_id, existing.kliento_id) != original_owner:
        raise HTTPException(status_code=409, detail="Rezervacija buvo pakeista. Atnaujinkite sąrašą ir bandykite dar kartą.")
    pradzia = changes.get("rezervacijos_pradzia", existing.rezervacijos_pradzia)
    pabaiga = changes.get("rezervacijos_pabaiga", existing.rezervacijos_pabaiga)
    busena = changes.get("busena", existing.busena)
    if pabaiga <= pradzia:
        raise HTTPException(status_code=400, detail="Pabaigos data turi būti vėlesnė nei pradžios data")
    # Fizinė automobilio būsena (servise/remonte) - svarbu IR čia, nes "automobilio_id" GALI būti pakeistas šiuo PUT (perskiriant rezervaciją KITAM automobiliui).
    if car and car.automobilio_statusas in availability_service.NOT_BOOKABLE_STATUSES and busena != "atšaukta":
        raise HTTPException(status_code=409, detail="Šis automobilis šiuo metu neišnuomojamas (servise/remonte).")
    if busena != "atšaukta":
        # Tikrina KARTU rezervacijas IR užsakymus (ne tik Rezervavimas lentelę) - "exclude_reservation_id" - redaguojant ESAMĄ rezervaciją, ji PATI neturi būti laikoma "konfliktu" su savimi.
        if availability_service.car_has_conflict(
            db, automobilio_id, pradzia, pabaiga, exclude_reservation_id=rezervacijos_id
        ):
            raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas šiomis dienomis.")
        # Tas pats, kas order.py update_order - "exclude_reservation_id" - ESAMA rezervacija pati savaime nelaikoma konfliktu su savimi.
        if availability_service.client_has_conflict(
            db, kliento_id, pradzia, pabaiga, exclude_reservation_id=rezervacijos_id
        ):
            raise HTTPException(status_code=409, detail="Klientas jau turi kitą rezervuotą automobilį tomis dienomis.")

    if automobilio_id != existing.automobilio_id:
        existing.kaina_parai = car.kaina_parai
    for field, value in changes.items():
        setattr(existing, field, value)

    db.commit()
    db.refresh(existing)
    return {
        **existing.__dict__,
        "links": generate_links("reservations", existing.rezervacijos_id, ["delete"])
    }

# Ištrina rezervaciją - reikalauja ADMIN teisės, nes tai negrįžtamas veiksmas (atšaukimui pakanka update_reservation su busena="atšaukta").
@router.delete("/{rezervacijos_id}", operation_id="deleteReservation",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_reservation(rezervacijos_id: int, db: Session = Depends(get_db)):
    reservation = db.query(Reservation).filter(Reservation.rezervacijos_id == rezervacijos_id).first()
    if not reservation:
        raise HTTPException(status_code=404, detail="Rezervacija nerasta")
    db.delete(reservation)
    # rezervacija GALI būti susieta su pagalbos pokalbiu (Pokalbiai.rezervacijos_id, RESTRICT FK); be šio try/except toks DELETE lūžtų kaip neaiškus 500, ne aiškus 409.
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Rezervacijos ištrinti negalima - su ja susietas pagalbos pokalbis.")
    return {"ok": True}

