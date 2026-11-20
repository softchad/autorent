# Viešas, be prisijungimo pasiekiamas automobilių katalogas klientų svetainei - grąžina TIK saugius laukus, niekada VIN, valstybinio numerio ar vidinių darbuotojų pastabų.
from datetime import date as date_type, timedelta  # "date" pervardinta į "date_type" - grynai aiškumo dėlei, kad skaitant matytųsi, jog tai PATS TIPAS (naudojamas tipų nuorodose), ne kintamasis su reikšme
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel  # reikalingas, nes PublicCarOut apibrėžtas ČIA PAT, žemiau, ne atskirame schemas/ faile (žr. klasę žemiau, kodėl)
from sqlalchemy.orm import Session, joinedload  # joinedload - SQLAlchemy nurodymas iškart VIENU SQL kreipiniu "pasiimti" ir susietą lokaciją (Car.lokacija), kad nereikėtų atskiro papildomo kreipinio KIEKVIENAM automobiliui sąraše

from app.api.deps import get_db
from app.models.car import Car
from app.models.location import Location
from app.schemas.location import LocationOut
from app.services import clock
from app.services.availability_service import get_busy_car_ids, get_busy_ranges_for_car, NOT_BOOKABLE_STATUSES  # bendra laisvumo logika - ta pati, kurią naudoja IR customer.py kliento rezervacijos kūrimas, kad abi vietos neišsiskirtų, kas yra "laisvas" automobilis

router = APIRouter(prefix="/public", tags=["Public"])

# Sąmoningai ATSKIRA, čia pat apibrėžta schema (ne bendrinis CarOut iš schemas/car.py) - aiškiai IŠVARDINA tik tuos laukus, kuriuos saugu rodyti be prisijungimo; jei kas vėliau pridėtų naują jautrų lauką į Car modelį, jis AUTOMATIŠKAI NEPASIRODYTŲ čia, kol nebūtų čia pat sąmoningai įrašytas.
class PublicCarOut(BaseModel):
    automobilio_id: int
    marke: str
    modelis: str
    metai: int
    spalva: str
    kebulo_tipas: str
    pavaru_deze: str
    variklio_turis: float
    galia_kw: int
    kuro_tipas: str
    rida: int
    sedimos_vietos: int
    klimato_kontrole: bool
    navigacija: bool
    kaina_parai: float
    automobilio_statusas: str
    lokacija: Optional[LocationOut]
    # Nustatoma TIK kai užklausoje nurodytas date_from/date_to - ar automobilis laisvas TĄ konkretų laikotarpį (ne vien bendra automobilio_statusas reikšmė, kuri nežino apie ateities rezervacijas).
    laisvas_pasirinktu_laikotarpiu: Optional[bool] = None

    class Config:
        from_attributes = True


# Naudojama IR sąrašo, IR vieno automobilio endpoint'uose - abu priima tuos pačius 2 pasirenkamus parametrus, tad patikra bendra.
def _validate_date_range(date_from: Optional[date_type], date_to: Optional[date_type]) -> None:
    # "!=" tarp dviejų bool'ų - lygu "XOR": klaida, jei nurodytas TIK VIENAS iš dviejų (abu arba nė vienas - tvarkinga).
    if (date_from is None) != (date_to is None):
        raise HTTPException(status_code=400, detail="Reikia nurodyti ir date_from, ir date_to.")
    if date_from and date_to and date_from >= date_to:
        raise HTTPException(status_code=400, detail="date_from turi būti anksčiau nei date_to.")


# Automobilių katalogo sąrašas su filtrais - viešas, nereikia prisijungimo, todėl grąžina TIK PublicCarOut saugius laukus (be VIN/numerio/pastabų, žr. klasės apibrėžimą aukščiau).
@router.get("/cars", response_model=List[PublicCarOut], operation_id="getPublicCars")
def get_public_cars(
    db: Session = Depends(get_db),
    marke: Optional[str] = None,
    kebulo_tipas: Optional[str] = None,
    kuro_tipas: Optional[str] = None,
    pavaru_deze: Optional[str] = None,
    min_kaina: Optional[float] = None,
    max_kaina: Optional[float] = None,
    sedimos_vietos: Optional[int] = None,
    vietos_id: Optional[int] = None,
    only_available: bool = True,
    date_from: Optional[date_type] = None,
    date_to: Optional[date_type] = None,
):
    _validate_date_range(date_from, date_to)

    query = db.query(Car).options(joinedload(Car.lokacija))

    if date_from and date_to:
        # Kai klientas nurodė KONKREČIAS datas - rodomi TIK automobiliai, kurie fiziškai nuomojami (ne servise/remonte) IR neturi persidengiančios rezervacijos/užsakymo tomis dienomis.
        query = query.filter(~Car.automobilio_statusas.in_(NOT_BOOKABLE_STATUSES))
        busy_car_ids = get_busy_car_ids(db, date_from, date_to)
        if busy_car_ids:
            query = query.filter(~Car.automobilio_id.in_(busy_car_ids))
    elif only_available:
        # Be datų - tik bendras "laisvas" filtras (numatytasis katalogo rodymas), nebent klientas pats paprašė only_available=False.
        query = query.filter(Car.automobilio_statusas == "laisvas")

    if marke:
        query = query.filter(Car.marke == marke)
    if kebulo_tipas:
        query = query.filter(Car.kebulo_tipas == kebulo_tipas)
    if kuro_tipas:
        query = query.filter(Car.kuro_tipas == kuro_tipas)
    if pavaru_deze:
        query = query.filter(Car.pavaru_deze == pavaru_deze)
    if min_kaina is not None:
        query = query.filter(Car.kaina_parai >= min_kaina)
    if max_kaina is not None:
        query = query.filter(Car.kaina_parai <= max_kaina)
    if sedimos_vietos:
        query = query.filter(Car.sedimos_vietos >= sedimos_vietos)
    if vietos_id:
        query = query.filter(Car.dabartine_vieta_id == vietos_id)

    # Rikiuojama nuo PIGIAUSIO - klientui naršant katalogą be prisijungimo, pirmiausia rodomi prieinamiausi pasiūlymai.
    cars = query.order_by(Car.kaina_parai.asc()).all()
    # Jei datos nurodytos, visi ČIA likę automobiliai JAU išfiltruoti kaip laisvi tam laikotarpiui (žr. filtrą aukščiau) - tad visiems tiesiog True, antrą kartą tikrinti nereikia.
    if date_from and date_to:
        for car in cars:
            car.laisvas_pasirinktu_laikotarpiu = True
    return cars


# Vieno automobilio detalės - naudojama automobilio puslapyje; su datomis papildomai parodo, ar JIS KONKREČIAI laisvas pasirinktam laikotarpiui.
@router.get("/cars/{automobilio_id}", response_model=PublicCarOut, operation_id="getPublicCar")
def get_public_car(
    automobilio_id: int,
    db: Session = Depends(get_db),
    date_from: Optional[date_type] = None,
    date_to: Optional[date_type] = None,
):
    _validate_date_range(date_from, date_to)

    car = (
        db.query(Car)
        .options(joinedload(Car.lokacija))
        .filter(Car.automobilio_id == automobilio_id)
        .first()
    )
    if not car:
        raise HTTPException(status_code=404, detail="Automobilis nerastas")

    if date_from and date_to:
        # Lygiai TOS PAČIOS dvi taisyklės kaip sąrašo endpointe aukščiau (fizinė būsena + rezervacijų/užsakymų konfliktas), tik čia pritaikytos VIENAM jau surastam automobiliui, ne SQL filtrui.
        busy_car_ids = get_busy_car_ids(db, date_from, date_to)
        car.laisvas_pasirinktu_laikotarpiu = (
            car.automobilio_statusas not in NOT_BOOKABLE_STATUSES
            and car.automobilio_id not in busy_car_ids
        )
    return car


# Grąžina kiekvieną atskirą užimtą DIENĄ (ne intervalus) ~5 mėn. į priekį - toks paprastas formatas reikalingas, kad kalendoriaus komponentas galėtų vizualiai pažymėti/užblokuoti konkrečias dienas, be papildomo intervalų skaičiavimo frontend'e.
@router.get("/cars/{automobilio_id}/busy-dates", operation_id="getPublicCarBusyDates")
def get_public_car_busy_dates(automobilio_id: int, db: Session = Depends(get_db)):
    window_from = date_type.today()
    window_to = window_from + timedelta(days=150)

    ranges = get_busy_ranges_for_car(db, automobilio_id, window_from, window_to)

    days: set[str] = set()
    for start, end in ranges:
        # "max"/"min" apkarpo kiekvieną rezervacijos intervalą TIK iki rodomo 150 dienų lango - jei rezervacija pradėjo prieš "šiandien" arba tęsiasi toliau nei langas, nebandoma pažymėti dienų UŽ jo ribų.
        d = max(start, window_from)
        last = min(end, window_to)
        while d < last:
            days.add(d.isoformat())
            d += timedelta(days=1)

    return {"busy_dates": sorted(days)}


class ServerTimeOut(BaseModel):
    server_time: str


# Programėlė pagal serverio laiką galės apskaičiuoti telefono laikrodžio paklaidą.
@router.get(
    "/server-time",
    response_model=ServerTimeOut,
    operation_id="getServerTime",
)
def get_server_time():
    return ServerTimeOut(
        server_time=clock.utc_now().isoformat().replace("+00:00", "Z")
    )


# Padaliniai, kuriuose šiuo metu yra bent vienas automobilis – programėlės filtrui ir žemėlapiui.
# Grąžinami tik vieši laukai (pavadinimas, adresas, miestas); darbuotojų endpointas /cars/locations/all lieka nepakeistas.
@router.get("/locations", response_model=List[LocationOut], operation_id="getPublicLocations")
def get_public_locations(db: Session = Depends(get_db)):
    return (
        db.query(Location)
        .join(Car, Car.dabartine_vieta_id == Location.vietos_id)
        .distinct()
        .order_by(Location.miestas.asc(), Location.pavadinimas.asc())
        .all()
    )
