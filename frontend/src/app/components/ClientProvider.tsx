"use client";

import { Provider } from "react-redux";
import { store } from "@/store/store";

type ClientProviderProps = {
  children: React.ReactNode;
};

// Redux/RTK Query parduotuvės prieiga VISAM app'ui - apgaubia tiek darbuotojų, tiek viešą pusę app/layout.tsx faile, kad bet kuris komponentas galėtų naudoti autorentApi hook'us.
export default function ClientProvider({ children }: ClientProviderProps) {
  return <Provider store={store}>{children}</Provider>;
}
