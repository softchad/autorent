"""Laikinas automobilio laikymas (soft hold), kol klientas programėlėje baigia rezervaciją."""
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.hold import HOLD_ACTIVE, HOLD_CANCELLED, HOLD_EXPIRED, Hold
from app.services import availability_service, booking_rules, clock

# Kiek minučių automobilis laikomas klientui.
HOLD_MINUTES = 10
# Vienas klientas vienu metu gali laikyti ne daugiau automobilių (OWASP API6: vienas vartotojas negali užblokuoti parko).
MAX_ACTIVE_HOLDS_PER_CUSTOMER = 2
# Tą patį automobilį per valandą galima užlaikyti ribotą kartų skaičių – kitaip laikymą būtų galima tęsti be galo.
MAX_HOLDS_PER_CAR_PER_HOUR = 3


class HoldError(Exception):
    """Laikymo sukurti negalima. status – HTTP kodas, message – tekstas klientui."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def is_active(hold: Hold, now: datetime) -> bool:
    return hold.busena == HOLD_ACTIVE and hold.galioja_iki > now


# Pažymi pasibaigusius laikymus. Užimtumui tai nebūtina (ten tikrinamas galioja_iki), bet DB būsena lieka tvarkinga.
def expire_stale_holds(db: Session, now: datetime) -> int:
    return (
        db.query(Hold)
        .filter(Hold.busena == HOLD_ACTIVE, Hold.galioja_iki <= now)
        .update({Hold.busena: HOLD_EXPIRED}, synchronize_session=False)
    )


# Aktyvūs laikymai, kurie kertasi su laikotarpiu [date_from, date_to).
def overlapping_active_holds(db: Session, automobilio_id: int, date_from: date, date_to: date, now: datetime):
    return db.query(Hold).filter(
        Hold.automobilio_id == automobilio_id,
        Hold.busena == HOLD_ACTIVE,
        Hold.galioja_iki > now,
        Hold.pradzia < date_to,
        Hold.pabaiga > date_from,
    )


def count_active_for_customer(db: Session, kliento_id: int, now: datetime) -> int:
    return (
        db.query(Hold)
        .filter(Hold.kliento_id == kliento_id, Hold.busena == HOLD_ACTIVE, Hold.galioja_iki > now)
        .count()
    )


def _count_recent_for_car(db: Session, kliento_id: int, automobilio_id: int, now: datetime) -> int:
    hour_ago = now - timedelta(hours=1)
    return (
        db.query(Hold)
        .filter(Hold.kliento_id == kliento_id, Hold.automobilio_id == automobilio_id, Hold.sukurta > hour_ago)
        .count()
    )


def _find_same_active_hold(db: Session, kliento_id: int, automobilio_id: int, date_from: date, date_to: date, now: datetime):
    return (
        db.query(Hold)
        .filter(
            Hold.kliento_id == kliento_id,
            Hold.automobilio_id == automobilio_id,
            Hold.pradzia == date_from,
            Hold.pabaiga == date_to,
            Hold.busena == HOLD_ACTIVE,
            Hold.galioja_iki > now,
        )
        .first()
    )


# Kliento ankstesnis laikymas tam pačiam automobiliui (kitoms datoms) nutraukiamas – galioja tik naujausias.
def _cancel_other_holds_for_car(db: Session, kliento_id: int, automobilio_id: int) -> None:
    db.query(Hold).filter(
        Hold.kliento_id == kliento_id, Hold.automobilio_id == automobilio_id, Hold.busena == HOLD_ACTIVE
    ).update({Hold.busena: HOLD_CANCELLED}, synchronize_session=False)


def _check_car_is_free(db: Session, customer: Client, automobilio_id: int, date_from: date, date_to: date, now: datetime) -> None:
    others = overlapping_active_holds(db, automobilio_id, date_from, date_to, now).filter(
        Hold.kliento_id != customer.kliento_id
    )
    if others.with_for_update().first() is not None:
        raise HoldError(409, "laikoma", "Šį automobilį šiuo metu rezervuoja kitas klientas. Pabandykite po kelių minučių.")
    # car_has_conflict dabar pati mato laikymus, todėl pirma tikriname juos (aiškesnis pranešimas), tada rezervacijas ir užsakymus.
    if availability_service.car_has_conflict(db, automobilio_id, date_from, date_to, ignore_holds_of=customer.kliento_id):
        raise HoldError(409, "uzimta", "Automobilis jau užimtas pasirinktu laikotarpiu")
    if availability_service.client_has_conflict(db, customer.kliento_id, date_from, date_to):
        raise HoldError(409, "kliento_konfliktas", "Jau turite kitą rezervaciją/užsakymą šiomis dienomis")


# Servisas pats užbaigia transakciją: sėkmės atveju commit, bet kokios klaidos atveju rollback ir ta pati klaida keliama toliau.
# Taip nepavykęs pakeitimas nepalieka sesijoje atšaukto ankstesnio laikymo, kurį vėlesnis commit įrašytų.
def create_hold(db: Session, customer: Client, automobilio_id: int, date_from: date, date_to: date) -> Hold:
    try:
        return _create_hold(db, customer, automobilio_id, date_from, date_to)
    except Exception:
        db.rollback()
        raise


def _create_hold(db: Session, customer: Client, automobilio_id: int, date_from: date, date_to: date) -> Hold:
    try:
        booking_rules.validate_period(date_from, date_to)
    except booking_rules.BookingRuleError as error:
        raise HoldError(400, error.code, error.message)

    # Užrakiname automobilio ir kliento eilutes – du vienalaikiai prašymai negali abu pamatyti „laisva“.
    car = availability_service.lock_car_row(db, automobilio_id)
    if not car:
        raise HoldError(404, "nerastas", "Automobilis nerastas")
    if car.automobilio_statusas in availability_service.NOT_BOOKABLE_STATUSES:
        raise HoldError(409, "neisnuomojamas", "Šis automobilis šiuo metu neišnuomojamas")
    availability_service.lock_client_row(db, customer.kliento_id)

    now = clock.utc_now_naive()
    expire_stale_holds(db, now)

    # Pakartotas prašymas (pvz. dvigubas paspaudimas) grąžina tą patį laikymą ir jo galiojimo nepratęsia.
    existing = _find_same_active_hold(db, customer.kliento_id, automobilio_id, date_from, date_to, now)
    if existing:
        db.commit()
        return existing

    if _count_recent_for_car(db, customer.kliento_id, automobilio_id, now) >= MAX_HOLDS_PER_CAR_PER_HOUR:
        raise HoldError(429, "per_daznai", "Šį automobilį laikėte per daug kartų. Pabandykite vėliau.")

    _cancel_other_holds_for_car(db, customer.kliento_id, automobilio_id)
    if count_active_for_customer(db, customer.kliento_id, now) >= MAX_ACTIVE_HOLDS_PER_CUSTOMER:
        raise HoldError(
            429, "limitas", f"Vienu metu galite laikyti ne daugiau kaip {MAX_ACTIVE_HOLDS_PER_CUSTOMER} automobilius."
        )

    _check_car_is_free(db, customer, automobilio_id, date_from, date_to, now)

    hold = Hold(
        kliento_id=customer.kliento_id,
        automobilio_id=automobilio_id,
        pradzia=date_from,
        pabaiga=date_to,
        sukurta=now,
        galioja_iki=now + timedelta(minutes=HOLD_MINUTES),
        busena=HOLD_ACTIVE,
    )
    db.add(hold)
    db.commit()
    db.refresh(hold)
    return hold


# Laikymas grąžinamas tik jo savininkui; svetimas ID atrodo kaip neegzistuojantis (OWASP API1).
def get_hold_for_customer(db: Session, laikymo_id: int, kliento_id: int) -> Hold | None:
    return db.query(Hold).filter(Hold.laikymo_id == laikymo_id, Hold.kliento_id == kliento_id).first()


def release_hold(db: Session, hold: Hold) -> Hold:
    if hold.busena == HOLD_ACTIVE:
        hold.busena = HOLD_CANCELLED
        db.commit()
        db.refresh(hold)
    return hold
