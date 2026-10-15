import { useGetAllInvoicesQuery } from "@/store/autorentApi";
import { useState, useMemo } from "react";

// Sąskaitų sąrašo duomenys ir filtrai - naudoja invoices/page.tsx.
export function useInvoicesData() {
  const { data: invoices = [], isLoading, refetch } = useGetAllInvoicesQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("visi");

  // Paieška IR statuso filtras skaičiuojami kliento pusėje - sąskaitų sąrašas per mažas, kad reikėtų atskiro backend endpoint'o su query parametrais.
  const filtered = useMemo(() => {
    return invoices.filter((s) => {
      const matchSearch = `${s.client_first_name} ${s.client_last_name} ${s.invoice_id}`
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchStatus = statusFilter === "visi" || s.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);

  return {
    invoices,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered,
    isLoading,
    refetch,
  };
}
