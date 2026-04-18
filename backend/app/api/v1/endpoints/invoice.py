from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.invoice import InvoiceCreate, InvoiceStatusUpdate, InvoiceOut
from app.repositories import invoice as crud_invoice
from utils.hateoas import generate_links
from app.models.order import Order
from app.models import client as klientas_model
from app.models.invoice import Invoice
from app.api.deps import get_current_user
from app.api.permissions import require_perm, Perm

router = APIRouter(
    prefix="/invoices",
    tags=["Invoices"],
    dependencies=[Depends(get_current_user)]
)

def generate_invoice_links(invoice) -> list[dict]:
    get = lambda obj, key: obj.get(key) if isinstance(obj, dict) else getattr(obj, key)
    return [
        {"rel": "self", "href": f"/invoices/{get(invoice, 'saskaitos_id')}"},
        {"rel": "order", "href": f"/orders/{get(invoice, 'uzsakymo_id')}"},
        {"rel": "update_status", "href": f"/invoices/{get(invoice, 'saskaitos_id')}/status"},
        {"rel": "delete", "href": f"/invoices/{get(invoice, 'saskaitos_id')}"}
    ]


@router.get("/", response_model=list[InvoiceOut], operation_id="getAllInvoices",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_all_invoices(db: Session = Depends(get_db)):
    raw_data = crud_invoice.get_invoice(db)
    return [
        {
            **invoice,
            "links": generate_invoice_links(invoice)
        }
        for invoice in raw_data
    ]

@router.post("/", response_model=InvoiceOut, operation_id="createInvoice",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_invoice(invoice: InvoiceCreate, db: Session = Depends(get_db)):
    existing = db.query(Invoice).filter(Invoice.uzsakymo_id == invoice.order_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="This order already has an invoice.")

    created = crud_invoice.create_invoice(db, invoice)

    # Papildoma kliento informacija reikalinga atsakymui
    order = db.query(Order).filter(Order.uzsakymo_id == created.uzsakymo_id).first()
    client = db.query(klientas_model.Client).filter(klientas_model.Client.kliento_id == order.kliento_id).first()

    return {
        "invoice_id": created.saskaitos_id,
        "order_id": created.uzsakymo_id,
        "kliento_id": order.kliento_id,
        "total": created.suma,
        "invoice_date": str(created.saskaitos_data),
        "status": order.uzsakymo_busena,
        "client_first_name": client.vardas,
        "client_last_name": client.pavarde,
        "links": generate_invoice_links(created)
    }

@router.delete("/{invoice_id}", operation_id="deleteInvoice", dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    success = crud_invoice.delete_invoice(db, invoice_id)
    if not success:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"detail": "Invoice deleted"}

@router.patch("/{invoice_id}/status", response_model=InvoiceOut, operation_id="updateStatus",
              dependencies=[Depends(require_perm(Perm.EDIT))])
def update_status(invoice_id: int, status: InvoiceStatusUpdate, db: Session = Depends(get_db)):
    updated = crud_invoice.update_invoice_status(db, invoice_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail="Invoice not found")
    order = db.query(Order).filter(Order.uzsakymo_id == updated.uzsakymo_id).first()
    client = db.query(klientas_model.Client).filter(klientas_model.Client.kliento_id == order.kliento_id).first()
    return {
        "invoice_id": updated.saskaitos_id,
        "order_id": updated.uzsakymo_id,
        "kliento_id": order.kliento_id,
        "total": updated.suma,
        "invoice_date": str(updated.saskaitos_data),
        "status": order.uzsakymo_busena,
        "client_first_name": client.vardas,
        "client_last_name": client.pavarde,
        "links": generate_invoice_links(updated)
    }

@router.get("/{invoice_id}", response_model=InvoiceOut, operation_id="getInvoiceById",
            dependencies=[Depends(require_perm(Perm.VIEW))])
def get_invoice_by_id(invoice_id: int, db: Session = Depends(get_db)):
    invoice = crud_invoice.get_invoice_by_id(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    order = db.query(Order).filter(Order.uzsakymo_id == invoice.uzsakymo_id).first()
    client = db.query(klientas_model.Client).filter(klientas_model.Client.kliento_id == order.kliento_id).first()

    return {
        "invoice_id": invoice.saskaitos_id,
        "order_id": invoice.uzsakymo_id,
        "kliento_id": order.kliento_id,
        "total": invoice.suma,
        "invoice_date": str(invoice.saskaitos_data),
        "status": order.uzsakymo_busena,
        "client_first_name": client.vardas,
        "client_last_name": client.pavarde,
        "links": generate_invoice_links(invoice)
    }
