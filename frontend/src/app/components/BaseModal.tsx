import React from "react";
import { FiX } from "react-icons/fi";

type BaseModalProps = {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
  actions?: React.ReactNode;
};

export default function BaseModal({ title, children, isOpen, onClose, actions }: BaseModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0E1525] border border-[#1C2B3A] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#1C2B3A] shrink-0">
          <h2 className="text-base font-semibold text-[#F7F7F7]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#3D4F63] hover:text-[#F7F7F7] hover:bg-[#1A2238] transition"
            aria-label="Uždaryti"
          >
            <FiX className="text-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-4 flex-1 text-sm text-[#F7F7F7]">
          {children}
        </div>

        {/* Footer */}
        {actions && (
          <div className="px-6 py-4 flex items-center justify-end gap-2 border-t border-[#1C2B3A] shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
