"use client";

import { useChangePasswordMutation, useGetCurrentUserQuery } from "@/store/autorentApi";
import { FormEvent, useState } from "react";
import { useAppSelector } from "@/store/hooks";
import { decodeJwt } from "@/utils/jwt";
import { formatApiError } from "@/utils/formatApiError";

// Darbuotojo SAVO profilio puslapis - informacija apie save, sesijos (JWT) info IR slaptažodžio keitimas.
export default function ProfilePage() {
  const { data: user, isLoading, isError, error } = useGetCurrentUserQuery();
  const [changePassword, { isLoading: isChanging }] =
    useChangePasswordMutation();

  // JWT "iat"/"exp" (issued at/expires) laukai saugomi SEKUNDĖMIS nuo 1970-01-01, bet JS Date konstruktorius tikisi MILISEKUNDŽIŲ - todėl "* 1000".
  const token = useAppSelector((s) => s.auth.token);
  const tokenPayload = token ? decodeJwt(token) : null;
  const loginTime = tokenPayload?.iat ? new Date(tokenPayload.iat * 1000) : null;
  const sessionExpires = tokenPayload?.exp ? new Date(tokenPayload.exp * 1000) : null;

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [message, setMessage] = useState("");

  // Slaptažodžių sutapimo (naujas/pakartotas) patikra vyksta KLIENTO pusėje, PRIEŠ siunčiant į backend - backend'as (change_password auth.py) šios poros apskritai nežino, jam siunčiamas TIK "naujas_slaptazodis".
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (newPassword !== repeatPassword) {
      setMessage("Slaptažodžiai nesutampa.");
      return;
    }
    try {
      await changePassword({
        changePasswordRequest: {
          senas_slaptazodis: oldPassword,
          naujas_slaptazodis: newPassword,
        },
      }).unwrap();
      alert("Slaptažodis sėkmingai pakeistas.");
      setOldPassword("");
      setNewPassword("");
      setRepeatPassword("");
      setMessage("");
    } catch (err) {
      // "formatApiError" - be jo, pvz. "Neteisingas dabartinis slaptažodis" (žr. auth.py change_password) niekada nepasiektų vartotojo, liktų tik bendra žinutė.
      setMessage(formatApiError(err, "Nepavyko pakeisti slaptažodžio."));
    }
  };

  if (isLoading) return <p className="text-white">Kraunama...</p>;
  if (isError)
    return <p className="text-red-400">{formatApiError(error, "Nepavyko įkelti profilio duomenų.")}</p>;
  if (!user) return <p className="text-white">Vartotojo duomenys nerasti.</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 text-white">
      <section className="bg-[#0E1525] p-6 rounded-xl shadow-xl">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Darbuotojo informacija
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <p>
            <span className="font-medium text-gray-300">Vardas:</span>{" "}
            {user.vardas}
          </p>
          <p>
            <span className="font-medium text-gray-300">Pavardė:</span>{" "}
            {user.pavarde}
          </p>
          <p>
            <span className="font-medium text-gray-300">El. paštas:</span>{" "}
            {user.el_pastas}
          </p>
          <p>
            <span className="font-medium text-gray-300">Telefono nr.:</span>{" "}
            {user.telefono_nr || "—"}
          </p>
          <p>
            <span className="font-medium text-gray-300">Pareigos:</span>{" "}
            {user.pareigos}
          </p>
          <p>
            <span className="font-medium text-gray-300">Darbuotojo ID:</span>{" "}
            #{user.darbuotojo_id}
          </p>
          <p>
            <span className="font-medium text-gray-300">Įsidarbinimo data:</span>{" "}
            {new Date(user.isidarbinimo_data).toLocaleDateString("lt-LT")}
          </p>
        </div>
      </section>

      <section className="bg-[#0E1525] p-6 rounded-xl shadow-xl">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Sesijos informacija
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <p>
            <span className="font-medium text-gray-300">Prisijungimo laikas:</span>{" "}
            {loginTime ? loginTime.toLocaleString("lt-LT") : "—"}
          </p>
          <p>
            <span className="font-medium text-gray-300">Sesija baigiasi:</span>{" "}
            {sessionExpires ? sessionExpires.toLocaleString("lt-LT") : "—"}
          </p>
        </div>
      </section>

      {/* Slaptažodžio keitimo forma rodoma prisijungusiems darbuotojams; /change-password API tikrina dabartinį slaptažodį ir grąžina aiškią klaidą paskyrai, prisijungiančiai tik per OAuth. */}
      <section className="bg-[#0E1525] p-6 rounded-xl shadow-xl">
        <h2 className="text-lg font-semibold mb-4 text-white">
          Keisti slaptažodį
        </h2>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 max-w-md"
        >
          <input
            type="password"
            placeholder="Dabartinis slaptažodis"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            className="border border-gray-700 bg-[#1E2B45] text-white p-2 rounded"
          />
          <input
            type="password"
            placeholder="Naujas slaptažodis"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="border border-gray-700 bg-[#1E2B45] text-white p-2 rounded"
          />
          <input
            type="password"
            placeholder="Pakartokite naują slaptažodį"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            className="border border-gray-700 bg-[#1E2B45] text-white p-2 rounded"
          />
          <button
            type="submit"
            className="bg-[#0F597B] text-white py-2 rounded hover:bg-[#0C374D] disabled:opacity-60"
            disabled={isChanging}
          >
            {isChanging ? "Keičiama..." : "Išsaugoti pakeitimus"}
          </button>
          {message && <p className="text-sm text-red-400">{message}</p>}
        </form>
      </section>
    </div>
  );
}
