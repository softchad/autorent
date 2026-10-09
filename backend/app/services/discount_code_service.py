# Nuolaidos kodų generavimas ir panaudojimas - bendra logika abiem kilmėms ("lojalumas" IR "aptarnavimas"), kad kodo formatas ir panaudojimo taisyklės niekada neišsiskirtų tarp jų.
import random
from sqlalchemy.orm import Session
from app.models.discount_code import DiscountCode

CODE_PREFIX = "AUTORENT"
# 6 skaitmenys - 0-999999, visada papildomi nuliais iš kairės (žr. generate_unique_code), kad kodas būtų vienodo ilgio.
CODE_DIGITS = 6


# Sukuria "AUTORENT" + 6 atsitiktinius skaitmenis ir patikrina DB, kad TOKS kodas jau neegzistuoja - itin maža tikimybė (1 iš 1 000 000), bet patikrinama vis tiek, nes "unique" DB apribojimas kitaip mestų klaidą vartotojui, ne tyliai pabandytų kitą kodą.
def generate_unique_code(db: Session) -> str:
    while True:
        candidate = f"{CODE_PREFIX}{random.randint(0, 10**CODE_DIGITS - 1):0{CODE_DIGITS}d}"
        exists = db.query(DiscountCode).filter(DiscountCode.kodas == candidate).first()
        if not exists:
            return candidate


# Sukuria IR prideda naują nuolaidos kodą konkrečiam klientui - naudojama IR lojalumo atlygio panaudojimo (customer_loyalty.py), IR darbuotojo aptarnavimo kompensacijos (staff_support.py) atvejais. "flush", NE "commit" - kodas turi gauti kodo_id/sukurimo_data TOJE PAČIOJE transakcijoje, kurią kviečiantis kodas (žr. customer_loyalty.py redeem_reward) vėliau commit'ina KARTU su savo pačios pakeitimu, kad abu įrašai atsirastų arba dingtų KARTU, ne vienas be kito.
def issue_code(db: Session, kliento_id: int, verte_eur: float, kilme: str, pastaba: str | None) -> DiscountCode:
    code = DiscountCode(
        kodas=generate_unique_code(db),
        kliento_id=kliento_id,
        verte_eur=verte_eur,
        kilme=kilme,
        pastaba=pastaba,
    )
    db.add(code)
    db.flush()
    return code


# Suranda GALIOJANTĮ (nepanaudotą, priklausantį TAM kliento_id) kodą - grąžina None, jei neegzistuoja/svetimas/jau panaudotas, kad kviečiantis endpoint'as pats nuspręstų, kokį HTTP klaidos pranešimą rodyti.
def find_valid_code(db: Session, kodas: str, kliento_id: int) -> DiscountCode | None:
    code = (
        db.query(DiscountCode)
        .filter(DiscountCode.kodas == kodas.strip().upper(), DiscountCode.kliento_id == kliento_id)
        .with_for_update()
        .first()
    )
    if not code or code.panaudojimo_data is not None:
        return None
    return code
