from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import client as schemas_client
from app.schemas import order as schemas_order

from app.repositories import client as repo
from app.repositories import order as order_repo
from utils.hateoas import generate_links
from app.api.deps import get_current_user

from app.api.permissions import require_perm, Perm

router = APIRouter(
    prefix="/clients",
    dependencies=[Depends(get_current_user)]
)


@router.get("/", response_model=list[schemas_client.ClientOut], operation_id="getAllClients",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_all_clients(db: Session = Depends(get_db)):
    clients = repo.get_all(db)
    return [
        {
            **client.__dict__,
            "links": generate_links("clients", client.kliento_id, ["update", "delete"])
        }
        for client in clients
    ]


@router.get("/{kliento_id}", response_model=schemas_client.ClientOut, operation_id="getClientById",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_client(kliento_id: int, db: Session = Depends(get_db)):
    client = repo.get_by_id(db, kliento_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return {
        **client.__dict__,
        "links": generate_links("clients", client.kliento_id, ["update", "delete"])
    }

@router.put(
    "/{kliento_id}",
    response_model=schemas_client.ClientOut,
    operation_id="updateClient",
    dependencies=[Depends(require_perm(Perm.EDIT))]
)
def update_client(
    kliento_id: int,
    client_update: schemas_client.ClientUpdate,
    db: Session = Depends(get_db),
):
    client = repo.get_by_id(db, kliento_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    for field, value in client_update.dict(exclude_unset=True).items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)

    return {
        **client.__dict__,
        "links": generate_links("clients", client.kliento_id, ["update", "delete"]),
    }


@router.post("/", response_model=schemas_client.ClientOut, operation_id="createClient",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_client(client: schemas_client.ClientCreate, db: Session = Depends(get_db)):
    created = repo.create(db, client)
    return {
        **created.__dict__,
        "links": generate_links("clients", created.kliento_id, ["update", "delete"])
    }


@router.delete("/{kliento_id}", operation_id="deleteClient",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_client(kliento_id: int, db: Session = Depends(get_db)):
    success = repo.delete(db, kliento_id)
    if not success:
        raise HTTPException(status_code=404, detail="Client not found")
    return {"ok": True}


@router.get("/{kliento_id}/orders", response_model=list[schemas_order.OrderOut],
            operation_id="getClientOrder", dependencies=[Depends(require_perm(Perm.VIEW))])
def get_client_orders(kliento_id: int, db: Session = Depends(get_db)):
    orders = order_repo.get_by_client_id(db, kliento_id)
    return [
        {
            **order.__dict__,
            "links": [
                {"rel": "self", "href": f"/orders/{order.uzsakymo_id}"},
                {"rel": "car", "href": f"/cars/{order.automobilio_id}"},
                {"rel": "delete", "href": f"/orders/{order.uzsakymo_id}"}
            ]
        }
        for order in orders
    ]
