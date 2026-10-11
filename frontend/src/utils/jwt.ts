type JwtPayload = {
  sub?: string;
  iat?: number;
  exp?: number;
};

// Iškoduoja JWT "payload" dalį be parašo tikrinimo - naudoti TIK UI rodymui (pvz. sesijos laikui), NIEKADA sprendimams apie prieigą - tą TIKRINA serveris.
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}
