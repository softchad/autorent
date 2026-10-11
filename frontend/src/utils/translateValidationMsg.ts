// Verčia Pydantic/FastAPI BENDRINES (ne pačių field_validator'ių, kurie jau rašomi lietuviškai) klaidų žinutes - naudojama IR formatApiError.ts (darbuotojų pusė), IR extractErrorMessage.ts (klientų pusė), nes pati Pydantic reikšmė ("Field required" ir pan.) nesikeičia pagal tai, kuri sąsaja kviečia endpoint'ą.
export function translateValidationMsg(msg: string): string {
  if (msg.includes("Field required")) return "privalomas laukas";
  if (msg.includes("valid date") || msg.includes("date separator")) return "neteisinga arba tuščia data";
  if (msg.includes("valid integer") || msg.includes("valid number")) return "turi būti skaičius";
  if (msg.includes("valid email")) return "neteisingas el. pašto formatas";
  return msg;
}
