from enum import Enum
from fastapi import Depends, HTTPException
from app.api.deps import get_current_user

class Perm(str, Enum):
    VIEW = "view"
    EDIT = "edit"
    ADMIN = "admin"

ROLE_PERMS = {
    "Svečias": set(),
    "Emplo": {Perm.VIEW, Perm.EDIT},
    "Admin": {Perm.VIEW, Perm.EDIT, Perm.ADMIN},
    "Administratorius": {Perm.VIEW, Perm.EDIT, Perm.ADMIN},
    "Vadybininkas": {Perm.VIEW, Perm.EDIT},
    "Mechanikas": {Perm.VIEW, Perm.EDIT},
    "Klientų aptarnavimas": {Perm.VIEW, Perm.EDIT},
}

def has_perm(user, perm: Perm) -> bool:
    role = getattr(user, "role", None) or getattr(user, "pareigos", None)
    return perm in ROLE_PERMS.get(role, set())


def require_perm(perm: Perm):
    def dep(user = Depends(get_current_user)):
        if not has_perm(user, perm):
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep
