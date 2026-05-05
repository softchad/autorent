from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from app.api.deps import get_db
from app.models.car import Car
from app.schemas.car import CarOut, CarCreate, CarUpdate, CarStatusUpdate
from utils.hateoas import generate_links
from app.api.deps import get_current_user
from app.api.permissions import require_perm, Perm
from datetime import date
from app.models.reservation import Reservation


router = APIRouter(
    prefix="/cars",
    tags=["Cars"],
    dependencies=[Depends(get_current_user)]
)

@router.get("/", response_model=List[CarOut], operation_id="getAllCars",
             dependencies=[Depends(require_perm(Perm.VIEW))])
def get_all_cars(db: Session = Depends(get_db)):
    cars = db.query(Car).options(joinedload(Car.lokacija)).all()
    return [
        {
            **car.__dict__,
            "lokacija": (
                {
                    "vietos_id": car.lokacija.vietos_id,
                    "pavadinimas": car.lokacija.pavadinimas,
                    "adresas": car.lokacija.adresas,
                    "miestas": car.lokacija.miestas,
                } if car.lokacija else None
            ),
            "links": generate_links("cars", car.automobilio_id, ["update", "delete", "update_status"]),
        }
        for car in cars
    ]

@router.get(
    "/available",
    response_model=List[CarOut],
    operation_id="getAvailableCars",
    dependencies=[Depends(require_perm(Perm.VIEW))]
)
def get_available_cars(
    date_from: date = Query(..., description="YYYY-MM-DD"),
    date_to:   date = Query(..., description="YYYY-MM-DD "),
    db: Session = Depends(get_db),
):
    if date_from >= date_to:
        raise HTTPException(status_code=400, detail="Invalid date range: `date_from` must be earlier than `date_to`.")

    # Automobiliai, kuriems yra rezervacija šiuo laikotarpiu
    busy_car_ids_subq = (
    db.query(Reservation.automobilio_id)
    .filter(
        ~(
            (Reservation.rezervacijos_pabaiga <= date_from) |
            (Reservation.rezervacijos_pradzia >= date_to)
        )
    )
    .subquery()
)

    cars = (
        db.query(Car)
        .options(joinedload(Car.lokacija))
        .filter(~Car.automobilio_id.in_(busy_car_ids_subq))
        .all()
    )

    return [
        {
            **car.__dict__,
            "lokacija": (
                {
                    "vietos_id": car.lokacija.vietos_id,
                    "pavadinimas": car.lokacija.pavadinimas,
                    "adresas": car.lokacija.adresas,
                    "miestas": car.lokacija.miestas,
                } if car.lokacija else None
            ),
            "links": generate_links(
                "cars", car.automobilio_id, ["update", "delete", "update_status"]
            ),
        }
        for car in cars
    ]

@router.get(
    "/utilization",
    operation_id="getCarsUtilization",
    dependencies=[Depends(require_perm(Perm.VIEW))]
)
def get_cars_utilization(
    date_from: date = Query(..., description="YYYY-MM-DD"),
    date_to:   date = Query(..., description="YYYY-MM-DD "),
    statuses: str | None = Query("patvirtinta,vykdoma", description="Comma-separated reservation statuses to count"),
    db: Session = Depends(get_db),
):
    if date_from >= date_to:
        raise HTTPException(status_code=400, detail="Invalid date range: `date_from` must be earlier than `date_to`.")

    total_days = (date_to - date_from).days
    if total_days <= 0:
        raise HTTPException(status_code=400, detail="Selected range must span at least 1 day.")

    status_list = None
    if statuses:
        status_list = [s.strip() for s in statuses.split(",") if s.strip()]

    cars = db.query(Car).all()

    results: list[dict] = []
    for c in cars:
        q = db.query(Reservation).filter(Reservation.automobilio_id == c.automobilio_id)
        if status_list:
            if hasattr(Reservation, "statusas"):
                q = q.filter(Reservation.statusas.in_(status_list))

        used_days = 0
        for r in q.all():
            start = getattr(r, "rezervacijos_pradzia")
            end   = getattr(r, "rezervacijos_pabaiga")

            # Apskaičiuojama persidengimo trukmė dienomis
            s = max(start, date_from)
            e = min(end, date_to)
            delta = (e - s).days
            if delta > 0:
                used_days += delta

        utilization = round(100.0 * used_days / total_days, 1)
        results.append({
            "car_id": c.automobilio_id,
            "utilization_pct": utilization,
            "used_days": used_days,
            "total_days": total_days,
        })

    results.sort(key=lambda x: x["utilization_pct"], reverse=True)
    return results


@router.get("/search", response_model=List[CarOut], operation_id="searchCars", dependencies=[Depends(require_perm(Perm.VIEW))])
def search_cars(
    db: Session = Depends(get_db),
    marke: Optional[str] = None,
    modelis: Optional[str] = None,
    spalva: Optional[str] = None,
    status: Optional[str] = None,
    kuro_tipas: Optional[str] = None,
    metai: Optional[int] = None,
    sedimos_vietos: Optional[int] = None,
):
    query = db.query(Car).options(joinedload(Car.lokacija))

    if marke:
        query = query.filter(Car.marke.ilike(f"%{marke}%"))
    if modelis:
        query = query.filter(Car.modelis.ilike(f"%{modelis}%"))
    if spalva:
        query = query.filter(Car.spalva.ilike(f"%{spalva}%"))
    if status:
        query = query.filter(Car.automobilio_statusas == status)
    if kuro_tipas:
        query = query.filter(Car.kuro_tipas == kuro_tipas)
    if metai:
        query = query.filter(Car.metai == metai)
    if sedimos_vietos:
        query = query.filter(Car.sedimos_vietos == sedimos_vietos)

    cars = query.all()
    return [
        {
            **car.__dict__,
            "lokacija": (
                {
                    "vietos_id": car.lokacija.vietos_id,
                    "pavadinimas": car.lokacija.pavadinimas,
                    "adresas": car.lokacija.adresas,
                    "miestas": car.lokacija.miestas,
                } if car.lokacija else None
            ),
            "links": generate_links("cars", car.automobilio_id, ["update", "delete", "update_status"]),
        }
        for car in cars
    ]


@router.get("/{car_id}", response_model=CarOut, operation_id="getCarById", dependencies=[Depends(require_perm(Perm.VIEW))])
def get_car(car_id: int, db: Session = Depends(get_db)):
    car = db.query(Car).options(joinedload(Car.lokacija)).filter(Car.automobilio_id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return {
        **car.__dict__,
        "lokacija": (
            {
                "vietos_id": car.lokacija.vietos_id,
                "pavadinimas": car.lokacija.pavadinimas,
                "adresas": car.lokacija.adresas,
                "miestas": car.lokacija.miestas,
            } if car.lokacija else None
        ),
        "links": generate_links("cars", car.automobilio_id, ["update", "delete", "update_status"]),
    }


@router.post("/", response_model=CarOut, operation_id="createCar", dependencies=[Depends(require_perm(Perm.EDIT))])
def create_car(data: CarCreate, db: Session = Depends(get_db)):
    car = Car(**data.dict())
    db.add(car)
    db.commit()
    db.refresh(car)
    return {
        **car.__dict__,
        "lokacija": None,
        "links": generate_links("cars", car.automobilio_id, ["update", "delete", "update_status"]),
    }


@router.put("/{car_id}", response_model=CarOut, operation_id="updateCar", dependencies=[Depends(require_perm(Perm.EDIT))])
def update_car(car_id: int, data: CarUpdate, db: Session = Depends(get_db)):
    car = db.query(Car).filter(Car.automobilio_id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(car, key, value)

    db.commit()
    db.refresh(car)
    return {
        **car.__dict__,
        "lokacija": (
            {
                "vietos_id": car.lokacija.vietos_id,
                "pavadinimas": car.lokacija.pavadinimas,
                "adresas": car.lokacija.adresas,
                "miestas": car.lokacija.miestas,
            } if car.lokacija else None
        ),
        "links": generate_links("cars", car.automobilio_id, ["update", "delete", "update_status"]),
    }


@router.patch("/{car_id}/status", response_model=CarOut, operation_id="updateCarStatus", dependencies=[Depends(require_perm(Perm.EDIT))])
def update_car_status(car_id: int, data: CarStatusUpdate, db: Session = Depends(get_db)):
    car = db.query(Car).filter(Car.automobilio_id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    car.automobilio_statusas = data.status
    db.commit()
    db.refresh(car)
    return {
        **car.__dict__,
        "lokacija": (
            {
                "vietos_id": car.lokacija.vietos_id,
                "pavadinimas": car.lokacija.pavadinimas,
                "adresas": car.lokacija.adresas,
                "miestas": car.lokacija.miestas,
            } if car.lokacija else None
        ),
        "links": generate_links("cars", car.automobilio_id, ["update", "delete", "update_status"]),
    }

@router.delete("/{car_id}", operation_id="deleteCar", dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_car(car_id: int, db: Session = Depends(get_db)):
    car = db.query(Car).filter(Car.automobilio_id == car_id).first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    db.delete(car)
    db.commit()
    return {"message": "Car deleted successfully"}
