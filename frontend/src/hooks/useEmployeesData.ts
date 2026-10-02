import { useState, useMemo } from "react";
import {
  useGetAllEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  type EmployeeOut,
} from "@/store/carRentalApi";
import { FieldConfig } from "@/app/components/modals/EntityModal";

type EmployeeWithPassword = EmployeeOut & { slaptazodis?: string };

export function useEmployeesData() {
  const { data = [], isLoading, refetch } = useGetAllEmployeesQuery();
  const [createEmployee] = useCreateEmployeeMutation();
  const [updateEmployee] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("visi");

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOut | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);

  const roles = useMemo(
    () => [...new Set(data.map((e) => e.pareigos))].sort(),
    [data]
  );

  const filtered = useMemo(() => {
    return data.filter((emp) => {
      const matchSearch =
        emp.vardas.toLowerCase().includes(search.toLowerCase()) ||
        emp.pavarde.toLowerCase().includes(search.toLowerCase()) ||
        emp.el_pastas.toLowerCase().includes(search.toLowerCase());

      const matchRole =
        roleFilter === "visi" ||
        emp.pareigos.toLowerCase() === roleFilter.toLowerCase();

      return matchSearch && matchRole;
    });
  }, [data, search, roleFilter]);

  const employeeFields: FieldConfig<EmployeeWithPassword>[] = [
    { name: "vardas", label: "Vardas", type: "text", required: true },
    { name: "pavarde", label: "Pavardė", type: "text", required: true },
    { name: "el_pastas", label: "El. paštas", type: "text", required: true },
    {
      name: "telefono_nr",
      label: "Telefono numeris",
      type: "text",
      required: true,
    },
    {
      name: "pareigos",
      label: "Pareigos",
      type: "select",
      options: roles.map((r) => ({ value: r, label: r })),
      required: true,
    },
    {
      name: "atlyginimas",
      label: "Atlyginimas (€)",
      type: "number",
      required: true,
    },
    {
      name: "isidarbinimo_data",
      label: "Įsidarbinimo data",
      type: "date",
      required: true,
    },
    {
      name: "slaptazodis",
      label: "Slaptažodis",
      type: "password",
      required: true,
    },
  ];
  return {
    employees: data,
    isLoading,
    filtered,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    selectedEmployee,
    setSelectedEmployee,
    isModalOpen,
    setModalOpen,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refetch,
    employeeFields,
  };
}
