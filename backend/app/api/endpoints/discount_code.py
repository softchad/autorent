# Kliento nuolaidos kodų sąrašas - PATS kodų KŪRIMAS vyksta kitur (lojalumo atlygis - customer_loyalty.py redeem_reward, aptarnavimo kompensacija - staff_support.py), šis failas TIK rodo klientui, kokius kodus jis turi.
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_customer
from app.models.client import Client
from app.models.discount_code import DiscountCode
from app.schemas.discount_code import DiscountCodeOut

router = APIRouter(prefix="/customer/discount-codes", tags=["Customer Loyalty"])


# Grąžina VISUS kliento kodus (ir panaudotus, ir ne) - naudotas kodas rodomas paskyroje kaip istorija, kad klientas matytų, kur jį panaudojo.
@router.get("", response_model=list[DiscountCodeOut], operation_id="getCustomerDiscountCodes")
def list_discount_codes(
    db: Session = Depends(get_db),
    current_customer: Client = Depends(get_current_customer),
):
    codes = (
        db.query(DiscountCode)
        .filter(DiscountCode.kliento_id == current_customer.kliento_id)
        .order_by(DiscountCode.sukurimo_data.desc())
        .all()
    )
    # "pastaba=None" VISADA, net jei DB eilutėje ji užpildyta - tai darbuotojo VIDINĖ priežastis (žr. staff_support.py issue_discount_code), klientas jos niekada neturi matyti, net per šį endpoint'ą.
    return [
        DiscountCodeOut(
            kodo_id=c.kodo_id,
            kodas=c.kodas,
            verte_eur=c.verte_eur,
            kilme=c.kilme,
            pastaba=None,
            sukurimo_data=c.sukurimo_data,
            panaudojimo_data=c.panaudojimo_data,
        )
        for c in codes
    ]
