# Sąskaitų CRUD endpointai - sąskaita visada susieta su VIENU konkrečiu užsakymu (1:1), ne keliais.
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.schemas.invoice import InvoiceCreate, InvoiceOut
from app.repositories import invoice as crud_invoice
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

# "get" lambda - leidžia priimti IR dict'ą (get_all_invoices grąžina žodynus iš repozitorijos JOIN užklausos), IR DB objektą (create_invoice grąžina tiesiog Invoice modelio eilutę) tuo pačiu kodu.
def generate_invoice_links(invoice) -> list[dict]:
    get = lambda obj, key: obj.get(key) if isinstance(obj, dict) else getattr(obj, key)
    return [
        {"rel": "self", "href": f"/invoices/{get(invoice, 'saskaitos_id')}"},
        {"rel": "order", "href": f"/orders/{get(invoice, 'uzsakymo_id')}"},
        {"rel": "delete", "href": f"/invoices/{get(invoice, 'saskaitos_id')}"}
    ]


# Grąžina VISŲ sąskaitų sąrašą KARTU su užsakymo ir kliento info (JOIN repozitorijoje) - kad frontend'ui nereikėtų atskirai užklausti kliento vardo kiekvienai eilutei.
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

# Naujos sąskaitos kūrimas konkrečiam užsakymui - PIRMA tikrinamas duplikatas ir užsakymo/kliento egzistavimas, TADA kuriama sąskaita, kad nepavykęs DB įrašas (svetimas/neegzistuojantis order_id) niekada nenulūžtų su neaiškia 500 klaida.
@router.post("/", response_model=InvoiceOut, operation_id="createInvoice",
             dependencies=[Depends(require_perm(Perm.EDIT))])
def create_invoice(invoice: InvoiceCreate, db: Session = Depends(get_db)):
    existing = db.query(Invoice).filter(Invoice.uzsakymo_id == invoice.order_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Šis užsakymas jau turi sąskaitą.")

    order = db.query(Order).filter(Order.uzsakymo_id == invoice.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Užsakymas nerastas")
    # Praktiškai NIEKADA neįvyksta (Order.kliento_id yra NOT NULL užsienio raktas į Klientai, kurio ištrinti negalima, kol yra susietų užsakymų) - bet patikra palikta kaip apsauga nuo nenuspėtų duomenų nesuderinamumų.
    client = db.query(klientas_model.Client).filter(klientas_model.Client.kliento_id == order.kliento_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Klientas nerastas")

    created = crud_invoice.create_invoice(db, invoice)

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

# Ištrina sąskaitą - ADMIN teisė, nes sąskaitos yra apskaitos/buhalterijos įrašai, ne laisvai redaguojami duomenys.
@router.delete("/{invoice_id}", operation_id="deleteInvoice", dependencies=[Depends(require_perm(Perm.ADMIN))])
def delete_invoice(invoice_id: int, db: Session = Depends(get_db)):
    success = crud_invoice.delete_invoice(db, invoice_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sąskaita nerasta")
    return {"detail": "Invoice deleted"}

