"use client";

import { Disclosure, DisclosureButton, DisclosurePanel } from "@headlessui/react";
import { FiChevronDown } from "react-icons/fi";

// Vienas DUK įrašas kaip išskleidžiamas Disclosure - rodomas TIK klausimas, atsakymas atsiveria paspaudus (žr. HomeClient.tsx, kur sudaromas DUK sąrašas).
export default function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <Disclosure
      as="div"
      className="group border border-[#1C2B3A] rounded-xl bg-[#0E1525] px-5 overflow-hidden"
    >
      <DisclosureButton className="flex w-full items-center justify-between gap-4 py-4 text-left text-sm font-medium text-[#F7F7F7]">
        {question}
        <FiChevronDown className="shrink-0 text-[#4BAFD4] transition-transform duration-200 group-data-[open]:rotate-180" />
      </DisclosureButton>
      <DisclosurePanel className="pb-4 text-sm text-[#8899AA] leading-relaxed">
        {answer}
      </DisclosurePanel>
    </Disclosure>
  );
}
