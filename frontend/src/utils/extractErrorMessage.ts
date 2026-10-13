import { translateValidationMsg } from "./translateValidationMsg";

// Kliento pusės (viešos dalies) klaidos pranešimo išrinkimas iš atsakymo kūno - FastAPI "detail" būna TEKSTAS (HTTPException, pvz. 404/409) ARBA Pydantic validacijos klaidų MASYVAS (422), tad be šios funkcijos masyvas būtų rodomas vartotojui kaip "[object Object]".
export function extractErrorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  // VISOS klaidos, ne tik pirma - kai kurios kliento formos (pvz. registracija) turi kelis laukus, kurie galėtų nulūžti VIENU METU; "translateValidationMsg" reikalingas, nes ne visos kliento schemos (pvz. CustomerReservationCreate) turi savo field_validator'ius su lietuviška žinute - be vertimo likusi, bendrinė Pydantic klaida ("Field required") liktų neišversta anglų kalba.
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((d: { msg?: unknown }) =>
        typeof d?.msg === "string"
          ? translateValidationMsg(d.msg.replace(/^Value error,\s*/, ""))
          : null
      )
      .filter((msg): msg is string => msg !== null)
      .join("\n") || fallback;
  }
  return fallback;
}
