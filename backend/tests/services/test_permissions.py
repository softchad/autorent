import pytest
from fastapi import HTTPException

from app.api.permissions import Perm, ROLE_PERMS, require_perm, has_perm


# Imituoja Employee objektą - leidžia require_perm/has_perm testuoti NEPRIKLAUSOMAI nuo to, ar realus vartotojas turėtų "role", ar "pareigos" atributą.
class DummyUser:
    # "role" ir "pareigos" nustatomi VIENODAI - šis objektas NEPARODO, kurį iš dviejų has_perm realiai skaito (tą atskirai patikrina test_has_perm_uses_pareigos_when_role_attribute_missing žemiau).
    def __init__(self, role: str | None):
        self.role = role
        self.pareigos = role


# ROLE_PERMS turi tik realias DB pareigas (žr. database/schema.sql seed) - "užfiksuoja" tikslų teisių rinkinį kiekvienam vaidmeniui, kad netyčinis pakeitimas permissions.py faile būtų pastebėtas.
def test_role_perms_mapping_contents():
    assert ROLE_PERMS["Administratorius"] == {Perm.VIEW, Perm.EDIT, Perm.ADMIN}
    assert ROLE_PERMS["Vadybininkas"] == {Perm.VIEW, Perm.EDIT}
    assert ROLE_PERMS["Mechanikas"] == {Perm.VIEW, Perm.EDIT}
    assert ROLE_PERMS["Klientų aptarnavimas"] == {Perm.VIEW, Perm.EDIT}


# VIEW turi veikti visiems žinomiems vaidmenims. Nežinomas vaidmuo (ar None) - 403.
def test_require_perm_view_allows_all_known_roles():
    dep = require_perm(Perm.VIEW)

    dep(user=DummyUser("Vadybininkas"))
    dep(user=DummyUser("Administratorius"))

    with pytest.raises(HTTPException) as exc:
        dep(user=DummyUser("NežinomasVaidmuo"))
    assert exc.value.status_code == 403


# EDIT leidžiama Vadybininkui ir Administratoriui, bet ne nežinomam vaidmeniui.
def test_require_perm_edit_blocks_unknown_role():
    dep = require_perm(Perm.EDIT)

    dep(user=DummyUser("Vadybininkas"))
    dep(user=DummyUser("Administratorius"))

    with pytest.raises(HTTPException) as exc:
        dep(user=DummyUser("NežinomasVaidmuo"))
    assert exc.value.status_code == 403
    assert exc.value.detail == "Neturite teisės šiam veiksmui."


# ADMIN turi tik Administratorius - kiti gauna 403.
def test_require_perm_admin_only_administratorius():
    dep = require_perm(Perm.ADMIN)

    dep(user=DummyUser("Administratorius"))

    for role in ("Vadybininkas", "Mechanikas", "Klientų aptarnavimas", "NežinomasVaidmuo", None):
        with pytest.raises(HTTPException) as exc:
            dep(user=DummyUser(role))
        assert exc.value.status_code == 403


# Tikras Employee modelis NETURI "role" atributo, tik "pareigos" - DummyUser aukščiau abu nustato VIENODAI, tad niekada realiai neištestuoja "or" atsarginio varianto; šis vartotojo objektas turi TIK "pareigos", kaip ir produkcijoje.
def test_has_perm_uses_pareigos_when_role_attribute_missing():
    # Vienkartinis konteineris vien šiam testui - neverta kelti į modulio lygį, nes niekas kitas faile neturi naudoti objekto BE "role".
    class PareigosOnlyUser:
        # Vienintelis atributas, kurį has_perm patikrina per "pareigos" fallback'ą - jokio "role" lauko.
        def __init__(self, pareigos):
            self.pareigos = pareigos

    assert has_perm(PareigosOnlyUser("Administratorius"), Perm.ADMIN) is True
    assert has_perm(PareigosOnlyUser("Mechanikas"), Perm.ADMIN) is False
