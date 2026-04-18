import { Document, Page, View, Text, StyleSheet, Font } from "@react-pdf/renderer";

Font.register({
  family: "Roboto",
  fonts: [
    { src: "/fonts/Roboto-Regular.ttf", fontWeight: "normal" },
    { src: "/fonts/Roboto-Bold.ttf", fontWeight: "bold" },
  ],
});
import type { InvoiceOut } from "@/store/carRentalApi";

const NAVY = "#05001D";
const TEAL = "#0F597B";
const TEAL_LIGHT = "#1A7FA8";
const WHITE = "#F7F7F7";
const GRAY = "#888888";
const LIGHT_BG = "#F0F4F8";

const statusColors: Record<string, { bg: string; text: string }> = {
  apmokėta:   { bg: "#1A4D2E", text: "#A8E6C0" },
  vėluojanti: { bg: "#5B1E2A", text: "#FFAAB5" },
  išrašyta:   { bg: "#2C3A4A", text: "#B0C8E0" },
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Roboto",
    backgroundColor: WHITE,
    paddingBottom: 60,
  },

  // === Header ===
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 40,
    paddingVertical: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  brandName: {
    fontSize: 26,
    fontFamily: "Roboto", fontWeight: "bold",
    color: WHITE,
    letterSpacing: 3,
  },
  brandTagline: {
    fontSize: 9,
    color: "#8899AA",
    marginTop: 3,
    letterSpacing: 1,
  },
  invoiceLabel: {
    fontSize: 11,
    color: TEAL_LIGHT,
    letterSpacing: 3,
    textAlign: "right",
    marginBottom: 4,
  },
  invoiceNumber: {
    fontSize: 22,
    fontFamily: "Roboto", fontWeight: "bold",
    color: WHITE,
    textAlign: "right",
  },

  // === Teal accent bar ===
  accentBar: {
    height: 4,
    backgroundColor: TEAL,
  },

  // === Info section ===
  infoSection: {
    flexDirection: "row",
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 0,
  },
  infoLeft: {
    flex: 1,
    paddingRight: 20,
  },
  infoRight: {
    flex: 1,
    paddingLeft: 20,
    borderLeftWidth: 1,
    borderLeftColor: "#DDE3EA",
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
  infoFieldValueLight: {
    fontSize: 11,
    color: "#333344",
  },
  clientName: {
    fontSize: 18,
    fontFamily: "Roboto", fontWeight: "bold",
    color: NAVY,
    marginBottom: 2,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  statusText: {
    fontSize: 8,
    fontFamily: "Roboto", fontWeight: "bold",
    letterSpacing: 1,
  },

  // === Divider ===
  divider: {
    height: 1,
    backgroundColor: "#DDE3EA",
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
  tableHeader: {
    flexDirection: "row",
    backgroundColor: TEAL,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 1,
  },
  tableHeaderText: {
    fontSize: 8,
    color: WHITE,
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
  tableRowAlt: {
    backgroundColor: "#E8EEF4",
  },
  colDescription: { flex: 3 },
  colOrder: { flex: 1, textAlign: "center" },
  colAmount: { flex: 1, textAlign: "right" },
  tableRowText: {
    fontSize: 10,
    color: "#333344",
  },
  tableRowTextBold: {
    fontSize: 10,
    fontFamily: "Roboto", fontWeight: "bold",
    color: NAVY,
  },

  // === Total ===
  totalSection: {
    paddingHorizontal: 40,
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalBox: {
    backgroundColor: NAVY,
    borderRadius: 6,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 200,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 9,
    color: "#8899AA",
    letterSpacing: 2,
  },
  totalAmount: {
    fontSize: 20,
    fontFamily: "Roboto", fontWeight: "bold",
    color: WHITE,
  },
  totalTeal: {
    color: TEAL_LIGHT,
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
    color: "#445566",
    lineHeight: 1.5,
  },

  // === Footer ===
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: NAVY,
    paddingHorizontal: 40,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLeft: {
    fontSize: 8,
    color: "#8899AA",
  },
  footerRight: {
    fontSize: 8,
    color: "#8899AA",
    textAlign: "right",
  },
});

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("lt-LT");
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] ?? { bg: "#333344", text: "#CCCCCC" };
  return (
    <View style={[s.statusBadge, { backgroundColor: color.bg }]}>
      <Text style={[s.statusText, { color: color.text }]}>
        {status.toUpperCase()}
      </Text>
    </View>
  );
}

export default function InvoicePdfDocument({ invoice }: { invoice: InvoiceOut }) {
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
              Automobilio nuoma
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
            <Text style={s.totalAmount}>
              <Text style={s.totalTeal}>{Number(invoice.total).toFixed(2)}</Text>
              {" €"}
            </Text>
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
