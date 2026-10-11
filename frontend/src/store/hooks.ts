import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./store";

// Tipizuoti react-redux hook'ų apgaubimai - be jų kiekvienas "useSelector"/"useDispatch" kvietimas visame projekte turėtų PATS nurodyti <RootState>/<AppDispatch>, arba "state"/veiksmai būtų netipizuoti (any).
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
