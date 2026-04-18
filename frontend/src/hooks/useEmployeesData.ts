import { useState, useMemo } from "react";
import {
  useGetAllEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
} from "@/store/carRentalApi";
import { FieldConfig } from "@/app/components/modals/EntityModal";

export function useEmployeesData() {
  const { data = [], isLoading, refetch } = useGetAllEmployeesQuery();
  const [createEmployee] = useCreateEmployeeMutation();
  const [updateEmployee] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("visi");

  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
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

  const employeeFields: FieldConfig<any>[] = [
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
  function randomizeEmployee() {
    const vardai = ["Jonas", "Petras", "Tomas", "Lukas", "Mantas", "Dovydas",
                    "Laura", "Eglė", "Rūta", "Ingrida", "Monika", "Simona"];
    const pavardes = ["Kazlauskas", "Petraitis", "Jonaitis", "Stankevičius",
                      "Butkus", "Paulauskas", "Jankauskas", "Mickus"];
    const pareigosOptions = roles.length > 0
      ? roles
      : ["Vadybininkas", "Mechaniklas", "Konsultantas", "Administratorius"];
    const domainai = ["autorent.lt", "gmail.com", "outlook.com"];
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const vardas = pick(vardai);
    const pavarde = pick(pavardes);
    const el_pastas = `${vardas.toLowerCase()}.${pavarde.toLowerCase()}@${pick(domainai)}`;
    const phonePrefix = pick(["+37060", "+37061", "+37062", "+37065", "+37069"]);
    const telefono_nr = `${phonePrefix}${randInt(100000, 999999)}`;
    const now = new Date();
    const year = now.getFullYear() - randInt(0, 5);
    const isidarbinimo_data = `${year}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;
    const password = `Autorent${randInt(100, 999)}!`;

    return {
      vardas,
      pavarde,
      el_pastas,
      telefono_nr,
      pareigos: pick(pareigosOptions),
      atlyginimas: randInt(1200, 3500),
      isidarbinimo_data,
      slaptazodis: password,
      repeat_slaptazodis: password,
    };
  }

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
    randomizeEmployee,
  };
}
