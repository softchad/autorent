import logging
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from fastapi.openapi.utils import get_openapi
from slowapi.errors import RateLimitExceeded

from app.rate_limit import limiter
from utils.config import settings

logger = logging.getLogger("autorent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
# HTTP užklausų URL gali turėti OAuth kodų ar vartotojo adresų, todėl jų nežurnalizuojame INFO lygiu.
logging.getLogger("httpx").setLevel(logging.WARNING)
from app.api.endpoints import (
    auth, employee, car, reservation, order, geocode, client, invoice, public,
    customer_auth, customer, customer_loyalty, customer_support, staff_support, discount_code,
)

app = FastAPI(title="AutoRent API", version="1.0.0")

# Rate limitas (žr. @limiter.limit naudojimą auth.py/customer_auth.py faile) - apsauga nuo brute-force prisijungimo bandymų ir automatinio sąskaitų kūrimo.
app.state.limiter = limiter


# Slowapi NUMATYTASIS handler'is grąžina {"error": ...}, bet VISA likusi API (žr. HTTPException visur kituose failuose) naudoja {"detail": ...} - frontend'o extractErrorMessage (žr. utils/extractErrorMessage.ts) skaito TIK "detail" lauką, tad be ŠIO handler'io 429 atsakymas liktų NEPARODYTAS vartotojui (nutiltų iki bendro "neteisingas slaptažodis" pranešimo).
def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    response = JSONResponse(
        status_code=429,
        content={"detail": "Per daug bandymų per trumpą laiką. Palaukite minutę ir bandykite dar kartą."},
    )
    return limiter._inject_headers(response, request.state.view_rate_limit)


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# Sesija reikalinga OAuth prisijungimui
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SESSION_SECRET_KEY,
)

# CORS - leidžia naršyklei siųsti užklausas IŠ frontend'o domeno į ŠĮ (kitą) serverio domeną; "allow_credentials=True" reikalingas, kad "Authorization" antraštė (JWT tokenas) pereitų kartu - saugu TIK todėl, kad allow_origins ČIA yra KONKRETUS adresas, ne "*" (naršyklės atmestų credentials su wildcard).
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
        title="AutoRent API",
        version="1.0.0",
        description="AutoRent automobilių nuomos valdymo sistema",
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
app.include_router(staff_support.router, prefix="/api/v1", tags=["Staff Support"])
app.include_router(invoice.router,       prefix="/api/v1", tags=["Invoices"])
app.include_router(geocode.router,       prefix="/api/v1", tags=["Geo Code"])
app.include_router(geocode.public_router, prefix="/api/v1", tags=["Public"])
app.include_router(public.router,        prefix="/api/v1", tags=["Public"])
app.include_router(customer_auth.router, prefix="/api/v1", tags=["Customer Auth"])
app.include_router(customer.router,      prefix="/api/v1", tags=["Customer"])
app.include_router(customer_loyalty.router, prefix="/api/v1", tags=["Customer Loyalty"])
app.include_router(discount_code.router, prefix="/api/v1", tags=["Customer Loyalty"])
app.include_router(customer_support.router, prefix="/api/v1", tags=["Customer Support"])

# Log'inam klaidą PRIEŠ grąžinant bendrą pranešimą - kitaip ji niekur serveryje neužfiksuota.
@app.exception_handler(Exception)
async def server_error_handler(request: Request, exc: Exception):
    logger.exception("Nesuvaldyta klaida apdorojant %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Serverio klaida. Bandykite dar kartą."},
    )
