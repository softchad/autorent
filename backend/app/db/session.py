from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Jei .env nėra, naudojamas atsarginis lokalus adresas
DATABASE_URL = os.getenv("DATABASE_URL", "mysql+pymysql://root:12301@localhost:3306/autorectdumb")

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)
