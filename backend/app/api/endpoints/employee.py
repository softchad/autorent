# Darbuotojų CRUD endpointai - darbuotojų administravimo sąsajai (ne pats prisijungimas, tas yra auth.py faile).
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError  # klaida, kurią duomenų bazė meta, kai veiksmas atmetamas dėl susijusių įrašų (žr. delete_employee žemiau)
from app.models.employee import Employee
from app.schemas.employee import EmployeeOut, EmployeeUpdate
from app.schemas.employee import EmployeeCreate
from app.api.deps import get_db, get_employee_by_email
from app.services.auth_service import get_password_hash  # slaptažodžio šifravimas - DB niekada nelaiko tikro slaptažodžio, tik jo hash'ą
from utils.hateoas import generate_links
from app.api.deps import get_current_user
from app.api.permissions import require_perm, has_perm, Perm  # require_perm - "visas arba nieko" sargas prieš VISĄ endpoint'ą; has_perm - tiksliau patikrinti VIENĄ konkretų vartotoją ranka (žr. update_employee žemiau)

# Šiuos 4 laukus (rolė, atlyginimas, slaptažodis, el. paštas) per PUT keisti gali TIK administratorius - kitaip EDIT teisę turintis darbuotojas galėtų pats sau (ar kitam) pasikelti rolę į Administratorių, arba pasikeisti svetimą slaptažodį.
ADMIN_ONLY_FIELDS = {"pareigos", "atlyginimas", "slaptazodis", "el_pastas"}

# Administratorius užrakiname ta pačia ID tvarka, kad lygiagretūs teisių pakeitimai negalėtų abu pašalinti paskutinės administravimo paskyros.
def _lock_administrators(db: Session) -> list[Employee]:
    return db.query(Employee).filter(Employee.pareigos == "Administratorius").order_by(Employee.darbuotojo_id).populate_existing().with_for_update().all()

router = APIRouter(
    prefix="/employees",
    tags=["Employees"],
    dependencies=[Depends(get_current_user)]
)

# Naujo darbuotojo paskyros sukūrimas - reikalauja ADMIN teisės, nes bet kas su mažesne teise galėtų pats sau prisikurti aukštesnę paskyrą.
@router.post("/", response_model=EmployeeOut, operation_id="createEmployee",
             dependencies=[Depends(require_perm(Perm.ADMIN))])
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    if get_employee_by_email(db, data.el_pastas):
        raise HTTPException(status_code=409, detail="Toks el. paštas jau užregistruotas")

    employee_dict = data.dict()
    employee_dict["slaptazodis"] = get_password_hash(employee_dict["slaptazodis"])
    employee = Employee(**employee_dict)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return {
        **employee.__dict__,
        "links": generate_links("employees", employee.darbuotojo_id, ["update", "delete"])
    }

# Grąžina VISŲ darbuotojų sąrašą - reikalauja bent VIEW teisės. VIEW teisę turi IR Vadybininkas/Mechanikas/Klientų aptarnavimas (ne tik administratorius, žr. permissions.py ROLE_PERMS), tad KOLEGŲ atlyginimas čia NERODOMAS niekam, kas nėra administratorius - IŠSKYRUS savo pačio eilutę (tai ne paslaptis NUO savęs).
@router.get("/", response_model=list[EmployeeOut], operation_id="getAllEmployees",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_employees(db: Session = Depends(get_db), current_user: Employee = Depends(get_current_user)):
    employees = db.query(Employee).all()
    is_admin = has_perm(current_user, Perm.ADMIN)
    return [
        {
            **emp.__dict__,
            "atlyginimas": emp.atlyginimas if (is_admin or emp.darbuotojo_id == current_user.darbuotojo_id) else None,
            "links": generate_links("employees", emp.darbuotojo_id, ["update", "delete"])
        }
        for emp in employees
    ]

# Redaguoja esamą darbuotoją - bet kuris EDIT teisę turintis darbuotojas gali keisti SAVO įprastus laukus, bet ADMIN_ONLY_FIELDS blokuojami žemiau, jei prašantysis pats nėra administratorius.
@router.put("/{employee_id}", response_model=EmployeeOut, operation_id="updateEmployee",
            dependencies=[Depends(require_perm(Perm.EDIT))])
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    updates = data.dict(exclude_unset=True)
    is_admin = has_perm(current_user, Perm.ADMIN)

    # EDIT teisė (bet ne ADMIN) leidžia redaguoti TIK SAVO paskyrą - kitaip bet kuris Vadybininkas/Mechanikas/Klientų aptarnavimas (visi turi bendrą EDIT teisę) galėtų keisti KITO darbuotojo (net administratoriaus) vardą/telefoną vien dėl to, kad require_perm(Perm.EDIT) aukščiau tikrina TIK bendrą teisę, ne nuosavybę.
    if not is_admin and employee_id != current_user.darbuotojo_id:
        raise HTTPException(status_code=403, detail="Galite redaguoti tik savo paskyrą")

    # "&" - sankirta tarp SIŲSTŲ laukų ir ADMIN_ONLY_FIELDS; jei bent vienas sutampa IR prašantysis nėra administratorius, visa užklausa atmetama.
    if ADMIN_ONLY_FIELDS & updates.keys() and not is_admin:
        raise HTTPException(
            status_code=403,
            detail="Tik administratorius gali keisti pareigas, atlyginimą, el. paštą ar slaptažodį",
        )

    if "slaptazodis" in updates:
        updates["slaptazodis"] = get_password_hash(updates["slaptazodis"])

    admins = _lock_administrators(db) if is_admin else []
    updated = db.query(Employee).filter(Employee.darbuotojo_id == employee_id).populate_existing().first()
    if not updated:
        raise HTTPException(status_code=404, detail="Darbuotojas nerastas")
    # jei ŠIS darbuotojas PAČIU METU yra administratorius IR keičiama rolė Į kitą (ne administratoriaus), PRIVALO likti BENT VIENAS KITAS administratorius - kitaip nebūtų NIEKO, kas galėtų bet ką administruoti (net atstatyti ŠITĄ pačią rolę atgal), kol kažkas rankomis nepataisytų DB.
    if (
        updated.pareigos == "Administratorius"
        and updates.get("pareigos") is not None
        and updates["pareigos"] != "Administratorius"
    ):
        other_admins = sum(admin.darbuotojo_id != employee_id for admin in admins)
        if other_admins == 0:
            raise HTTPException(status_code=409, detail="Negalima pakeisti paskutinio administratoriaus rolės.")
    # Forma gali atsiųsti nepakeistą el. paštą, tačiau tai nėra paskyros pakeitimas ir neturi nutraukti prisijungimo.
    if updates.get("el_pastas") == updated.el_pastas:
        updates.pop("el_pastas", None)
    for key, value in updates.items():
        setattr(updated, key, value)
    if "el_pastas" in updates:
        # JWT "sub" yra darbuotojo_id (NE el_pastas, žr. auth_service.create_staff_token), tad vien el. pašto keitimas savaime NEpanaikintų seno tokeno - padidinus "token_version", SENAS tokenas (su SENU "ver") nebeatpažįstamas. Be šito, jei šis el. paštas vėliau "atlaisvintų" ir jį užregistruotų KITAS darbuotojas, senas tokenas galėtų klaidingai atpažinti TĄ naują paskyrą .
        updated.token_version += 1
    db.commit()
    db.refresh(updated)

    return {
        **updated.__dict__,
        "links": generate_links("employees", updated.darbuotojo_id, ["update", "delete"])
    }

# Ištrina darbuotoją - reikalauja ADMIN teisės; jei su juo susieti kiti įrašai (pvz. užsakymai, kuriuose jis buvo aptarnaujantis darbuotojas), DB atmeta ištrynimą ir vartotojui grąžinama aiški 409 klaida, ne neaiškus 500.
@router.delete("/{employee_id}", operation_id="deleteEmployee",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    admins = _lock_administrators(db)
    employee = db.query(Employee).filter(Employee.darbuotojo_id == employee_id).populate_existing().first()
    if not employee:
        raise HTTPException(status_code=404, detail="Darbuotojas nerastas")
    # lygiai ta pati priežastis, kaip update_employee aukščiau - paskutinio administratoriaus IŠTRYNIMAS paliktų sistemą be NIEKO, kas galėtų administruoti.
    if employee.pareigos == "Administratorius":
        other_admins = sum(admin.darbuotojo_id != employee_id for admin in admins)
        if other_admins == 0:
            raise HTTPException(status_code=409, detail="Negalima ištrinti paskutinio administratoriaus.")
    try:
        db.delete(employee)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Darbuotojo ištrinti negalima - su juo susiję užsakymai ar kiti įrašai.",
        )
    return {"message": "Employee deleted successfully"}
