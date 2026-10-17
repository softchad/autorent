import LoadingScreen from "@/app/components/LoadingScreen";

// Next.js automatiškai parodo ŠITĄ komponentą (React Suspense "fallback"), kol kraunasi puslapis po navigacijos - šis failas TYČIA laikomas TIKRAME app/ šaknies kataloge, NE (public)/ ar (staff)/ grupės viduje, kad apimtų ABI grupes vienodai (route group'ai skaidrūs maketo medžiui, tad šaknyje esantis "loading" veikia IR viešiems, IR darbuotojų puslapiams).
export default function Loading() {
  return <LoadingScreen />;
}
