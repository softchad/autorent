# Darbuotojų teisių (VIEW/EDIT/ADMIN) sistema - PAREIGOS (DB stulpelis) nusako, KOKIAS teises darbuotojas turi, naudojama endpoint'uose per require_perm(...) žemiau.
from enum import Enum
from fastapi import Depends, HTTPException
from app.api.deps import get_current_user

# "str, Enum" - šios reikšmės veikia IR kaip paprasti tekstai (pvz. palyginimui), IR kaip apsaugotas, baigtinis sąrašas (negalima netyčia parašyti "Perm.ADMNI" su klaida ir kad tai "praeitų").
class Perm(str, Enum):
    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"

# Tik REALIOS, duomenų bazėje naudojamos pareigos. Bet koks nežinomas vaidmuo (įskaitant None) automatiškai gauna TUŠČIĄ teisių rinkinį per "ROLE_PERMS.get(role, set())" žemiau - atskirai registruoti "Svečias" su tuščiu rinkiniu būtų perteklinė eilutė.
ROLE_PERMS = {
    "Administratorius": {Perm.VIEW, Perm.EDIT, Perm.ADMIN},
    "Vadybininkas": {Perm.VIEW, Perm.EDIT},
    "Mechanikas": {Perm.VIEW, Perm.EDIT},
    "Klientų aptarnavimas": {Perm.VIEW, Perm.EDIT},
}

# Patikrina, ar KONKRETUS vartotojas turi KONKREČIĄ teisę - "role" arba "pareigos" (du skirtingi galimi atributų vardai, nes funkcija kviečiama ir su Employee objektais, ir su ranka sukurtais testų/pagalbiniais vartotojais).
def has_perm(user, perm: Perm) -> bool:
    role = getattr(user, "role", None) or getattr(user, "pareigos", None)
    return perm in ROLE_PERMS.get(role, set())


# "Dependency factory" - funkcija, kuri GRĄŽINA kitą funkciją (ne tiesiog pati yra dependency); taip galima pasakyti "šitam endpoint'ui reikia KONKREČIOS teisės" per require_perm(Perm.ADMIN), ne rašyti atskirą sargą kiekvienai teisei ranka.
def require_perm(perm: Perm):
    def dep(user = Depends(get_current_user)):
        if not has_perm(user, perm):
            raise HTTPException(status_code=403, detail="Neturite teisės šiam veiksmui.")
        return user
    return dep
