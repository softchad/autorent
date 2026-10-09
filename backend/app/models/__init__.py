# Centrinis modelių sąrašas - leidžia rašyti "from app.models import Location" (vietoj "from app.models.location import Location"), IR tuo pačiu garantuoja, kad VISOS klasės bus "žinomos" SQLAlchemy'ai (naudinga testams, žr. conftest.py "import app.models" prieš Base.metadata.create_all).
from .client import Client
from .order import Order
from .car import Car
from .employee import Employee
from .invoice import Invoice
from .location import Location
from .reservation import Reservation
from .support_conversation import SupportConversation
from .support_message import SupportMessage, SupportNote
from .loyalty_reward import LoyaltyReward
from .discount_code import DiscountCode

__all__ = [
    "Client",
    "Order",
    "Car",
    "Employee",
    "Invoice",
    "Location",
    "Reservation",
    "SupportConversation",
    "SupportMessage",
    "SupportNote",
    "LoyaltyReward",
    "DiscountCode",
]
