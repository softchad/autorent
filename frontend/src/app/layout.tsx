import { Lexend } from "next/font/google";
import "./globals.css";
import Layout from "@/app/components/Layout";
import ClientProvider from "@/app/components/ClientProvider";
import "leaflet/dist/leaflet.css";
import AuthHydrate from "./providers/AuthHydrate";
import AuthGuard from "./guards/AuthGuard";
import { CustomerAuthProvider } from "./providers/CustomerAuthProvider";

// Lexend - specialiai sukurtas skaitymo lengvumui (mažina vizualinį nuovargį), rekomenduojamas
// WCAG/skaitomumo gairėse visoms amžiaus grupėms, bet vis tiek atrodo moderniai/profesionaliai
// (ne "klinikinis" kaip specializuoti low-vision šriftai). Keitėme iš Plus Jakarta Sans.
const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="lt">
      <body className={`${lexend.variable} font-[family-name:var(--font-jakarta)] antialiased`}>
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
