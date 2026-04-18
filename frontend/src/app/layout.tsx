import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Layout from "@/app/components/Layout";
import ClientProvider from "@/app/components/ClientProvider";
import "leaflet/dist/leaflet.css";
import AuthHydrate from "./providers/AuthHydrate";
import AuthGuard from "./guards/AuthGuard";

const jakarta = Plus_Jakarta_Sans({
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
      <body className={`${jakarta.variable} font-[family-name:var(--font-jakarta)] antialiased`}>
        <ClientProvider>
          <AuthHydrate />
          <AuthGuard>
            <Layout>{children}</Layout>
          </AuthGuard>
        </ClientProvider>
      </body>
    </html>
  );
}
