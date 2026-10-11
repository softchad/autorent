import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { setCookie, deleteCookie } from "@/utils/cookie";

interface AuthState {
  token: string | null;
}

const initialState: AuthState = {
  token: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Sinchronizuoja tokeną VISUR, kur jo reikia: Redux (reaktyvus UI per šios sesijos gyvavimą), localStorage (išlieka po puslapio perkrovimo, žr. AuthHydrate.tsx) IR "token" slapuke (vienintelis šaltinis, kurį middleware.ts gali patikrinti serverio pusėje, PRIEŠ bet kokiam kliento JS paleidimui) - visi trys TURI keistis kartu, kitaip, pvz., Redux/localStorage rodytų "atsijungęs", o middleware (skaitantis TIK slapuką) vis tiek leistų pasiekti apsaugotą puslapį.
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
      if (action.payload) {
        localStorage.setItem("token", action.payload);
        setCookie("token", action.payload);
      } else {
        localStorage.removeItem("token");
        deleteCookie("token");
      }
    },

    // Tas pats kaip setToken(null) aukščiau - tiesiog pavadinimu aiškesnė veiksmo versija atsijungimo mygtukui.
    logout(state) {
      state.token = null;
      localStorage.removeItem("token");
      deleteCookie("token");
    },
  },
});

export const { setToken, logout } = authSlice.actions;
export default authSlice.reducer;
