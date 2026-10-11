"use client";
import { useState } from "react";
import DataTable, { Column } from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import EntityModal, { FieldConfig } from "@/app/components/staff/EntityModal";
import type { EmployeeOut } from "@/store/autorentApi";
import { useGetCurrentUserQuery } from "@/store/autorentApi";
import CreateEntityButton from "@/app/components/staff/CreateEntityButton";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useEmployeesData } from "@/hooks/useEmployeesData";
import { formatApiError } from "@/utils/formatApiError";

// Papildo EmployeeOut tik KŪRIMO formai reikalingais laukais (slaptažodis/pakartotas slaptažodis) - atsakyme (EmployeeOut) jų nėra, nes backend niekad nerodo slaptažodžio.
type EmployeeCreate = EmployeeOut & { slaptazodis?: string; repeat_slaptazodis?: string };

// Darbuotojų administravimo lentelė (sąrašas/paieška/rolės filtras/CRUD per modalą) - visa duomenų/API logika laikoma useEmployeesData.ts hook'e.
export default function EmployeesPage() {
  const { data: currentUser } = useGetCurrentUserQuery();
  // Tiksliai "Administratorius" - patikrinau backend'o ROLE_PERMS (permissions.py), ten "Admin" (angliškas) NIEKADA nepripažįstamas kaip administratoriaus teisė, tad ta alternatyva čia buvo klaidinanti.
  const isAdmin = currentUser?.pareigos === "Administratorius";

  const {
    employees,
    filtered,
    isLoading,
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
  } = useEmployeesData();

  const [editMode, setEditMode] = useState(false);

  // Tik KŪRIMO formoje reikia "pakartokite slaptažodį" lauko (apsauga nuo klaidingai įrašyto slaptažodžio) - employeeFields jo neturi, nes jis nėra realus Employee laukas, siunčiamas į DB.
  const creationFields: FieldConfig<EmployeeCreate>[] = [
    ...employeeFields,
    {
      name: "repeat_slaptazodis",
      label: "Pakartokite slaptažodį",
      type: "password" as const,
      required: true,
    },
  ];
  // Slaptažodžio laukas pašalintas iš REDAGAVIMO formos - EntityModal (žr. EntityModal.tsx) formą inicijuoja TUŠČIAI šiam laukui, o "required: true" (employeeFields) blokuotų VISĄ pateikimą, kol slaptažodis iš naujo įvedamas kiekvieną kartą redaguojant BET KOKĮ kitą lauką.
  const updateFields = employeeFields.filter((f) => f.name !== "slaptazodis");

  // Lentelės stulpelių aprašas DataTable'ui, IŠVESTAS iš updateFields (tie patys laukai, kuriuos galima redaguoti, rodomi ir sąraše) - "atlyginimas" vienintelis turi SAVO formatavimą (2 skaitmenys po kablelio), kitiems pakanka plokščio DB lauko vardo.
  const columns: Column<EmployeeOut>[] = updateFields.map((f) => ({
    label: f.label,
    accessor:
      f.name === "atlyginimas"
        ? (row: EmployeeOut) => `${row.atlyginimas.toFixed(2)}`
        : (f.name as string),
  }));

  columns.push({
    label: "Veiksmai",
    accessor: (row: EmployeeOut) => (
      <ActionButtons
        onView={() => {
          setSelectedEmployee(row);
          setEditMode(false);
          setModalOpen(true);
        }}
        onEdit={() => {
          setSelectedEmployee(row);
          setEditMode(true);
          setModalOpen(true);
        }}
        onDelete={async () => {
          const ok = window.confirm(
            `Ištrinti darbuotoją „${row.vardas} ${row.pavarde}“?`
          );
          if (!ok) return;
          try {
            await deleteEmployee({ employeeId: row.darbuotojo_id }).unwrap();
            setSelectedEmployee(null);
            await refetch();
          } catch (err) {
            alert(formatApiError(err, "Negalima ištrinti šio darbuotojo."));
          }
        }}
        // "view"/"edit" PRIVALO būti nurodyti ČIA (ne tik "delete") - ActionButtons "show" NESUJUNGIAMAS su numatytuoju {view:true,edit:true,delete:true}, jis PILNAI PAKEIČIAMAS, tad praleistas raktas reikštų PASLĖPTĄ mygtuką, ne numatytą "true". Trynimas backend'e reikalauja Perm.ADMIN (žr. employee.py delete_employee), ne vien Perm.EDIT kaip redagavimas - be šios patikros Vadybininkas (EDIT, ne ADMIN) matytų trynimo mygtuką, kurį paspaudus serveris VISTIEK atmestų su 403.
        show={{ view: true, edit: true, delete: isAdmin }}
      />
    ),
  });

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="space-y-6 text-[#707070]">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#F7F7F7] ">Darbuotojai</h1>
        {isAdmin && (
          <CreateEntityButton
            buttonLabel="+ Pridėti darbuotoją"
            modalTitle="Naujas darbuotojas"
            fields={creationFields}
            onCreate={async (data) => {
              // META (ne alert+return) - be šito nesutapimas parodytų perspėjimą, bet EntityModal.commit() (žr. EntityModal.tsx) VIS TIEK laikytų šį "onCreate" SĖKMINGU (jis normaliai grįžtų, nemesdamas klaidos) ir UŽDARYTŲ modalą, sukurdamas darbuotoją su pirmu slaptažodžiu - pakartojimo laukas realiai nebūtų patikrintas.
              if (data.slaptazodis !== data.repeat_slaptazodis) {
                throw new Error("Slaptažodžiai nesutampa.");
              }

              // "data" tipas (CreateEntityButton.tsx) yra Partial<EmployeeCreate> - TypeScript tad kiekvieną lauką laiko GALIMAI nesamu, nors RUNTIME metu EntityModal.commit() jau užtikrino, kad VISI "required: true" laukai (employeeFields useEmployeesData.ts faile) užpildyti; "?? ..." čia TIK tipo patikrai, praktiškai niekad nepasirenka atsarginės reikšmės.
              const prepared = {
                vardas: data.vardas ?? "",
                pavarde: data.pavarde ?? "",
                el_pastas: data.el_pastas ?? "",
                telefono_nr: data.telefono_nr ?? "",
                pareigos: data.pareigos ?? "",
                atlyginimas: data.atlyginimas ?? 0,
                isidarbinimo_data: data.isidarbinimo_data ?? "",
                slaptazodis: data.slaptazodis ?? "",
              };

              try {
                await createEmployee({ employeeCreate: prepared }).unwrap();
                await refetch();
                alert("Darbuotojas sukurtas sėkmingai!");
              } catch (e) {
                // META (ne alert) - EntityModal.commit() sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
                throw new Error(formatApiError(e, "Nepavyko sukurti darbuotojo."));
              }
            }}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="Ieškoti…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <select
          className="border p-2 rounded"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="visi">Visos pareigos</option>
          {[...new Set(employees.map((e) => e.pareigos))].sort().map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(e) => e.darbuotojo_id}
        itemsPerPage={10}
      />

      {selectedEmployee && (
        <EntityModal
          key={`${selectedEmployee.darbuotojo_id}-${editMode}`}
          title={`Darbuotojas: ${selectedEmployee.vardas} ${selectedEmployee.pavarde}`}
          entity={selectedEmployee}
          fields={updateFields}
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          startInEdit={editMode}
          onSave={async (updated) => {
            try {
              await updateEmployee({
                employeeId: selectedEmployee.darbuotojo_id,
                employeeUpdate: updated,
              }).unwrap();
              await refetch();
            } catch (e) {
              // META (ne alert) - EntityModal.commit() (žr. EntityModal.tsx) sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
              throw new Error(formatApiError(e, "Nepavyko atnaujinti darbuotojo."));
            }
          }}
        />
      )}
    </div>
  );
}
