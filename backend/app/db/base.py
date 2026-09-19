# Bendra SQLAlchemy "bazinė klasė" - VISI modeliai (Car, Order, Client...) paveldi iš šios Base, kad SQLAlchemy žinotų, kurios Python klasės atitinka DB lenteles.
from sqlalchemy.orm import declarative_base

Base = declarative_base()
