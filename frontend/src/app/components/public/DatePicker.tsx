"use client";

import { useState } from "react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { FiCalendar, FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";

const MONTHS = [
  "Sausis",
  "Vasaris",
  "Kovas",
  "Balandis",
  "Gegužė",
  "Birželis",
  "Liepa",
  "Rugpjūtis",
  "Rugsėjis",
  "Spalis",
  "Lapkritis",
  "Gruodis",
];

const MONTHS_SHORT = ["Sau", "Vas", "Kov", "Bal", "Geg", "Bir", "Lie", "Rgp", "Rgs", "Spa", "Lap", "Grd"];
const WEEKDAYS = ["Pr", "An", "Tr", "Kt", "Pn", "Št", "Sk"];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromISO(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function isSameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DatePicker({
  label,
  value,
  onChange,
  minDate,
  compact = false,
  allowClear = true,
  disabledDates,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  compact?: boolean;
  // false kai tuščia data neturi prasmės šiame kontekste (pvz. rezervacijos
  // datų pasirinkimas automobilio puslapyje - ten VISADA turi būti data).
  allowClear?: boolean;
  // "YYYY-MM-DD" raktai, kurių kalendoriuje negalima rinktis (jau užimtos
  // dienos konkrečiam automobiliui) - žr. hooks/usePublicCars useCarBusyDates.
  disabledDates?: Set<string>;
}) {
  const selected = fromISO(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = fromISO(minDate || "") || today;

  const [cursor, setCursor] = useState(() => selected || today);

  const weeks = buildMonthGrid(cursor.getFullYear(), cursor.getMonth());

  if (compact) {
    return (
      <Popover className="relative min-w-0">
        <div className="flex min-w-0 items-center gap-1">
          <PopoverButton className="flex min-w-0 items-center gap-2 text-left focus:outline-none">
            <FiCalendar className="shrink-0 text-[#4BAFD4] text-base" />
            {selected ? (
              <span className="truncate text-sm font-medium text-[#F7F7F7]">
                {selected.getDate()} {MONTHS_SHORT[selected.getMonth()]}
              </span>
            ) : (
              <span className="truncate text-sm text-[#707070]">{label}</span>
            )}
          </PopoverButton>
          {selected && allowClear && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              aria-label={`Išvalyti datą (${label})`}
              className="shrink-0 rounded-full p-0.5 text-[#707070] hover:bg-[#1A2238] hover:text-[#F7F7F7] transition"
            >
              <FiX className="text-sm" />
            </button>
          )}
        </div>

        <PopoverPanel
          transition
          anchor="bottom end"
          className="z-50 mt-2 w-[280px] rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-4 shadow-2xl origin-top transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 data-[closed]:-translate-y-1"
        >
          {({ close }) => (
            <CalendarGrid
              cursor={cursor}
              setCursor={setCursor}
              weeks={weeks}
              selected={selected}
              today={today}
              min={min}
              disabledDates={disabledDates}
              onPick={(day) => {
                onChange(toISO(day));
                close();
              }}
            />
          )}
        </PopoverPanel>
      </Popover>
    );
  }

  return (
    <Popover className="relative">
      <span className="block text-sm font-semibold uppercase tracking-wide text-[#8899AA] mb-2">{label}</span>
      <span className="relative flex h-[72px] min-w-0 items-center rounded-2xl border border-[#1C2B3A] bg-[#1A2238] transition group-hover:border-[#0F597B]/50 data-[active]:border-[#0F597B]">
        <PopoverButton className="flex h-full min-w-0 flex-1 items-center gap-2.5 px-5 text-left focus:outline-none">
          <FiCalendar className="shrink-0 text-[#4BAFD4] text-xl" />
          {selected ? (
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-lg font-semibold text-[#F7F7F7]">
                {selected.getDate()} {MONTHS_SHORT[selected.getMonth()]}
              </span>
              <span className="truncate text-xs text-[#707070]">{selected.getFullYear()}</span>
            </span>
          ) : (
            <span className="truncate text-lg text-[#3D4F63]">Pasirinkite datą</span>
          )}
        </PopoverButton>
        {selected && allowClear && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Išvalyti datą (${label})`}
            className="shrink-0 rounded-full p-1.5 mr-4 text-[#707070] hover:bg-[#0B121F] hover:text-[#F7F7F7] transition"
          >
            <FiX />
          </button>
        )}
      </span>

      <PopoverPanel
        transition
        anchor="bottom start"
        className="z-50 mt-2 w-[300px] rounded-2xl border border-[#1C2B3A] bg-[#0E1525] p-4 shadow-2xl origin-top transition duration-150 ease-out data-[closed]:scale-95 data-[closed]:opacity-0 data-[closed]:-translate-y-1"
      >
        {({ close }) => (
          <CalendarGrid
            cursor={cursor}
            setCursor={setCursor}
            weeks={weeks}
            selected={selected}
            today={today}
            min={min}
            disabledDates={disabledDates}
            onPick={(day) => {
              onChange(toISO(day));
              close();
            }}
          />
        )}
      </PopoverPanel>
    </Popover>
  );
}

function CalendarGrid({
  cursor,
  setCursor,
  weeks,
  selected,
  today,
  min,
  disabledDates,
  onPick,
}: {
  cursor: Date;
  setCursor: (d: Date) => void;
  weeks: (Date | null)[][];
  selected: Date | null;
  today: Date;
  min: Date;
  disabledDates?: Set<string>;
  onPick: (d: Date) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="p-1.5 rounded-lg text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7] transition"
          aria-label="Ankstesnis mėnuo"
        >
          <FiChevronLeft />
        </button>
        <span className="text-sm font-semibold text-[#F7F7F7]">
          {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="p-1.5 rounded-lg text-[#8899AA] hover:bg-[#1A2238] hover:text-[#F7F7F7] transition"
          aria-label="Kitas mėnuo"
        >
          <FiChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-semibold text-[#3D4F63] py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {weeks.flatMap((week, wi) =>
          week.map((day, di) => {
            if (!day) return <div key={`${wi}-${di}`} />;
            const isBusy = !!disabledDates?.has(toISO(day));
            const disabled = day < min || isBusy;
            const isSelected = isSameDay(day, selected);
            const isToday = isSameDay(day, today);
            return (
              <button
                key={`${wi}-${di}`}
                type="button"
                disabled={disabled}
                onClick={() => onPick(day)}
                title={isBusy ? "Užimta šią dieną" : undefined}
                className={`aspect-square rounded-lg text-sm font-medium transition
                  ${isBusy ? "text-rose-500/70 line-through cursor-not-allowed bg-rose-500/10" : disabled ? "text-[#2A3548] cursor-not-allowed" : "text-[#C5CEDA] hover:bg-[#1A2238]"}
                  ${isSelected ? "bg-[#0F597B] text-white hover:bg-[#0F597B]" : ""}
                  ${isToday && !isSelected ? "border border-[#0F597B]/60" : ""}
                `}
              >
                {day.getDate()}
              </button>
            );
          })
        )}
      </div>

      {disabledDates && disabledDates.size > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#707070]">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-500/20 border border-rose-500/40" />
          Užimtos dienos
        </p>
      )}
    </>
  );
}
