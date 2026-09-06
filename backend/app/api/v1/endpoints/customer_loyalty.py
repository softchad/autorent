# Kliento lojalumo programa: kas REWARD_MILESTONE_SIZE užbaigtų nuomų (Uzsakymai su
# uzsakymo_busena='užbaigta') suteikia vieną atlygį. Tai PAVYZDINĖ taisyklė (žr.
# docs/AUTORENT_PLETROS_PLANAS.md skyrių 5) - dydžiai lengvai keičiami, kol nėra
# realios mokėjimų apskaitos, kriterijus yra darbuotojo patvirtintas užbaigimas,
# ne apmokėjimas.
#
# Atlygių įrašai kuriami "gauk arba sukurk" būdu kiekvieną kartą, kai klientas
# atsidaro /customer/loyalty - ne atskirame įvykyje, kai užsakymas pažymimas
# užbaigtu (tai reikštų keisti esamą darbuotojų order.py endpointą). unique
# (kliento_id, etapo_numeris) apsaugo nuo dvigubo to paties etapo sukūrimo net
# jei du užklausimai atvyksta vienu metu.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone

from app.api.deps import get_db, get_current_customer
from app.models.client import Client
from app.models.order import Order
from app.models.loyalty_reward import LoyaltyReward
from app.schemas.customer_loyalty import LoyaltyStatusOut, LoyaltyRewardOut

router = APIRouter(prefix="/customer/loyalty", tags=["Customer Loyalty"])

REWARD_MILESTONE_SIZE = 5
REWARD_VALUE_EUR = 20.0


def _ensure_rewards_up_to_date(db: Session, kliento_id: int, completed_count: int) -> None:
    earned_milestones = completed_count // REWARD_MILESTONE_SIZE
    if earned_milestones == 0:
        return

    existing = {
        row[0]
        for row in db.query(LoyaltyReward.etapo_numeris).filter(LoyaltyReward.kliento_id == kliento_id).all()
    }
    for etapas in range(1, earned_milestones + 1):
        if etapas in existing:
            continue
        new_reward = LoyaltyReward(kliento_id=kliento_id, etapo_numeris=etapas)
        db.add(new_reward)
        try:
            db.commit()
            db.refresh(new_reward)
        except IntegrityError:
            # Kitas lygiagretus užklausimas jau sukūrė šį etapą - tai ne klaida.
            db.rollback()


@router.get("", response_model=LoyaltyStatusOut, operation_id="getCustomerLoyaltyStatus")
def get_loyalty_status(
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    completed_count = (
        db.query(func.count(Order.uzsakymo_id))
        .filter(Order.kliento_id == current_customer.kliento_id, Order.uzsakymo_busena == "užbaigta")
        .scalar()
    ) or 0

    _ensure_rewards_up_to_date(db, current_customer.kliento_id, completed_count)

    rewards = (
        db.query(LoyaltyReward)
        .filter(LoyaltyReward.kliento_id == current_customer.kliento_id)
        .order_by(LoyaltyReward.etapo_numeris.desc())
        .all()
    )

    return LoyaltyStatusOut(
        uzbaigtu_nuomu_skaicius=completed_count,
        progresas_dabartiniame_etape=completed_count % REWARD_MILESTONE_SIZE,
        etapo_dydis=REWARD_MILESTONE_SIZE,
        atlygio_verte_eur=REWARD_VALUE_EUR,
        atlygiai=[
            LoyaltyRewardOut(
                atlygio_id=r.atlygio_id,
                etapo_numeris=r.etapo_numeris,
                busena=r.busena,
                verte_eur=REWARD_VALUE_EUR,
                sukurimo_data=r.sukurimo_data,
                panaudojimo_data=r.panaudojimo_data,
            )
            for r in rewards
        ],
    )


@router.post("/rewards/{atlygio_id}/redeem", response_model=LoyaltyRewardOut, operation_id="redeemCustomerLoyaltyReward")
def redeem_reward(
    atlygio_id: int,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    reward = (
        db.query(LoyaltyReward)
        .filter(LoyaltyReward.atlygio_id == atlygio_id, LoyaltyReward.kliento_id == current_customer.kliento_id)
        .first()
    )
    if not reward:
        raise HTTPException(status_code=404, detail="Atlygis nerastas")
    if reward.busena != "neisnaudotas":
        raise HTTPException(status_code=409, detail="Atlygis jau panaudotas")

    reward.busena = "isnaudotas"
    reward.panaudojimo_data = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reward)

    return LoyaltyRewardOut(
        atlygio_id=reward.atlygio_id,
        etapo_numeris=reward.etapo_numeris,
        busena=reward.busena,
        verte_eur=REWARD_VALUE_EUR,
        sukurimo_data=reward.sukurimo_data,
        panaudojimo_data=reward.panaudojimo_data,
    )
