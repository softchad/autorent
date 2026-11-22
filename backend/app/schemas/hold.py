import math
from datetime import date, datetime, timezone

from pydantic import BaseModel

from app.models.hold import HOLD_ACTIVE, HOLD_EXPIRED, Hold
from app.services.hold_service import is_active


# kliento_id čia nėra – jis visada imamas iš prisijungimo tokeno.
class HoldCreate(BaseModel):
    automobilio_id: int
    date_from: date
    date_to: date


class HoldOut(BaseModel):
    laikymo_id: int
    automobilio_id: int
    pradzia: date
    pabaiga: date
    busena: str
    galioja_iki: datetime
    # Serverio laikas atsakymo momentu – programėlė pagal jį sinchronizuoja laikmatį.
    serverio_laikas: datetime
    liko_sekundziu: int


def to_hold_out(hold: Hold, now_naive_utc: datetime) -> HoldOut:
    # Ta pati taisyklė kaip hold_service.is_active: laikymas aktyvus, kol galioja_iki > dabar.
    active = is_active(hold, now_naive_utc)
    # Laikas baigėsi, bet DB būsena dar neatnaujinta – klientui vis tiek rodome „pasibaigęs“.
    status = HOLD_EXPIRED if hold.busena == HOLD_ACTIVE and not active else hold.busena
    # Apvalinama į viršų, kad paskutinė sekundės dalis nebūtų rodoma kaip 0.
    remaining = math.ceil((hold.galioja_iki - now_naive_utc).total_seconds()) if active else 0
    return HoldOut(
        laikymo_id=hold.laikymo_id,
        automobilio_id=hold.automobilio_id,
        pradzia=hold.pradzia,
        pabaiga=hold.pabaiga,
        busena=status,
        galioja_iki=hold.galioja_iki.replace(tzinfo=timezone.utc),
        serverio_laikas=now_naive_utc.replace(tzinfo=timezone.utc),
        liko_sekundziu=remaining,
    )
