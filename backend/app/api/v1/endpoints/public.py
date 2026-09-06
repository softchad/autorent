# Viešas, be prisijungimo pasiekiamas endpointas klientų svetainei.
# Grąžina tik saugius laukus - be VIN, valstybinio numerio ar vidinių pastabų.
from datetime import date as date_type
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db
from app.models.car import Car
from app.schemas.location import LocationOut
from app.services.availability_service import get_busy_car_ids, NOT_BOOKABLE_STATUSES

router = APIRouter(prefix="/public", tags=["Public"])


class PublicCarOut(BaseModel):
    automobilio_id: int
    marke: str
    modelis: str
    metai: int
    spalva: str
    kebulo_tipas: str
    pavarų_deze: str
    kuro_tipas: str
    sedimos_vietos: int
    klimato_kontrole: bool
    navigacija: bool
    kaina_parai: float
    automobilio_statusas: str
    lokacija: Optional[LocationOut]
    # Nustatoma tik kai užklausoje nurodytas date_from/date_to - ar automobilis laisvas
    # TĄ konkretų laikotarpį (ne vien bendra automobilio_statusas reikšmė).
    laisvas_pasirinktu_laikotarpiu: Optional[bool] = None

    class Config:
        from_attributes = True


def _validate_date_range(date_from: Optional[date_type], date_to: Optional[date_type]) -> None:
    if (date_from is None) != (date_to is None):
        raise HTTPException(status_code=400, detail="Reikia nurodyti ir date_from, ir date_to.")
    if date_from and date_to and date_from >= date_to:
        raise HTTPException(status_code=400, detail="date_from turi būti anksčiau nei date_to.")


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
        # Realus laisvumas pasirinktu laikotarpiu - ne vien bendra automobilio būsena.
        query = query.filter(~Car.automobilio_statusas.in_(NOT_BOOKABLE_STATUSES))
        busy_car_ids = get_busy_car_ids(db, date_from, date_to)
        if busy_car_ids:
            query = query.filter(~Car.automobilio_id.in_(busy_car_ids))
    elif only_available:
        query = query.filter(Car.automobilio_statusas == "laisvas")

    if marke:
        query = query.filter(Car.marke == marke)
    if kebulo_tipas:
        query = query.filter(Car.kebulo_tipas == kebulo_tipas)
    if kuro_tipas:
        query = query.filter(Car.kuro_tipas == kuro_tipas)
    if pavaru_deze:
        query = query.filter(Car.pavarų_deze == pavaru_deze)
    if min_kaina is not None:
        query = query.filter(Car.kaina_parai >= min_kaina)
    if max_kaina is not None:
        query = query.filter(Car.kaina_parai <= max_kaina)
    if sedimos_vietos:
        query = query.filter(Car.sedimos_vietos >= sedimos_vietos)
    if vietos_id:
        query = query.filter(Car.dabartine_vieta_id == vietos_id)

    cars = query.order_by(Car.kaina_parai.asc()).all()
    if date_from and date_to:
        for car in cars:
            car.laisvas_pasirinktu_laikotarpiu = True
    return cars


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
        busy_car_ids = get_busy_car_ids(db, date_from, date_to)
        car.laisvas_pasirinktu_laikotarpiu = (
            car.automobilio_statusas not in NOT_BOOKABLE_STATUSES
            and car.automobilio_id not in busy_car_ids
        )
    return car
