from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.order import Order
from app.models import client as klientas_model
from app.schemas.invoice import InvoiceCreate
from datetime import datetime

# Grąžina sąskaitas KARTU su susieto užsakymo ir kliento laukais (per JOIN) kaip žodynų sąrašą, ne Invoice objektus - response_model'io laukai (pvz. client_first_name) fiziškai yra KITOSE lentelėse, tad reikia sujungti SQL lygmeniu, ne Python kode.
def get_invoice(db: Session):
    query = (
        db.query(
            Invoice.saskaitos_id.label("invoice_id"),
            Invoice.uzsakymo_id.label("order_id"),
            Order.kliento_id.label("kliento_id"),
            Invoice.suma.label("total"),
            Invoice.saskaitos_data.label("invoice_date"),
            Order.uzsakymo_busena.label("status"),
            klientas_model.Client.vardas.label("client_first_name"),
            klientas_model.Client.pavarde.label("client_last_name"),
        )
        .join(Order, Invoice.uzsakymo_id == Order.uzsakymo_id)
        .join(klientas_model.Client, Order.kliento_id == klientas_model.Client.kliento_id)
    )

    results = query.all()
    # "query.column_descriptions" - SQLAlchemy žino visų .label()'intų stulpelių pavadinimus; čia jie naudojami, kad kiekvieną grąžintą eilutę (tuple) paverstume į žodyną su tais pačiais vardais.
    keys = [col['name'] for col in query.column_descriptions]
    invoices = []
    for row in results:
        d = dict(zip(keys, row))
        # saskaitos_data DB stulpelis gali grįžti kaip pilnas datetime - čia apkarpoma iki vien datos, kad atsakymas visada būtų vienodo formato.
        if isinstance(d["invoice_date"], datetime):
            d["invoice_date"] = d["invoice_date"].date()
        invoices.append(d)
    return invoices


# Sukuria naują sąskaitą DB - patikros (duplikatas, užsakymo/kliento egzistavimas) atliekamos endpoint'e PRIEŠ šį kvietimą, čia tik tiesus įrašymas.
def create_invoice(db: Session, invoice_data: InvoiceCreate):
    data = invoice_data.dict()
    invoice = Invoice(
        uzsakymo_id=data["order_id"],
        suma=data["total"],
        saskaitos_data=data["invoice_date"]
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


# Ištrina sąskaitą pagal ID - grąžina True/False, ar realiai kas nors buvo ištrinta, kad endpoint'as žinotų, ar rodyti 404.
def delete_invoice(db: Session, invoice_id: int):
    invoice = db.query(Invoice).filter(Invoice.saskaitos_id == invoice_id).first()
    if invoice:
        db.delete(invoice)
        db.commit()
        return True
    return False
