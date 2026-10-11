import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Roboto",
  fonts: [
    { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
  ],
});
import type { InvoiceOut } from "@/store/autorentApi";

const NAVY = "#05001D";
const TEAL = "#0F597B";
const WHITE = "#FFFFFF";
const GRAY = "#2E2E2E";
const LIGHT_BG = "#F0F4F8";
const BORDER = "#DDE3EA";

// Light-fill badges — readable in B&W (dark text on light bg, explicit border)
const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  apmokėta:   { bg: "#DCF5E6", text: "#166534", border: "#166534" },
  vėluojanti: { bg: "#FEE2E2", text: "#991B1B", border: "#991B1B" },
  išrašyta:   { bg: "#DBEAFE", text: "#1E3A5F", border: "#1E3A5F" },
};

export type OrderInfo = {
  carName: string;
  nuomos_data: string;
  grazinimo_data: string;
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    backgroundColor: WHITE,
    paddingBottom: 60,
  },

  // === Header — white bg to save ink; NAVY text stays bold ===
  header: {
    backgroundColor: WHITE,
    paddingHorizontal: 40,
    paddingVertical: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandName: {
    fontSize: 26,
    fontFamily: "Roboto", fontWeight: "bold",
    color: NAVY,
    letterSpacing: 3,
  },
  brandTagline: {
    fontSize: 9,
    color: GRAY,
    marginTop: 3,
    letterSpacing: 1,
  },
  invoiceLabel: {
    fontSize: 11,
    color: TEAL,
    letterSpacing: 3,
    textAlign: "right",
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 22,
    fontFamily: "Roboto", fontWeight: "bold",
    color: NAVY,
    textAlign: "right",
  },

  // === Teal accent bar — single colored stripe, minimal ink ===
  accentBar: {
    height: 4,
    backgroundColor: TEAL,
  },

  // === Info section ===
  infoSection: {
    flexDirection: "row",
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 20,
  },
  infoLeft: {
    flex: 1,
    paddingRight: 20,
  },
  infoRight: {
    flex: 1,
    paddingLeft: 20,
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
  },
  infoFieldLabel: {
    fontSize: 7,
    color: GRAY,
    letterSpacing: 1.5,
    marginBottom: 3,
    marginTop: 12,
  },
  infoFieldValue: {
    fontSize: 12,
    color: NAVY,
    fontFamily: "Roboto", fontWeight: "bold",
  },
  clientName: {
    fontSize: 18,
    fontFamily: "Roboto", fontWeight: "bold",
    color: NAVY,
    marginBottom: 2,
  },
  // Badge: border-only style — visible even without color ink
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 4,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 8,
    fontFamily: "Roboto", fontWeight: "bold",
    letterSpacing: 1,
  },

  // === Rental info row ===
  rentalSection: {
    paddingHorizontal: 40,
    marginBottom: 16,
  },
  rentalSectionTitle: {
    fontSize: 8,
    color: GRAY,
    letterSpacing: 2,
    marginBottom: 6,
  },
  rentalGrid: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rentalCol: {
    flex: 1,
  },
  rentalLabel: {
    fontSize: 7,
    color: GRAY,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  rentalValue: {
    fontSize: 10,
    color: NAVY,
    fontFamily: "Roboto", fontWeight: "bold",
  },

  // === Divider ===
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 40,
    marginVertical: 4,
  },

  // === Table ===
  tableSection: {
    paddingHorizontal: 40,
    marginTop: 20,
  },
  tableSectionTitle: {
    fontSize: 8,
    color: GRAY,
    letterSpacing: 2,
    marginBottom: 8,
  },
  // Table header — white bg, NAVY text, TEAL bottom line only
  tableHeader: {
    flexDirection: "row",
    backgroundColor: WHITE,
    borderBottomWidth: 2,
    borderBottomColor: TEAL,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 2,
  },
  tableHeaderText: {
    fontSize: 8,
    color: NAVY,
    fontFamily: "Roboto", fontWeight: "bold",
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: "row",
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 2,
  },
  colDescription: { flex: 3 },
  colOrder: { flex: 1, textAlign: "center" },
  colAmount: { flex: 1, textAlign: "right" },
  tableRowText: {
    fontSize: 10,
    color: NAVY,
  },
  tableRowTextBold: {
    fontSize: 10,
    fontFamily: "Roboto", fontWeight: "bold",
    color: NAVY,
  },

  // === Total — white bg with TEAL left accent border ===
  totalSection: {
    paddingHorizontal: 40,
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalBox: {
    backgroundColor: WHITE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderRightWidth: 1,
    borderRightColor: BORDER,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderLeftWidth: 4,
    borderLeftColor: TEAL,
    borderRadius: 4,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 200,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 9,
    color: GRAY,
    letterSpacing: 2,
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "Roboto", fontWeight: "bold",
    color: NAVY,
  },

  // === Note ===
  noteSection: {
    paddingHorizontal: 40,
    marginTop: 24,
  },
  noteBox: {
    backgroundColor: "#EBF4FA",
    borderLeftWidth: 3,
    borderLeftColor: TEAL,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noteText: {
    fontSize: 8,
    color: NAVY,
    lineHeight: 1.5,
  },

  // === Footer — white bg with TEAL top border ===
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: WHITE,
    borderTopWidth: 2,
    borderTopColor: TEAL,
    paddingHorizontal: 40,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    fontSize: 8,
    color: GRAY,
  },
  footerRight: {
    fontSize: 8,
    color: GRAY,
    textAlign: "right",
  },
});

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("lt-LT");
}

function rentalDays(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] ?? { bg: "#F3F4F6", text: "#374151", border: "#9CA3AF" };
  return (
    <View style={[s.statusBadge, { backgroundColor: color.bg, borderColor: color.border }]}>
      <Text style={[s.statusText, { color: color.text }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

export default function InvoicePdfDocument({
  invoice,
  orderInfo,
}: {
  invoice: InvoiceOut;
  orderInfo?: OrderInfo;
}) {
  return (
    <Document
      title={`AutoRent sąskaita nr. ${invoice.invoice_id}`}
      author="AutoRent"
    >
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>AUTORENT</Text>
            <Text style={s.brandTagline}>AUTOMOBILIŲ NUOMA</Text>
          </View>
          <View>
            <Text style={s.invoiceLabel}>SĄSKAITA-FAKTŪRA</Text>
            <Text style={s.invoiceNumber}>Nr. {invoice.invoice_id}</Text>
          </View>
        </View>

        {/* Teal accent */}
        <View style={s.accentBar} />

        {/* Info columns */}
        <View style={s.infoSection}>
          <View style={s.infoLeft}>
            <Text style={s.infoFieldLabel}>IŠRAŠYMO DATA</Text>
            <Text style={s.infoFieldValue}>{formatDate(invoice.invoice_date)}</Text>

            <Text style={s.infoFieldLabel}>SĄSKAITOS NR.</Text>
            <Text style={s.infoFieldValue}>#{invoice.invoice_id}</Text>

            <Text style={s.infoFieldLabel}>BŪSENA</Text>
            <StatusBadge status={invoice.status} />
          </View>

          <View style={s.infoRight}>
            <Text style={s.infoFieldLabel}>KLIENTAS</Text>
            <Text style={s.clientName}>
              {invoice.client_first_name} {invoice.client_last_name}
            </Text>

            <Text style={s.infoFieldLabel}>UŽSAKYMO NR.</Text>
            <Text style={s.infoFieldValue}>#{invoice.order_id}</Text>
          </View>
        </View>

        {/* Rental details — only shown when order data is available */}
        {orderInfo && (
          <View style={s.rentalSection}>
            <Text style={s.rentalSectionTitle}>NUOMOS INFORMACIJA</Text>
            <View style={s.rentalGrid}>
              <View style={s.rentalCol}>
                <Text style={s.rentalLabel}>AUTOMOBILIS</Text>
                <Text style={s.rentalValue}>{orderInfo.carName}</Text>
              </View>
              <View style={s.rentalCol}>
                <Text style={s.rentalLabel}>NUOMOS LAIKOTARPIS</Text>
                <Text style={s.rentalValue}>
                  {formatDate(orderInfo.nuomos_data)} – {formatDate(orderInfo.grazinimo_data)}
                </Text>
              </View>
              <View style={s.rentalCol}>
                <Text style={s.rentalLabel}>DIENŲ SKAIČIUS</Text>
                <Text style={s.rentalValue}>
                  {rentalDays(orderInfo.nuomos_data, orderInfo.grazinimo_data)} d.
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={s.divider} />

        {/* Table */}
        <View style={s.tableSection}>
          <Text style={s.tableSectionTitle}>PASLAUGOS</Text>

          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, s.colDescription]}>APRAŠYMAS</Text>
            <Text style={[s.tableHeaderText, s.colOrder]}>UŽSAKYMAS</Text>
            <Text style={[s.tableHeaderText, s.colAmount]}>SUMA</Text>
          </View>

          <View style={s.tableRow}>
            <Text style={[s.tableRowText, s.colDescription]}>
              {orderInfo
                ? `Automobilio nuoma — ${orderInfo.carName}`
                : "Automobilio nuoma"}
            </Text>
            <Text style={[s.tableRowText, s.colOrder]}>#{invoice.order_id}</Text>
            <Text style={[s.tableRowTextBold, s.colAmount]}>
              {Number(invoice.total).toFixed(2)} €
            </Text>
          </View>
        </View>

        {/* Total */}
        <View style={s.totalSection}>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>IŠ VISO</Text>
            <Text style={s.totalAmount}>{Number(invoice.total).toFixed(2)} €</Text>
          </View>
        </View>

        {/* Note */}
        <View style={s.noteSection}>
          <View style={s.noteBox}>
            <Text style={s.noteText}>
              Ši sąskaita-faktūra yra automatiškai sugeneruota AutoRent sistemos.
              Kilus klausimų, kreipkitės el. paštu: buhaltere@autorent.lt
            </Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerLeft}>AutoRent © {new Date().getFullYear()}</Text>
          <Text style={s.footerRight}>autorent.lt</Text>
        </View>

      </Page>
    </Document>
  );
}
