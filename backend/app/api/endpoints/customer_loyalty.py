# Kliento lojalumo programa - kas REWARD_MILESTONE_SIZE užbaigtų nuomų, klientas uždirba vieną atlygį (REWARD_VALUE_EUR).
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError  # klaida, kurią duomenų bazė meta, kai veiksmas atmetamas dėl susijusių įrašų (žr. _ensure_rewards_up_to_date žemiau)
from sqlalchemy.orm import Session
from sqlalchemy import func  # SQL agregavimo funkcijos (čia - func.count(), skaičiuoti užbaigtas nuomas)
from datetime import datetime, timezone

from app.api.deps import get_db, get_current_customer  # get_current_customer - "kas prisijungęs" klientams (ne darbuotojams)
from app.models.client import Client
from app.models.order import Order
from app.models.loyalty_reward import LoyaltyReward
from app.schemas.customer_loyalty import LoyaltyStatusOut, LoyaltyRewardOut, RedeemRewardOut
from app.services import discount_code_service

router = APIRouter(prefix="/customer/loyalty", tags=["Customer Loyalty"])

REWARD_MILESTONE_SIZE = 5  # kas kiek užbaigtų nuomų duodamas atlygis
REWARD_VALUE_EUR = 20.0  # vieno atlygio vertė eurais

# Patikrina, ar klientas jau uždirbo naujų etapų (žr. REWARD_MILESTONE_SIZE) nuo paskutinio patikrinimo, ir sukuria trūkstamus atlygius.
def _ensure_rewards_up_to_date(db: Session, kliento_id: int, completed_count: int) -> None:
    earned_milestones = completed_count // REWARD_MILESTONE_SIZE
    if earned_milestones == 0:
        return

    # Jau turimi etapų numeriai - kad NEBANDYTUME antrą kartą sukurti to paties atlygio.
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
            # unique(kliento_id, etapo_numeris) DB apribojimas - kitas lygiagretus kvietimas jau sukūrė šį etapą, tai ne klaida.
            db.rollback()


# Grąžina kliento lojalumo progresą - kiek nuomų užbaigta, kiek liko iki kito atlygio, ir visų uždirbtų atlygių sąrašą.
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

    # Jei klientas nuo paskutinio patikrinimo pasiekė naują etapą - atlygis sukuriamas DABAR, prieš grąžinant atsakymą.
    _ensure_rewards_up_to_date(db, current_customer.kliento_id, completed_count)

    rewards = (
        db.query(LoyaltyReward)
        .filter(LoyaltyReward.kliento_id == current_customer.kliento_id)
        .order_by(LoyaltyReward.etapo_numeris.desc())
        .all()
    )

    # "%" - kiek nuomų įskaičiuota į DABARTINĮ, dar nebaigtą etapą; BET jei klientas TIK KĄ pasiekė etapą (kartotinis skaičius, progresas natūraliai krenta į 0) IR tas etapas dar NEIŠSNAUDOTAS - juosta rodoma PILNA (etapo_dydis), ne tuščia, kol klientas pats jo nepasiima.
    progresas = completed_count % REWARD_MILESTONE_SIZE
    if progresas == 0 and completed_count > 0:
        paskutinis_etapas = completed_count // REWARD_MILESTONE_SIZE
        naujausias = next((r for r in rewards if r.etapo_numeris == paskutinis_etapas), None)
        if naujausias and naujausias.busena == "neisnaudotas":
            progresas = REWARD_MILESTONE_SIZE

    return LoyaltyStatusOut(
        uzbaigtu_nuomu_skaicius=completed_count,
        progresas_dabartiniame_etape=progresas,
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


# Pažymi kliento atlygį kaip panaudotą IR sugeneruoja TIKRĄ nuolaidos kodą ("AUTORENT" + 6 skaitmenys) - galima tik VIENĄ kartą (žr. busena patikrą žemiau); kodą klientas panaudoja užsakymo kūrimo metu (žr. order.py "nuolaidos_kodas" lauką).
@router.post("/rewards/{atlygio_id}/redeem", response_model=RedeemRewardOut, operation_id="redeemCustomerLoyaltyReward")
def redeem_reward(
    atlygio_id: int,
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    # with_for_update() UŽRAKINA šią eilutę - be šito du vienu metu atėję redeem prašymai abu spėtų pamatyti "neisnaudotas" prieš bet kuriam užsicommitinant, ir atlygis būtų panaudotas dukart (IR sugeneruotų DU kodus už TĄ PATĮ atlygį).
    reward = (
        db.query(LoyaltyReward)
        .filter(LoyaltyReward.atlygio_id == atlygio_id, LoyaltyReward.kliento_id == current_customer.kliento_id)
        .with_for_update()
        .first()
    )
    if not reward:
        raise HTTPException(status_code=404, detail="Atlygis nerastas")
    if reward.busena != "neisnaudotas":
        raise HTTPException(status_code=409, detail="Atlygis jau panaudotas")

    # issue_code TIK flush'ina (neCOMMIT'ina) - kodo įrašymas ir atlygio busena='isnaudotas' commit'inami VIENU db.commit() žemiau, kad procesui nulūžus PRIEŠ commit'ą niekas neliktų "pusiau" panaudota (vien kodas be atlygio pažymėjimo, arba atvirkščiai).
    code = discount_code_service.issue_code(
        db, current_customer.kliento_id, REWARD_VALUE_EUR, "lojalumas", f"{REWARD_MILESTONE_SIZE} nuomų lojalumo atlygis (etapas #{reward.etapo_numeris})"
    )

    reward.busena = "isnaudotas"
    reward.panaudojimo_data = datetime.now(timezone.utc)
    db.commit()
    db.refresh(reward)
    db.refresh(code)

    return RedeemRewardOut(
        atlygio_id=reward.atlygio_id,
        etapo_numeris=reward.etapo_numeris,
        busena=reward.busena,
        verte_eur=REWARD_VALUE_EUR,
        sukurimo_data=reward.sukurimo_data,
        panaudojimo_data=reward.panaudojimo_data,
        kodas=code.kodas,
    )
