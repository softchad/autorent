import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from fastapi.openapi.utils import get_openapi

from utils.config import settings
from app.db.base import Base
from app.db.session import engine
from app.api.v1.endpoints import (
    auth, employee, car, reservation, order, geocode, client, client_support, invoice
)

#Base.metadata.create_all(bind=engine)

app = FastAPI(title="Car Rental API", version="1.0.0")

# Sesija reikalinga OAuth prisijungimui
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET_KEY", "dev-secret-32chars-change-me"),
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(settings.FRONTEND_URL).rstrip("/")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Swagger dokumentacijai pridedama JWT Bearer autentikacija
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title="Car Rental API",
        version="1.0.0",
        description="API documentation",
        routes=app.routes,
    )
    components = openapi_schema.setdefault("components", {}).setdefault("securitySchemes", {})
    components["BearerAuth"] = {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Routeriai
app.include_router(auth.router,          prefix="/api/v1", tags=["Authentication"])
app.include_router(employee.router,      prefix="/api/v1", tags=["Employees"])
app.include_router(car.router,           prefix="/api/v1", tags=["Cars"])
app.include_router(reservation.router,   prefix="/api/v1", tags=["Reservations"])
app.include_router(order.router,         prefix="/api/v1", tags=["Orders"])
app.include_router(client.router,        prefix="/api/v1", tags=["Client"])
app.include_router(client_support.router,prefix="/api/v1", tags=["Client Support"])
app.include_router(invoice.router,       prefix="/api/v1", tags=["Invoices"])
app.include_router(geocode.router,       prefix="/api/v1", tags=["Geo Code"])

# 500 klaidos atveju grąžiname bendrą klaidos pranešimą
@app.exception_handler(Exception)
async def server_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Serverio klaida. Bandykite dar kartą."},
    )