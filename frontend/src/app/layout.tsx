import { Lexend } from "next/font/google";
import "./globals.css";
import Layout from "@/app/components/Layout";
import ClientProvider from "@/app/components/ClientProvider";
import "leaflet/dist/leaflet.css";
import AuthGuard from "./providers/AuthGuard";
import { CustomerAuthProvider } from "./providers/CustomerAuthProvider";

// Lexend - skaitomumui optimizuotas šriftas, bet neatrodo "klinikinis".
const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lexend",
});

// Įdėjimo TVARKA SVARBI, ne atsitiktinė: ClientProvider (Redux store) PIRMAS, nes AuthGuard/Layout žemiau skaito Redux per useAppSelector - be jo jie gautų klaidą. CustomerAuthProvider (atskira, NE Redux, kliento prisijungimo būsena) ir AuthGuard (darbuotojo prisijungimo sargas, PATS atkuria tokeną iš slapuko/localStorage po hard-reload, žr. AuthGuard.tsx) abu turi apgaubti Layout, kad VISI puslapiai (ir kliento, ir darbuotojo) matytų savo kontekstą.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="lt" style={{ backgroundColor: "#0B121F" }}>
      {/* backgroundColor čia TIESIOGIAI (ne per globals.css kintamąjį) - kol CSS dar kraunasi/refresh'inasi, naršyklė turi teisingą foną nuo pirmo HTML baito, ne trumpam matomą numatytąjį baltą/seną foną. */}
      <body
        style={{ backgroundColor: "#0B121F" }}
        className={`${lexend.variable} font-[family-name:var(--font-lexend)] antialiased`}
      >
        <ClientProvider>
          <CustomerAuthProvider>
            <AuthGuard>
              <Layout>{children}</Layout>
            </AuthGuard>
          </CustomerAuthProvider>
        </ClientProvider>
      </body>
    </html>
  );
}
