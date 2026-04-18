from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Visi modeliai turi būti importuoti čia, kad SQLAlchemy žinotų apie visas lenteles
def import_models():
    from app.models.car import Car
    from app.models.order import Order
    from app.models.client import Client
    from app.models.employee import Employee
    from app.models.invoice import Invoice
    from app.models.reservation import Reservation
