"""Kliento rezervacijos kūrimas. Viena funkcija svetainės ir programėlės keliui – todėl rezultatas visada vienodas."""
import hashlib
import json
import re
from datetime import date
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.car import Car
from app.models.client import Client
from app.models.extra import Extra, ReservationExtra
from app.models.hold import HOLD_ACTIVE, HOLD_USED, Hold
from app.models.idempotency_key import IdempotencyKey
from app.models.reservation import Reservation
from app.services import availability_service, booking_rules, clock, pricing_service, rental_terms

IDEMPOTENCY_KEY_PATTERN = re.compile(r"^[A-Za-z0-9-]{16,64}$")


class ReservationError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _check_bookable(db: Session, customer: Client, automobilio_id: int, date_from: date, date_to: date) -> Car:
    car = availability_service.lock_car_row(db, automobilio_id)
    if not car:
        raise ReservationError(404, "Automobilis nerastas")
    if car.automobilio_statusas in availability_service.NOT_BOOKABLE_STATUSES:
        raise ReservationError(409, "Šis automobilis šiuo metu neišnuomojamas")
    availability_service.lock_client_row(db, customer.kliento_id)
    # Paties kliento laikymas netrukdo; kitų klientų laikymai, rezervacijos ir užsakymai – blokuoja.
    if availability_service.car_has_conflict(db, car.automobilio_id, date_from, date_to, ignore_holds_of=customer.kliento_id):
        raise ReservationError(409, "Automobilis jau užimtas pasirinktu laikotarpiu")
    if availability_service.client_has_conflict(db, customer.kliento_id, date_from, date_to):
        raise ReservationError(409, "Jau turite kitą rezervaciją/užsakymą šiomis dienomis")
    return car


# Sukuria rezervaciją (būsena „laukia“), bet transakcijos neužbaigia – commit daro kvietėjas,
# kad kartu būtų įrašyti ir susiję pakeitimai (laikymo būsena, idempotencijos raktas).
def create_customer_reservation(
    db: Session,
    customer: Client,
    automobilio_id: int,
    date_from: date,
    date_to: date,
    extra_codes: list[str] | None = None,
    pickup_hour: int | None = None,
    terms_version: str | None = None,
    expected_total: float | None = None,
) -> tuple[Reservation, Car]:
    try:
        booking_rules.validate_period(date_from, date_to)
        if pickup_hour is not None:
            booking_rules.validate_pickup_hour(pickup_hour)
            if booking_rules.pickup_moment_utc(date_from, pickup_hour) <= clock.utc_now():
                raise ReservationError(400, "Pasirinktas paėmimo laikas jau praėjo. Pasirinkite vėlesnį laiką.")
        extras = pricing_service.load_extras(db, extra_codes or [])
    except booking_rules.BookingRuleError as error:
        raise ReservationError(400, error.message)
    except pricing_service.PricingError as error:
        raise ReservationError(error.status, error.message)

    car = _check_bookable(db, customer, automobilio_id, date_from, date_to)
    if expected_total is not None:
        try:
            extras = pricing_service.load_extras(db, extra_codes or [], lock=True)
        except pricing_service.PricingError as error:
            raise ReservationError(error.status, error.message)
        quote = pricing_service.calculate(car.kaina_parai, (date_to - date_from).days, pricing_service.to_extra_prices(extras))
        if Decimal(str(expected_total)).quantize(Decimal("0.01")) != quote.viso:
            raise ReservationError(409, "Kaina pasikeitė. Peržiūrėkite naują sumą ir patvirtinkite dar kartą.")

    reservation = Reservation(
        kliento_id=customer.kliento_id,
        automobilio_id=car.automobilio_id,
        rezervacijos_pradzia=date_from,
        rezervacijos_pabaiga=date_to,
        busena="laukia",
        # Tarifai užfiksuojami dabar: vėlesni kainų pakeitimai šios rezervacijos nekeičia.
        kaina_parai=car.kaina_parai,
        paemimo_valanda=pickup_hour,
        salygu_versija=terms_version,
        salygos_priimtos=clock.utc_now_naive() if terms_version else None,
    )
    db.add(reservation)
    db.flush()
    for extra in extras:
        db.add(ReservationExtra(
            rezervacijos_id=reservation.rezervacijos_id, paslaugos_id=extra.paslaugos_id, kaina_parai=extra.kaina_parai
        ))
    db.flush()
    return reservation, car


# Rezervacijos kaina iš užfiksuotų tarifų – ta pati formulė kaip kainos pasiūlyme.
def reservation_quote(db: Session, reservation: Reservation, car: Car) -> pricing_service.Quote:
    rows = (
        db.query(Extra, ReservationExtra)
        .join(ReservationExtra, ReservationExtra.paslaugos_id == Extra.paslaugos_id)
        .filter(ReservationExtra.rezervacijos_id == reservation.rezervacijos_id)
        .order_by(Extra.paslaugos_id)
        .all()
    )
    extras = [pricing_service.ExtraPrice(extra.kodas, extra.pavadinimas, link.kaina_parai) for extra, link in rows]
    days = (reservation.rezervacijos_pabaiga - reservation.rezervacijos_pradzia).days
    # Senos rezervacijos neturi užfiksuoto tarifo – joms imama dabartinė automobilio kaina (esamas elgesys).
    rate = reservation.kaina_parai if reservation.kaina_parai is not None else car.kaina_parai
    return pricing_service.calculate(rate, days, extras)


def request_hash(laikymo_id: int, extra_codes: list[str], pickup_hour: int, terms_version: str, expected_total: float | None = None) -> str:
    values = [laikymo_id, sorted(extra_codes), pickup_hour, terms_version]
    if expected_total is not None:
        values.append(str(Decimal(str(expected_total)).quantize(Decimal("0.01"))))
    canonical = json.dumps(values, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _replayed_reservation(db: Session, kliento_id: int, key: str, body_hash: str) -> Reservation | None:
    stored = db.query(IdempotencyKey).filter_by(kliento_id=kliento_id, raktas=key).first()
    if not stored:
        return None
    if stored.uzklausos_maisa != body_hash:
        raise ReservationError(422, "Šis patvirtinimo raktas jau panaudotas kitam prašymui")
    return db.query(Reservation).filter_by(rezervacijos_id=stored.rezervacijos_id).first()


def _check_hold_and_terms(hold: Hold | None, terms_accepted: bool, terms_version: str) -> None:
    if not hold:
        raise ReservationError(404, "Laikymas nerastas")
    if hold.busena == HOLD_USED:
        raise ReservationError(409, "Ši rezervacija jau patvirtinta")
    if hold.busena != HOLD_ACTIVE or hold.galioja_iki <= clock.utc_now_naive():
        raise ReservationError(410, "Laikymo laikas baigėsi. Pasirinkite datas iš naujo.")
    if not terms_accepted:
        raise ReservationError(400, "Norint rezervuoti būtina sutikti su nuomos sąlygomis")
    if terms_version != rental_terms.TERMS_VERSION:
        raise ReservationError(409, "Nuomos sąlygos pasikeitė. Peržiūrėkite jas iš naujo.")


# Laikymo pavertimas rezervacija. Grąžina (rezervacija, automobilis, ar tai pakartotas prašymas).
def confirm_hold(
    db: Session,
    customer: Client,
    laikymo_id: int,
    idempotency_key: str,
    extra_codes: list[str],
    pickup_hour: int,
    terms_version: str,
    terms_accepted: bool,
    expected_total: float | None = None,
) -> tuple[Reservation, Car, bool]:
    if not IDEMPOTENCY_KEY_PATTERN.fullmatch(idempotency_key or ""):
        raise ReservationError(400, "Trūksta arba netinkama Idempotency-Key antraštė")
    # MySQL numatytasis collation raidžių dydžio neskiria, todėl raktas visur naudojamas mažosiomis raidėmis.
    idempotency_key = idempotency_key.lower()
    body_hash = request_hash(laikymo_id, extra_codes, pickup_hour, terms_version, expected_total)
    # Žemiau esantis rollback atšauktų laukiančius pakeitimus, todėl tikriname prieš pirmą užklausą (iki autoflush).
    if db.new or db.dirty or db.deleted:
        raise RuntimeError("confirm_hold reikalauja sesijos be laukiančių pakeitimų")
    kliento_id = customer.kliento_id
    candidate = db.query(Hold).filter_by(laikymo_id=laikymo_id, kliento_id=kliento_id).first()
    candidate_car_id = candidate.automobilio_id if candidate else None

    # Iki šios vietos sesija tik skaitė. Skaitymo transakcija užbaigiama, kad MySQL REPEATABLE READ
    # momentinė kopija būtų sukurta tik po kliento užrakto ir matytų konkurento commit.
    # Po rollback objektai pasenę, todėl iki užraktų naudojami tik išsaugoti ID.
    db.rollback()

    # Užraktų tvarka kaip kuriant laikymą: automobilis, tada klientas.
    if candidate_car_id is not None:
        availability_service.lock_car_row(db, candidate_car_id)
    # Kliento eilutės užraktas išrikiuoja du vienalaikius to paties kliento patvirtinimus vieną po kito.
    availability_service.lock_client_row(db, kliento_id)
    replayed = _replayed_reservation(db, kliento_id, idempotency_key, body_hash)
    if replayed:
        return replayed, db.get(Car, replayed.automobilio_id), True

    hold = db.query(Hold).filter_by(laikymo_id=laikymo_id, kliento_id=kliento_id).populate_existing().with_for_update().first()
    _check_hold_and_terms(hold, terms_accepted, terms_version)

    reservation, car = create_customer_reservation(
        db, customer, hold.automobilio_id, hold.pradzia, hold.pabaiga, extra_codes, pickup_hour, terms_version, expected_total
    )
    hold.busena = HOLD_USED
    hold.rezervacijos_id = reservation.rezervacijos_id
    db.add(IdempotencyKey(
        kliento_id=kliento_id, raktas=idempotency_key, uzklausos_maisa=body_hash,
        rezervacijos_id=reservation.rezervacijos_id, sukurta=clock.utc_now_naive(),
    ))
    try:
        db.commit()
    except IntegrityError:
        # Tas pats raktas ką tik įrašytas kito vienalaikio prašymo – grąžiname jo rezultatą.
        db.rollback()
        replayed = _replayed_reservation(db, kliento_id, idempotency_key, body_hash)
        if not replayed:
            raise ReservationError(409, "Rezervacijos patvirtinti nepavyko. Bandykite dar kartą.")
        return replayed, db.get(Car, replayed.automobilio_id), True
    db.refresh(reservation)
    return reservation, car, False
