from pydantic import BaseModel
from datetime import date
from typing import Optional, List, Dict

class InvoiceBase(BaseModel):
    order_id: int
    total: float
    invoice_date: date

class InvoiceCreate(InvoiceBase):
    pass

class InvoiceStatusUpdate(BaseModel):
    status: str

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

    class Config:
        from_attributes = True
