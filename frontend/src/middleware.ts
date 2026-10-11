// Apsaugo visus puslapius nuo neautorizuotų vartotojų: nukreipia į /login, jei nėra tokeno
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isPublicPath } from "@/utils/publicRoutes";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    isPublicPath(pathname) ||
    pathname === "/login" ||
    pathname.startsWith("/oauth") ||
    // "_next" platesnis nei config.matcher žemiau - jis atmeta TIK "_next/static"/"_next/image", bet NE visus kitus Next.js vidinius kelius (pvz. "_next/webpack-hmr" dev metu); "favicon.ico" ČIA nebūtinas - matcher jį jau atmeta, tad šis kelias funkcijos niekada nepasiekia.
    pathname.startsWith("/_next") ||
    // Statiniai /public failai (nuotraukos, šriftai ir t.t.) - visi turi failo plėtinį, tikri puslapiai ne.
    /\.[a-z0-9]+$/i.test(pathname)
  ) return NextResponse.next();

  // Tik TIKRINA, ar slapukas EGZISTUOJA, NE ar jis dar galiojantis/teisingas - čia tai nepatikrinama sąmoningai (Edge Runtime neturi backend'o JWT bibliotekos), tad pasenusį/sugadintą tokeną praleidžia IKI puslapio; tikrą apsaugą duoda backend'o get_current_user kiekvienai realiai API užklausai, šis middleware TIK UX lygio nukreipimas.
  const token = req.cookies.get("token")?.value;
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
