import { Lexend } from "next/font/google";
import "./globals.css";
import Layout from "@/app/components/Layout";
import ClientProvider from "@/app/components/ClientProvider";
import "leaflet/dist/leaflet.css";
import AuthHydrate from "./providers/AuthHydrate";
import AuthGuard from "./guards/AuthGuard";
import { CustomerAuthProvider } from "./providers/CustomerAuthProvider";

// Lexend - skaitomumui optimizuotas šriftas, bet neatrodo "klinikinis".
const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lexend",
});

// Įdėjimo TVARKA SVARBI, ne atsitiktinė: ClientProvider (Redux store) PIRMAS, nes AuthHydrate/AuthGuard/Layout žemiau VISI skaito Redux per useAppSelector - be jo jie gautų klaidą. AuthHydrate neturi "children" (vaikų), tik ŠALUTINIS efektas (atkuria tokeną iš localStorage/cookie į Redux PRIEŠ AuthGuard patikrą), tad jis stovi KAIP BROLIS, ne apgaubia kitus. CustomerAuthProvider (atskira, NE Redux, kliento prisijungimo būsena) ir AuthGuard (darbuotojo prisijungimo sargas) abu turi apgaubti Layout, kad VISI puslapiai (ir kliento, ir darbuotojo) matytų savo kontekstą.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lt" style={{ backgroundColor: "#0B121F" }}>
      {/* backgroundColor čia TIESIOGIAI (ne per globals.css kintamąjį) - kol CSS dar kraunasi/refresh'inasi, naršyklė turi teisingą foną nuo pirmo HTML baito, ne trumpam matomą numatytąjį baltą/seną foną. */}
      <body
        style={{ backgroundColor: "#0B121F" }}
        className={`${lexend.variable} font-[family-name:var(--font-lexend)] antialiased`}
      >
        <ClientProvider>
          <AuthHydrate />
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
