# Automobilių CRUD (sukurti/skaityti/atnaujinti/ištrinti) endpointai - darbuotojų administravimo sąsajai.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload  # joinedload - iš karto "pasiimame" susietą lokaciją vienu DB kreipiniu, ne atskiru papildomu
from sqlalchemy.exc import IntegrityError  # klaida, kurią duomenų bazė meta, kai veiksmas atmetamas dėl susijusių įrašų (žr. delete_car žemiau)
from typing import List
from app.api.deps import get_db
from app.models.car import Car
from app.models.location import Location
from app.schemas.car import CarOut, CarCreate, CarUpdate  # "formos" - CarCreate/CarUpdate apibrėžia, kokius laukus PRIIMAME, CarOut - kokius GRĄŽINAME
from app.schemas.location import LocationOut
from utils.hateoas import generate_links  # prideda prie atsakymo nuorodas ("links"), kokius veiksmus su šiuo įrašu galima atlikti toliau
from app.api.deps import get_current_user
from app.api.permissions import require_perm, Perm  # tikrina, ar prisijungusio darbuotojo rolė turi reikiamą teisę (VIEW/EDIT/ADMIN) veiksmui


router = APIRouter(
    prefix="/cars",
    tags=["Cars"],
    dependencies=[Depends(get_current_user)]
)


# Paverčia automobilio lokaciją (DB objektą) į paprastą žodyną - kad atsakyme matytųsi tik reikalingi laukai, ne visas SQLAlchemy objektas.
def _location_dict(lokacija) -> dict | None:
    if not lokacija:
        return None
    return {
        "vietos_id": lokacija.vietos_id,
        "pavadinimas": lokacija.pavadinimas,
        "adresas": lokacija.adresas,
        "miestas": lokacija.miestas,
    }


# Bendras automobilio atsakymo "surinkimas" - naudojamas VISUOSE endpoint'uose žemiau, kad formatas būtų vienodas.
def _car_out(car: Car) -> dict:
    return {
        **car.__dict__,  # "**" išskleidžia VISUS automobilio DB laukus (markė, modelis, kaina ir t.t.) į žodyną
        "lokacija": _location_dict(car.lokacija),
        "links": generate_links("cars", car.automobilio_id, ["update", "delete"]),
    }


# Grąžina VISŲ automobilių sąrašą - reikalauja bent VIEW teisės.
@router.get("/", response_model=List[CarOut], operation_id="getAllCars",
             dependencies=[Depends(require_perm(Perm.VIEW))])
def get_all_cars(db: Session = Depends(get_db)):
    cars = db.query(Car).options(joinedload(Car.lokacija)).all()
    return [_car_out(car) for car in cars]


# Sukuria naują automobilį - reikalauja EDIT teisės (aukštesnė nei VIEW aukščiau).
@router.post("/", response_model=CarOut, operation_id="createCar", dependencies=[Depends(require_perm(Perm.EDIT))])
def create_car(data: CarCreate, db: Session = Depends(get_db)):
    car = Car(**data.dict())  # paverčia gautą "formą" (CarCreate) į naują DB objektą
    db.add(car)
    try:
        db.commit()
    except IntegrityError:
        # numeris ir vin_kodas yra UNIQUE DB lygmeniu - čia tą klaidą paverčiame suprantamu pranešimu, ne 500 serverio klaida.
        db.rollback()
        raise HTTPException(status_code=409, detail="Automobilis su šiuo numeriu arba VIN kodu jau egzistuoja.")
    db.refresh(car)
    return _car_out(car)


# Redaguoja esamą automobilį - keičiami TIK TIE laukai, kurie realiai buvo atsiųsti užklausoje, kiti lieka nepakitę.
@router.put("/{car_id}", response_model=CarOut, operation_id="updateCar", dependencies=[Depends(require_perm(Perm.EDIT))])
def update_car(car_id: int, data: CarUpdate, db: Session = Depends(get_db)):
    car = db.query(Car).filter(Car.automobilio_id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Automobilis nerastas")

    # exclude_unset=True - į žodyną patenka TIK laukai, kuriuos užklausa tikrai atsiuntė (ne visi CarUpdate laukai su numatytąja None reikšme).
    for key, value in data.dict(exclude_unset=True).items():
        setattr(car, key, value)

    try:
        db.commit()
    except IntegrityError:
        # Tas pats UNIQUE apribojimas kaip create_car aukščiau - galima, jei keičiamas numeris/vin_kodas į jau užimtą.
        db.rollback()
        raise HTTPException(status_code=409, detail="Automobilis su šiuo numeriu arba VIN kodu jau egzistuoja.")
    db.refresh(car)
    return _car_out(car)


# Ištrina automobilį - reikalauja ADMIN teisės (aukščiausia iš trijų: VIEW < EDIT < ADMIN).
@router.delete("/{car_id}", operation_id="deleteCar", dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_car(car_id: int, db: Session = Depends(get_db)):
    car = db.query(Car).filter(Car.automobilio_id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Automobilis nerastas")
    db.delete(car)
    try:
        db.commit()
    except IntegrityError:
        # Duomenų bazė PATI atmeta trynimą, jei automobilis susietas su užsakymu/rezervacija - čia tą klaidą paverčiame suprantamu pranešimu, ne 500 serverio klaida.
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Automobilio ištrinti negalima - su juo susiję užsakymai/rezervacijos ar kiti įrašai.",
        )
    return {"message": "Car deleted successfully"}

# Grąžina visų padalinių (miestų/adresų) sąrašą - naudoja frontend'as automobilio "vieta" pasirinkimo laukui.
@router.get("/locations/all", response_model=List[LocationOut], operation_id="getLocations", dependencies=[Depends(require_perm(Perm.VIEW))])
def get_locations(db: Session = Depends(get_db)):
    return db.query(Location).order_by(Location.vietos_id).all()
