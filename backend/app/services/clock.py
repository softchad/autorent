from datetime import datetime, timezone


# Viena vieta dabartiniam laikui gauti; testuose ją galime pakeisti.
def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# DB DATETIME laukams: UTC laikas be laiko juostos žymos.
def utc_now_naive() -> datetime:
    return utc_now().replace(tzinfo=None)