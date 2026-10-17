import { ReactNode, useEffect, useRef, useState } from "react";

type StatCardProps = {
  title: string;
  value: string | number;
  color?: string;
  icon?: ReactNode;
};

// Animuotas skaičiaus "pribėgimas" nuo 0 iki target per "duration" ms - naudojamas TIK kai "value" yra skaičius (žr. StatCard žemiau); "1 - (1-progress)^3" yra "ease-out" kreivė - skaičiavimas pradžioje greitas, sulėtėja artėdamas prie galo, atrodo natūraliau nei vienodas greitis visą laiką.
function useCountUp(target: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return display;
}

// Vienas statistikos kortelės langelis (dashboard'o viršuje) - "color" numatytoji reikšmė TAMSI (atitinka visą projekto temą), kad ateityje pamirštas "color" niekada neparodytų šviesaus langelio tamsiame fone.
export default function StatCard({
  title,
  value,
  color = "bg-[#163858]",
  icon,
}: StatCardProps) {
  const isNumber = typeof value === "number";
  const counted = useCountUp(isNumber ? value : 0);

  return (
    <div className={`${color} p-5 rounded-xl shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-[#F7F7F7]">{title}</h2>
        {icon && <div className="text-xl text-[#F7F7F7]">{icon}</div>}
      </div>
      <p className="text-3xl font-bold text-[#F7F7F7]">
        {isNumber ? counted : value}
      </p>
    </div>
  );
}
