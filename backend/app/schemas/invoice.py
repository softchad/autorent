# Sąskaitų formos - nėra InvoiceUpdate, nes sąskaitos NIEKADA nekeičiamos po sukūrimo (tik kuriamos arba trinamos, žr. endpoints/invoice.py).
from pydantic import BaseModel
from datetime import date
from typing import List, Dict

class InvoiceBase(BaseModel):
    order_id: int
    total: float
    invoice_date: date

class InvoiceCreate(InvoiceBase):
    pass

# Papildo InvoiceBase kliento/užsakymo info (kliento_id, status, vardas/pavardė) - šie laukai FIZIŠKAI yra KITOSE lentelėse, surenkami per JOIN repozitorijoje (žr. repositories/invoice.py get_invoice), ne pačioje Saskaitos lentelėje.
class InvoiceOut(InvoiceBase):
    invoice_id: int
    order_id: int
    kliento_id: int
    total: float
    invoice_date: date
    status: str
    client_first_name: str
    client_last_name: str
    links: List[Dict]
