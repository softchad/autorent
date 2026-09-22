# Rezervacijų CRUD endpointai - darbuotojų pusėje IŠ ANKSTO pažymima, kad klientas ateityje pasiims konkretų automobilį (dar NE realus užsakymas, žr. order.py).
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import reservation as schemas
from app.repositories import reservation as repo
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
    results = repo.get_latest_reservations_with_details(db, limit=limit)
    # Laukai surenkami RANKA, ne "**r.__dict__" (kaip get_all_reservations žemiau) - "results" yra atskirų stulpelių rinkiniai iš JOIN užklausos (repo.py), ne pilni Reservation objektai, tad "__dict__" tiesiog neturėtų tų pačių laukų.
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
    reservations = repo.get_all(db)
    return [
        {**res.__dict__, "links": _reservation_links(res)}
        for res in reservations
    ]

# Naujos rezervacijos kūrimas - persidengimo patikra PRALEIDŽIAMA, jei kuriama JAU "atšaukta" būsena (atšaukta rezervacija nieko neblokuoja, tad su ja konfliktas neįmanomas iš principo).
@router.post("/", response_model=schemas.ReservationOut, operation_id="createReservation",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_reservation(reservation: schemas.ReservationCreate, db: Session = Depends(get_db)):
    # SELECT ... FOR UPDATE - užrakina automobilio eilutę, kad du vienu metu kuriami rezervavimai dėl TO PATIES automobilio negalėtų abu pamatyti "laisva" prieš bet kuriam užsicommit'inant.
    availability_service.lock_car_row(db, reservation.automobilio_id)
    if reservation.busena != "atšaukta" and repo.find_conflict(
        db, reservation.automobilio_id, reservation.rezervacijos_pradzia, reservation.rezervacijos_pabaiga
    ):
        raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas šiomis dienomis.")

    created = repo.create(db, reservation)
    return {
        **created.__dict__,
        "links": generate_links("reservations", created.rezervacijos_id, ["delete"])
    }

# Redaguoja esamą rezervaciją - "changes.get(lauką, existing.lauką)" visur žemiau reiškia "naudok NAUJĄ reikšmę, jei ji atsiųsta, kitaip PALIK senąją", kad patikros būtų atliekamos su GALUTINE (po pakeitimo) būsena, ne tik su tuo, kas realiai buvo atsiųsta.
@router.put("/{rezervacijos_id}", response_model=schemas.ReservationOut, operation_id="updateReservation",
            dependencies=[Depends(require_perm(Perm.EDIT))])
def update_reservation(rezervacijos_id: int, updated: schemas.ReservationUpdate, db: Session = Depends(get_db)):
    existing = repo.get_by_id(db, rezervacijos_id)
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

    availability_service.lock_car_row(db, automobilio_id)
    if busena != "atšaukta" and repo.find_conflict(
        db, automobilio_id, pradzia, pabaiga, exclude_id=rezervacijos_id
    ):
        raise HTTPException(status_code=409, detail="Automobilis jau rezervuotas šiomis dienomis.")

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
    success = repo.delete(db, rezervacijos_id)
    if not success:
        raise HTTPException(status_code=404, detail="Rezervacija nerasta")
    return {"ok": True}

