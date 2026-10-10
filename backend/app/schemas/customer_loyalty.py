# Kliento lojalumo programos atsakymų formos - abi grąžinamos TIK su aiškiais raktiniais argumentais (žr. customer_loyalty.py endpoint'ą), niekada tiesiai iš ORM objekto.
from datetime import datetime
from pydantic import BaseModel


# VIENAS uždirbtas atlygis - "busena" yra "neisnaudotas" arba "isnaudotas" (žr. LoyaltyReward modelį), panaudojimo_data užpildoma TIK kai jis panaudotas.
class LoyaltyRewardOut(BaseModel):
    atlygio_id: int
    etapo_numeris: int
    busena: str
    verte_eur: float
    sukurimo_data: datetime | None = None
    panaudojimo_data: datetime | None = None


# Bendra kliento lojalumo būsena - naudojama paskyros puslapyje parodyti progresą iki kito atlygio. "progresas_dabartiniame_etape" lieka LYGUS "etapo_dydis" (ne krenta į 0), kol naujausias uždirbtas atlygis dar neišnaudotas - kitaip klientas savo PASKUTINIO etapo užbaigimo net nepamatytų, juosta jau rodytų kitą, tuščią etapą.
class LoyaltyStatusOut(BaseModel):
    uzbaigtu_nuomu_skaicius: int
    progresas_dabartiniame_etape: int
    etapo_dydis: int
    atlygio_verte_eur: float
    atlygiai: list[LoyaltyRewardOut]


# Atlygio panaudojimo atsakymas - skirtingai nuo LoyaltyRewardOut aukščiau, prideda PATĮ sugeneruotą nuolaidos kodą, kurį klientas turi pamatyti IŠ KARTO (žr. customer_loyalty.py redeem_reward).
class RedeemRewardOut(LoyaltyRewardOut):
    kodas: str
