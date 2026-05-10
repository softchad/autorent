// Apsaugo visus puslapius nuo neautorizuotų vartotojų — nukreipia į /login jei nėra tokeno
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) return NextResponse.next();

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
