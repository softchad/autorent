import { useGetAllInvoicesQuery } from "@/store/carRentalApi";
import { useState, useMemo } from "react";

export function useInvoicesData() {
  const { data: invoices = [], isLoading, refetch } = useGetAllInvoicesQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("visi");

  const filtered = useMemo(() => {
    return invoices.filter((s) => {
      const matchSearch = `${s.client_first_name} ${s.invoice_id}`
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
