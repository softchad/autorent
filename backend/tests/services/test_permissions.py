import pytest
from fastapi import HTTPException

from app.api.permissions import Perm, ROLE_PERMS, require_perm


class DummyUser:
    def __init__(self, role: str | None):
        self.role = role
        self.pareigos = role   # require_perm tikrina abu


def test_role_perms_mapping_contents():
    """Patikrina, kad ROLE_PERMS turi teisingas roles ir teises."""
    assert "Guest" in ROLE_PERMS
    assert "Emplo" in ROLE_PERMS
    assert "Admin" in ROLE_PERMS

    assert ROLE_PERMS["Guest"] == {Perm.VIEW}
    assert ROLE_PERMS["Emplo"] == {Perm.VIEW, Perm.EDIT}
    assert ROLE_PERMS["Admin"] == {Perm.VIEW, Perm.EDIT, Perm.ADMIN}


def test_require_perm_view_allows_all_roles():
    """VIEW turi veikti Guest, Emplo ir Admin – be klaidos."""
    dep = require_perm(Perm.VIEW)

    dep(user=DummyUser("Guest"))
    dep(user=DummyUser("Emplo"))
    dep(user=DummyUser("Admin"))


def test_require_perm_edit_blocks_guest():
    """EDIT leidžiama Emplo ir Admin, bet ne Guest."""
    dep = require_perm(Perm.EDIT)

    dep(user=DummyUser("Emplo"))
    dep(user=DummyUser("Admin"))

    with pytest.raises(HTTPException) as exc:
        dep(user=DummyUser("Guest"))
    assert exc.value.status_code == 403
    assert exc.value.detail == "Forbidden"


def test_require_perm_admin_only_admin():
    """ADMIN turi tik Admin – kiti gauna 403."""
    dep = require_perm(Perm.ADMIN)

    dep(user=DummyUser("Admin"))

    for role in ("Emplo", "Guest", "SomethingElse", None):
        with pytest.raises(HTTPException) as exc:
            dep(user=DummyUser(role))
        assert exc.value.status_code == 403
