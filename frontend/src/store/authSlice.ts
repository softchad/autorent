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
    // Darbuotojo bilietas sinchronizuojamas Redux būsenoje, localStorage ir token slapuke: AuthGuard atkuria sesiją naršyklėje, middleware tikrina maršruto prieigą, o baseApi prideda bilietą prie API užklausų.
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
