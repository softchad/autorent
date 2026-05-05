from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.repositories import employee as employee_repo
from app.schemas.employee import EmployeeOut, EmployeeUpdate
from app.schemas.employee import EmployeeCreate
from app.api.deps import get_db
from app.services.auth_service import get_password_hash
from utils.hateoas import generate_links
from app.api.deps import get_current_user
from app.api.permissions import require_perm, Perm

router = APIRouter(
    prefix="/employees",
    tags=["Employees"],
    dependencies=[Depends(get_current_user)]
)

@router.post("/", response_model=EmployeeOut, operation_id="createEmployee",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    if employee_repo.get_by_email(db, data.el_pastas):
        raise HTTPException(status_code=400, detail="Email already exists")

    employee_dict = data.dict()
    employee_dict["slaptazodis"] = get_password_hash(employee_dict["slaptazodis"])
    employee = employee_repo.create_employee(db, employee_dict)
    return {
        **employee.__dict__,
        "links": generate_links("employees", employee.darbuotojo_id, ["update", "delete"])
    }

@router.get("/", response_model=list[EmployeeOut], operation_id="getAllEmployees",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_employees(db: Session = Depends(get_db)):
    employees = employee_repo.get_all(db)
    return [
        {
            **emp.__dict__,
            "links": generate_links("employees", emp.darbuotojo_id, ["update", "delete"])
        }
        for emp in employees
    ]

@router.get("/{employee_id}", response_model=EmployeeOut, operation_id="getEmployee",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    employee = employee_repo.get_by_id(db, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {
        **employee.__dict__,
        "links": generate_links("employees", employee.darbuotojo_id, ["update", "delete"])
    }

@router.put("/{employee_id}", response_model=EmployeeOut, operation_id="updateEmployee",
            dependencies=[Depends(require_perm(Perm.EDIT))])
def update_employee(employee_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    updates = data.dict(exclude_unset=True)

    if "slaptazodis" in updates:
        updates["slaptazodis"] = get_password_hash(updates["slaptazodis"])

    updated = employee_repo.update(db, employee_id, updates)

    if not updated:
        raise HTTPException(status_code=404, detail="Employee not found")

    return {
        **updated.__dict__,
        "links": generate_links("employees", updated.darbuotojo_id, ["update", "delete"])
    }

@router.delete("/{employee_id}", operation_id="deleteEmployee",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_employee(employee_id: int, db: Session = Depends(get_db)):
    deleted = employee_repo.delete(db, employee_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deleted successfully"}
