import { FiEye, FiEdit2, FiMail, FiTrash2 } from "react-icons/fi";

type ActionButtonsProps = {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onExtra?: () => void;
  show?: { view?: boolean; edit?: boolean; delete?: boolean; extra?: boolean };
  extraLabel?: string;
};

export function ActionButtons({
  onView,
  onEdit,
  onDelete,
  onExtra,
  show = { view: true, edit: true, delete: true },
  extraLabel = "Veiksmas",
}: ActionButtonsProps) {
  const btn = "p-1.5 rounded-lg transition-all text-[#3D4F63]";
  return (
    <div className="flex items-center gap-0.5">
      {show.view && (
        <button onClick={onView} title="Peržiūrėti" className={`${btn} hover:bg-[#0F597B]/20 hover:text-[#4BAFD4]`}>
          <FiEye className="text-base" />
        </button>
      )}
      {show.edit && (
        <button onClick={onEdit} title="Redaguoti" className={`${btn} hover:bg-emerald-900/30 hover:text-emerald-400`}>
          <FiEdit2 className="text-base" />
        </button>
      )}
      {show.extra && (
        <button onClick={onExtra} title={extraLabel} className={`${btn} hover:bg-purple-900/30 hover:text-purple-400`}>
          <FiMail className="text-base" />
        </button>
      )}
      {show.delete && (
        <button onClick={onDelete} title="Ištrinti" className={`${btn} hover:bg-rose-900/30 hover:text-rose-400`}>
          <FiTrash2 className="text-base" />
        </button>
      )}
    </div>
  );
}
