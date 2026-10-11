import { useState, useMemo } from "react";
import {
  useGetAllEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  type EmployeeOut,
} from "@/store/autorentApi";
import { FieldConfig } from "@/app/components/staff/EntityModal";

type EmployeeWithPassword = EmployeeOut & { slaptazodis?: string };

// Tiksliai tos 4 pareigos, kurias backend'as REALIAI pripažįsta (žr. ROLE_PERMS permissions.py) - PASTOVUS sąrašas, NE išvestas iš esamų darbuotojų duomenų, kitaip (a) pirmas darbuotojas negalėtų turėti JOKIOS pareigybės (sąrašas būtų tuščias), ir (b) bet kokia nauja, ESAMIEMS darbuotojams nepriskirta pareigybė niekada negalėtų būti pasirinkta.
const PAREIGOS = ["Administratorius", "Vadybininkas", "Mechanikas", "Klientų aptarnavimas"];

// Darbuotojų sąrašo duomenys ir CRUD forma - naudoja employees/page.tsx.
export function useEmployeesData() {
  const { data = [], isLoading, refetch } = useGetAllEmployeesQuery();
  const [createEmployee] = useCreateEmployeeMutation();
  const [updateEmployee] = useUpdateEmployeeMutation();
  const [deleteEmployee] = useDeleteEmployeeMutation();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("visi");

  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOut | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);

  // Paieška IR pareigų filtras skaičiuojami kliento pusėje - darbuotojų sąrašas per mažas, kad reikėtų atskiro backend endpoint'o su query parametrais.
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

  // "slaptazodis" required:true tinka TIK kūrimo formai - EmployeeOut (backend) niekada neturi šio lauko, tad redaguojant ESAMĄ darbuotoją jis visada būtų "trūkstamas" ir EntityModal.commit() blokuotų NET nesusijusių laukų išsaugojimą; employees/page.tsx todėl prieš redagavimą šį lauką iš sąrašo pašalina (žr. updateFields).
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
      options: PAREIGOS.map((r) => ({ value: r, label: r })),
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
