"use client";

import {
  useChangePasswordMutation,
  useMeApiV1MeGetQuery,
} from "@/store/carRentalApi";
import { FormEvent, useState } from "react";

export default function ProfilePage() {
  const { data: user, isLoading, isError, error } = useMeApiV1MeGetQuery();
  const [changePassword, { isLoading: isChanging }] =
    useChangePasswordMutation();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
    } catch {
      alert("Nepavyko pakeisti slaptažodžio.");
    }
  };

  if (isLoading) return <p className="text-white">Loading...</p>;
  if (isError)
    return <p className="text-red-400">Error: {(error as any)?.status}</p>;
  if (!user) return <p className="text-white">User data not found.</p>;

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
            <span className="font-medium text-gray-300">Pareigos:</span>{" "}
            {user.pareigos}
          </p>
        </div>
      </section>

      {user.pareigos !== "Guest" && (
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
      )}
    </div>
  );
}
