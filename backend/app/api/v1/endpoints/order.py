from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas import order as schemas
from app.repositories import order as repo
from utils.hateoas import generate_links
from app.api.deps import get_current_user
from app.api.permissions import require_perm, Perm

router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
    dependencies=[Depends(get_current_user)]
)

@router.get("/", response_model=list[schemas.OrderOut], operation_id="getAllOrders",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_all_orders(db: Session = Depends(get_db)):
    orders = repo.get_all(db)
    return [
        {
            **order.__dict__,
            "links": [
                {"rel": "self", "href": f"/orders/{order.uzsakymo_id}"},
                {"rel": "client", "href": f"/clients/{order.kliento_id}"},
                {"rel": "car", "href": f"/cars/{order.automobilio_id}"},
                {"rel": "delete", "href": f"/orders/{order.uzsakymo_id}"}
            ]
        }
        for order in orders
    ]

@router.get("/{uzsakymo_id}", response_model=schemas.OrderOut, operation_id="getOrderById",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_order(uzsakymo_id: int, db: Session = Depends(get_db)):
    order = repo.get_by_id(db, uzsakymo_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        **order.__dict__,
        "links": [
            {"rel": "self", "href": f"/orders/{order.uzsakymo_id}"},
            {"rel": "client", "href": f"/clients/{order.kliento_id}"},
            {"rel": "car", "href": f"/cars/{order.automobilio_id}"},
            {"rel": "delete", "href": f"/orders/{order.uzsakymo_id}"}
        ]
    }

@router.post("/", response_model=schemas.OrderOut, operation_id="createOrder",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_order(order: schemas.OrderCreate, db: Session = Depends(get_db)):
    created = repo.create(db, order)
    return {
        **created.__dict__,
        "links": [
            {"rel": "self", "href": f"/orders/{created.uzsakymo_id}"},
            {"rel": "client", "href": f"/clients/{created.kliento_id}"},
            {"rel": "car", "href": f"/cars/{created.automobilio_id}"},
            {"rel": "delete", "href": f"/orders/{created.uzsakymo_id}"}
        ]
    }

@router.delete("/{uzsakymo_id}", operation_id="deleteOrder",
               dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_order(uzsakymo_id: int, db: Session = Depends(get_db)):
    success = repo.delete(db, uzsakymo_id)
    if not success:
        raise HTTPException(status_code=404, detail="Order not found")
    return {"ok": True}

@router.get("/stats/by-status", operation_id="getOrderStatsByStatus",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_order_stats_by_status(db: Session = Depends(get_db)):
    return repo.get_order_counts_by_status(db)

@router.get("/by-client/{kliento_id}", response_model=list[schemas.OrderOut],
             operation_id="getOrderByClient", dependencies=[Depends(require_perm(Perm.VIEW))])
def get_orders_by_client(kliento_id: int, db: Session = Depends(get_db)):
    orders = repo.get_by_client_id(db, kliento_id)
    return [
        {
            **order.__dict__,
            "links": [
                {"rel": "self", "href": f"/orders/{order.uzsakymo_id}"},
                {"rel": "client", "href": f"/clients/{order.kliento_id}"},
                {"rel": "car", "href": f"/cars/{order.automobilio_id}"},
                {"rel": "delete", "href": f"/orders/{order.uzsakymo_id}"}
            ]
        }
        for order in orders
    ]


@router.put("/{uzsakymo_id}", response_model=schemas.OrderOut, operation_id="updateOrder",
            dependencies=[Depends(require_perm(Perm.EDIT))])
def update_order(uzsakymo_id: int, order_update: schemas.OrderUpdate, db: Session = Depends(get_db)):
    order = repo.get_by_id(db, uzsakymo_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order_update.uzsakymo_busena is not None:
        order.uzsakymo_busena = order_update.uzsakymo_busena
    if order_update.grazinimo_data is not None:
        order.grazinimo_data = order_update.grazinimo_data
    if order_update.turi_papildomas_paslaugas is not None:
        order.turi_papildomas_paslaugas = order_update.turi_papildomas_paslaugas
    db.commit()
    db.refresh(order)
    return {
        **order.__dict__,
        "links": [
            {"rel": "self", "href": f"/orders/{order.uzsakymo_id}"},
            {"rel": "client", "href": f"/clients/{order.kliento_id}"},
            {"rel": "car", "href": f"/cars/{order.automobilio_id}"},
            {"rel": "delete", "href": f"/orders/{order.uzsakymo_id}"}
        ]
    }
