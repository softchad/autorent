import { baseApi as api } from "./baseApi";
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    googleLoginApiV1GoogleLoginGet: build.query<
      GoogleLoginApiV1GoogleLoginGetApiResponse,
      GoogleLoginApiV1GoogleLoginGetApiArg
    >({
      query: () => ({ url: `/api/v1/google/login` }),
    }),
    googleCallbackApiV1GoogleCallbackGet: build.query<
      GoogleCallbackApiV1GoogleCallbackGetApiResponse,
      GoogleCallbackApiV1GoogleCallbackGetApiArg
    >({
      query: () => ({ url: `/api/v1/google/callback` }),
    }),
    login: build.mutation<LoginApiResponse, LoginApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/login`,
        method: "POST",
        body: queryArg.loginRequest,
      }),
    }),
    register: build.mutation<RegisterApiResponse, RegisterApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/register`,
        method: "POST",
        body: queryArg.registerRequest,
      }),
    }),
    logout: build.mutation<LogoutApiResponse, LogoutApiArg>({
      query: () => ({ url: `/api/v1/logout`, method: "POST" }),
    }),
    meApiV1MeGet: build.query<MeApiV1MeGetApiResponse, MeApiV1MeGetApiArg>({
      query: () => ({ url: `/api/v1/me` }),
    }),
    changePassword: build.mutation<
      ChangePasswordApiResponse,
      ChangePasswordApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/change-password`,
        method: "POST",
        body: queryArg.changePasswordRequest,
      }),
    }),
    swaggerLogin: build.mutation<SwaggerLoginApiResponse, SwaggerLoginApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/token`,
        method: "POST",
        body: queryArg.bodySwaggerLogin,
      }),
    }),
    getAllEmployees: build.query<
      GetAllEmployeesApiResponse,
      GetAllEmployeesApiArg
    >({
      query: () => ({ url: `/api/v1/employees/` }),
    }),
    createEmployee: build.mutation<
      CreateEmployeeApiResponse,
      CreateEmployeeApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/employees/`,
        method: "POST",
        body: queryArg.employeeCreate,
      }),
    }),
    getEmployee: build.query<GetEmployeeApiResponse, GetEmployeeApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/employees/${queryArg.employeeId}`,
      }),
    }),
    updateEmployee: build.mutation<
      UpdateEmployeeApiResponse,
      UpdateEmployeeApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/employees/${queryArg.employeeId}`,
        method: "PUT",
        body: queryArg.employeeUpdate,
      }),
    }),
    deleteEmployee: build.mutation<
      DeleteEmployeeApiResponse,
      DeleteEmployeeApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/employees/${queryArg.employeeId}`,
        method: "DELETE",
      }),
    }),
    getAllCars: build.query<GetAllCarsApiResponse, GetAllCarsApiArg>({
      query: () => ({ url: `/api/v1/cars/` }),
    }),
    createCar: build.mutation<CreateCarApiResponse, CreateCarApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/cars/`,
        method: "POST",
        body: queryArg.carCreate,
      }),
    }),
    searchCars: build.query<SearchCarsApiResponse, SearchCarsApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/cars/search`,
        params: {
          marke: queryArg.marke,
          modelis: queryArg.modelis,
          spalva: queryArg.spalva,
          status: queryArg.status,
          kuro_tipas: queryArg.kuroTipas,
          metai: queryArg.metai,
          sedimos_vietos: queryArg.sedimosVietos,
        },
      }),
    }),
    getCarById: build.query<GetCarByIdApiResponse, GetCarByIdApiArg>({
      query: (queryArg) => ({ url: `/api/v1/cars/${queryArg.carId}` }),
    }),
    updateCar: build.mutation<UpdateCarApiResponse, UpdateCarApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/cars/${queryArg.carId}`,
        method: "PUT",
        body: queryArg.carUpdate,
      }),
    }),
    deleteCar: build.mutation<DeleteCarApiResponse, DeleteCarApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/cars/${queryArg.carId}`,
        method: "DELETE",
      }),
    }),
    updateCarStatus: build.mutation<
      UpdateCarStatusApiResponse,
      UpdateCarStatusApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/cars/${queryArg.carId}/status`,
        method: "PATCH",
        body: queryArg.carStatusUpdate,
      }),
    }),
    getLatestReservations: build.query<
      GetLatestReservationsApiResponse,
      GetLatestReservationsApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/reservations/latest`,
        params: {
          limit: queryArg.limit,
        },
      }),
    }),
    getAllReservations: build.query<
      GetAllReservationsApiResponse,
      GetAllReservationsApiArg
    >({
      query: () => ({ url: `/api/v1/reservations/` }),
    }),
    createReservation: build.mutation<
      CreateReservationApiResponse,
      CreateReservationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/reservations/`,
        method: "POST",
        body: queryArg.reservationCreate,
      }),
    }),
    updateReservation: build.mutation<
      UpdateReservationApiResponse,
      UpdateReservationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/reservations/${queryArg.rezervacijosId}`,
        method: "PUT",
        body: queryArg.reservationUpdate,
      }),
    }),
    deleteReservation: build.mutation<
      DeleteReservationApiResponse,
      DeleteReservationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/reservations/${queryArg.rezervacijosId}`,
        method: "DELETE",
      }),
    }),
    getReservationById: build.query<
      GetReservationByIdApiResponse,
      GetReservationByIdApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/reservations/${queryArg.rezervacijosId}`,
      }),
    }),
    searchReservations: build.query<
      SearchReservationsApiResponse,
      SearchReservationsApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/reservations/search`,
        params: {
          kliento_id: queryArg.klientoId,
          automobilio_id: queryArg.automobilioId,
          nuo: queryArg.nuo,
          iki: queryArg.iki,
          busena: queryArg.busena,
        },
      }),
    }),
    getAllOrders: build.query<GetAllOrdersApiResponse, GetAllOrdersApiArg>({
      query: () => ({ url: `/api/v1/orders/` }),
    }),
    createOrder: build.mutation<CreateOrderApiResponse, CreateOrderApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/orders/`,
        method: "POST",
        body: queryArg.orderCreate,
      }),
    }),
    getOrderById: build.query<GetOrderByIdApiResponse, GetOrderByIdApiArg>({
      query: (queryArg) => ({ url: `/api/v1/orders/${queryArg.uzsakymoId}` }),
    }),
    deleteOrder: build.mutation<DeleteOrderApiResponse, DeleteOrderApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/orders/${queryArg.uzsakymoId}`,
        method: "DELETE",
      }),
    }),
    updateOrder: build.mutation<UpdateOrderApiResponse, UpdateOrderApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/orders/${queryArg.uzsakymoId}`,
        method: "PUT",
        body: queryArg.orderUpdate,
      }),
    }),
    getOrderStatsByStatus: build.query<
      GetOrderStatsByStatusApiResponse,
      GetOrderStatsByStatusApiArg
    >({
      query: () => ({ url: `/api/v1/orders/stats/by-status` }),
    }),
    getOrderByClient: build.query<
      GetOrderByClientApiResponse,
      GetOrderByClientApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/orders/by-client/${queryArg.klientoId}`,
      }),
    }),
    getAllClients: build.query<GetAllClientsApiResponse, GetAllClientsApiArg>({
      query: () => ({ url: `/api/v1/clients/` }),
    }),
    createClient: build.mutation<CreateClientApiResponse, CreateClientApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/clients/`,
        method: "POST",
        body: queryArg.clientCreate,
      }),
    }),
    getClientById: build.query<GetClientByIdApiResponse, GetClientByIdApiArg>({
      query: (queryArg) => ({ url: `/api/v1/clients/${queryArg.klientoId}` }),
    }),
    updateClient: build.mutation<UpdateClientApiResponse, UpdateClientApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/clients/${queryArg.klientoId}`,
        method: "PUT",
        body: queryArg.clientUpdate,
      }),
    }),
    deleteClient: build.mutation<DeleteClientApiResponse, DeleteClientApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/clients/${queryArg.klientoId}`,
        method: "DELETE",
      }),
    }),
    getClientOrder: build.query<
      GetClientOrderApiResponse,
      GetClientOrderApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/clients/${queryArg.klientoId}/orders`,
      }),
    }),
    getAllSupports: build.query<
      GetAllSupportsApiResponse,
      GetAllSupportsApiArg
    >({
      query: () => ({ url: `/api/v1/support/` }),
    }),
    createSupport: build.mutation<
      CreateSupportApiResponse,
      CreateSupportApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/`,
        method: "POST",
        body: queryArg.clientSupportCreate,
      }),
    }),
    getUnansweredSupports: build.query<
      GetUnansweredSupportsApiResponse,
      GetUnansweredSupportsApiArg
    >({
      query: () => ({ url: `/api/v1/support/unanswered` }),
    }),
    getSupport: build.query<GetSupportApiResponse, GetSupportApiArg>({
      query: (queryArg) => ({ url: `/api/v1/support/${queryArg.uzklausosId}` }),
    }),
    answerToSupport: build.mutation<
      AnswerToSupportApiResponse,
      AnswerToSupportApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/${queryArg.uzklausosId}`,
        method: "PATCH",
        body: queryArg.clientSupportUpdate,
      }),
    }),
    getAllInvoices: build.query<
      GetAllInvoicesApiResponse,
      GetAllInvoicesApiArg
    >({
      query: () => ({ url: `/api/v1/invoices/` }),
    }),
    createInvoice: build.mutation<
      CreateInvoiceApiResponse,
      CreateInvoiceApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/invoices/`,
        method: "POST",
        body: queryArg.invoiceCreate,
      }),
    }),
    deleteInvoice: build.mutation<
      DeleteInvoiceApiResponse,
      DeleteInvoiceApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/invoices/${queryArg.invoiceId}`,
        method: "DELETE",
      }),
    }),
    getInvoiceById: build.query<
      GetInvoiceByIdApiResponse,
      GetInvoiceByIdApiArg
    >({
      query: (queryArg) => ({ url: `/api/v1/invoices/${queryArg.invoiceId}` }),
    }),
    updateStatus: build.mutation<UpdateStatusApiResponse, UpdateStatusApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/invoices/${queryArg.invoiceId}/status`,
        method: "PATCH",
        body: queryArg.invoiceStatusUpdate,
      }),
    }),
    geoCode: build.mutation<GeoCodeApiResponse, GeoCodeApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/geocode`,
        method: "POST",
        body: queryArg.geocodeRequest,
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as carRentalApi };
export type GoogleLoginApiV1GoogleLoginGetApiResponse =
  /** status 200 Successful Response */ any;
export type GoogleLoginApiV1GoogleLoginGetApiArg = void;
export type GoogleCallbackApiV1GoogleCallbackGetApiResponse =
  /** status 200 Successful Response */ any;
export type GoogleCallbackApiV1GoogleCallbackGetApiArg = void;
export type LoginApiResponse =
  /** status 200 Successful Response */ TokenResponse;
export type LoginApiArg = {
  loginRequest: LoginRequest;
};
export type RegisterApiResponse = /** status 200 Successful Response */ any;
export type RegisterApiArg = {
  registerRequest: RegisterRequest;
};
export type LogoutApiResponse = /** status 200 Successful Response */ any;
export type LogoutApiArg = void;
export type MeApiV1MeGetApiResponse =
  /** status 200 Successful Response */ UserInfo;
export type MeApiV1MeGetApiArg = void;
export type ChangePasswordApiResponse =
  /** status 200 Successful Response */ any;
export type ChangePasswordApiArg = {
  changePasswordRequest: ChangePasswordRequest;
};
export type SwaggerLoginApiResponse =
  /** status 200 Successful Response */ TokenResponse;
export type SwaggerLoginApiArg = {
  bodySwaggerLogin: BodySwaggerLogin;
};
export type GetAllEmployeesApiResponse =
  /** status 200 Successful Response */ EmployeeOut[];
export type GetAllEmployeesApiArg = void;
export type CreateEmployeeApiResponse =
  /** status 200 Successful Response */ EmployeeOut;
export type CreateEmployeeApiArg = {
  employeeCreate: EmployeeCreate;
};
export type GetEmployeeApiResponse =
  /** status 200 Successful Response */ EmployeeOut;
export type GetEmployeeApiArg = {
  employeeId: number;
};
export type UpdateEmployeeApiResponse =
  /** status 200 Successful Response */ EmployeeOut;
export type UpdateEmployeeApiArg = {
  employeeId: number;
  employeeUpdate: EmployeeUpdate;
};
export type DeleteEmployeeApiResponse =
  /** status 200 Successful Response */ any;
export type DeleteEmployeeApiArg = {
  employeeId: number;
};
export type GetAllCarsApiResponse =
  /** status 200 Successful Response */ CarOut[];
export type GetAllCarsApiArg = void;
export type CreateCarApiResponse = /** status 200 Successful Response */ CarOut;
export type CreateCarApiArg = {
  carCreate: CarCreate;
};
export type SearchCarsApiResponse =
  /** status 200 Successful Response */ CarOut[];
export type SearchCarsApiArg = {
  marke?: string | null;
  modelis?: string | null;
  spalva?: string | null;
  status?: string | null;
  kuroTipas?: string | null;
  metai?: number | null;
  sedimosVietos?: number | null;
};
export type GetCarByIdApiResponse =
  /** status 200 Successful Response */ CarOut;
export type GetCarByIdApiArg = {
  carId: number;
};
export type UpdateCarApiResponse = /** status 200 Successful Response */ CarOut;
export type UpdateCarApiArg = {
  carId: number;
  carUpdate: CarUpdate;
};
export type DeleteCarApiResponse = /** status 200 Successful Response */ any;
export type DeleteCarApiArg = {
  carId: number;
};
export type UpdateCarStatusApiResponse =
  /** status 200 Successful Response */ CarOut;
export type UpdateCarStatusApiArg = {
  carId: number;
  carStatusUpdate: CarStatusUpdate;
};
export type GetLatestReservationsApiResponse =
  /** status 200 Successful Response */ ReservationSummary[];
export type GetLatestReservationsApiArg = {
  limit?: number;
};
export type GetAllReservationsApiResponse =
  /** status 200 Successful Response */ ReservationOut[];
export type GetAllReservationsApiArg = void;
export type CreateReservationApiResponse =
  /** status 200 Successful Response */ ReservationOut;
export type CreateReservationApiArg = {
  reservationCreate: ReservationCreate;
};
export type UpdateReservationApiResponse =
  /** status 200 Successful Response */ ReservationOut;
export type UpdateReservationApiArg = {
  rezervacijosId: number;
  reservationUpdate: ReservationUpdate;
};
export type DeleteReservationApiResponse =
  /** status 200 Successful Response */ any;
export type DeleteReservationApiArg = {
  rezervacijosId: number;
};
export type GetReservationByIdApiResponse =
  /** status 200 Successful Response */ ReservationOut;
export type GetReservationByIdApiArg = {
  rezervacijosId: number;
};
export type SearchReservationsApiResponse =
  /** status 200 Successful Response */ ReservationOut[];
export type SearchReservationsApiArg = {
  klientoId?: number | null;
  automobilioId?: number | null;
  nuo?: string | null;
  iki?: string | null;
  busena?: string | null;
};
export type GetAllOrdersApiResponse =
  /** status 200 Successful Response */ OrderOut[];
export type GetAllOrdersApiArg = void;
export type CreateOrderApiResponse =
  /** status 200 Successful Response */ OrderOut;
export type CreateOrderApiArg = {
  orderCreate: OrderCreate;
};
export type GetOrderByIdApiResponse =
  /** status 200 Successful Response */ OrderOut;
export type GetOrderByIdApiArg = {
  uzsakymoId: number;
};
export type DeleteOrderApiResponse = /** status 200 Successful Response */ any;
export type DeleteOrderApiArg = {
  uzsakymoId: number;
};
export type UpdateOrderApiResponse =
  /** status 200 Successful Response */ OrderOut;
export type UpdateOrderApiArg = {
  uzsakymoId: number;
  orderUpdate: OrderUpdate;
};
export type GetOrderStatsByStatusApiResponse =
  /** status 200 Successful Response */ any;
export type GetOrderStatsByStatusApiArg = void;
export type GetOrderByClientApiResponse =
  /** status 200 Successful Response */ OrderOut[];
export type GetOrderByClientApiArg = {
  klientoId: number;
};
export type GetAllClientsApiResponse =
  /** status 200 Successful Response */ ClientOut[];
export type GetAllClientsApiArg = void;
export type CreateClientApiResponse =
  /** status 200 Successful Response */ ClientOut;
export type CreateClientApiArg = {
  clientCreate: ClientCreate;
};
export type GetClientByIdApiResponse =
  /** status 200 Successful Response */ ClientOut;
export type GetClientByIdApiArg = {
  klientoId: number;
};
export type UpdateClientApiResponse =
  /** status 200 Successful Response */ ClientOut;
export type UpdateClientApiArg = {
  klientoId: number;
  clientUpdate: ClientUpdate;
};
export type DeleteClientApiResponse = /** status 200 Successful Response */ any;
export type DeleteClientApiArg = {
  klientoId: number;
};
export type GetClientOrderApiResponse =
  /** status 200 Successful Response */ OrderOut[];
export type GetClientOrderApiArg = {
  klientoId: number;
};
export type GetAllSupportsApiResponse =
  /** status 200 Successful Response */ ClientSupportOut[];
export type GetAllSupportsApiArg = void;
export type CreateSupportApiResponse =
  /** status 200 Successful Response */ ClientSupportOut;
export type CreateSupportApiArg = {
  clientSupportCreate: ClientSupportCreate;
};
export type GetUnansweredSupportsApiResponse =
  /** status 200 Successful Response */ ClientSupportOut[];
export type GetUnansweredSupportsApiArg = void;
export type GetSupportApiResponse =
  /** status 200 Successful Response */ ClientSupportOut;
export type GetSupportApiArg = {
  uzklausosId: number;
};
export type AnswerToSupportApiResponse =
  /** status 200 Successful Response */ ClientSupportOut;
export type AnswerToSupportApiArg = {
  uzklausosId: number;
  clientSupportUpdate: ClientSupportUpdate;
};
export type GetAllInvoicesApiResponse =
  /** status 200 Successful Response */ InvoiceOut[];
export type GetAllInvoicesApiArg = void;
export type CreateInvoiceApiResponse =
  /** status 200 Successful Response */ InvoiceOut;
export type CreateInvoiceApiArg = {
  invoiceCreate: InvoiceCreate;
};
export type DeleteInvoiceApiResponse =
  /** status 200 Successful Response */ any;
export type DeleteInvoiceApiArg = {
  invoiceId: number;
};
export type GetInvoiceByIdApiResponse =
  /** status 200 Successful Response */ InvoiceOut;
export type GetInvoiceByIdApiArg = {
  invoiceId: number;
};
export type UpdateStatusApiResponse =
  /** status 200 Successful Response */ InvoiceOut;
export type UpdateStatusApiArg = {
  invoiceId: number;
  invoiceStatusUpdate: InvoiceStatusUpdate;
};
export type GeoCodeApiResponse =
  /** status 200 Successful Response */ GeocodeResponse;
export type GeoCodeApiArg = {
  geocodeRequest: GeocodeRequest;
};
export type TokenResponse = {
  access_token: string;
  token_type?: string;
};
export type ValidationError = {
  loc: (string | number)[];
  msg: string;
  type: string;
};
export type HttpValidationError = {
  detail?: ValidationError[];
};
export type LoginRequest = {
  el_pastas: string;
  slaptazodis: string;
};
export type RegisterRequest = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  pareigos: string;
  atlyginimas: number;
  isidarbinimo_data: string;
  slaptazodis: string;
};
export type UserInfo = {
  darbuotojo_id: number;
  vardas: string;
  pavarde: string;
  telefono_nr: string;
  el_pastas: string;
  pareigos: string;
  isidarbinimo_data: string;
};
export type ChangePasswordRequest = {
  senas_slaptazodis: string;
  naujas_slaptazodis: string;
};
export type BodySwaggerLogin = {
  username: string;
  password: string;
};
export type EmployeeOut = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string | null;
  pareigos: string;
  atlyginimas: number;
  isidarbinimo_data: string;
  darbuotojo_id: number;
  links: {
    [key: string]: any;
  }[];
};
export type EmployeeCreate = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string | null;
  pareigos: string;
  atlyginimas: number;
  isidarbinimo_data: string;
  slaptazodis: string;
};
export type EmployeeUpdate = {
  vardas?: string | null;
  pavarde?: string | null;
  el_pastas?: string | null;
  telefono_nr?: string | null;
  pareigos?: string | null;
  atlyginimas?: number | null;
  isidarbinimo_data?: string | null;
  slaptazodis?: string | null;
};
export type LocationOut = {
  vietos_id: number;
  pavadinimas: string;
  adresas: string;
  miestas: string;
};
export type CarOut = {
  marke: string;
  modelis: string;
  metai: number;
  numeris: string;
  vin_kodas: string;
  spalva: string;
  kebulo_tipas: string;
  pavarų_deze: string;
  variklio_turis: number;
  galia_kw: number;
  kuro_tipas: string;
  rida: number;
  sedimos_vietos: number;
  klimato_kontrole: boolean;
  navigacija: boolean;
  kaina_parai: number;
  automobilio_statusas: string;
  technikines_galiojimas: string;
  dabartine_vieta_id: number;
  pastabos: string | null;
  automobilio_id: number;
  lokacija: LocationOut | null;
  links: {
    [key: string]: any;
  }[];
};
export type CarCreate = {
  marke: string;
  modelis: string;
  metai: number;
  numeris: string;
  vin_kodas: string;
  spalva: string;
  kebulo_tipas: string;
  pavarų_deze: string;
  variklio_turis: number;
  galia_kw: number;
  kuro_tipas: string;
  rida: number;
  sedimos_vietos: number;
  klimato_kontrole: boolean;
  navigacija: boolean;
  kaina_parai: number;
  automobilio_statusas: string;
  technikines_galiojimas: string;
  dabartine_vieta_id: number;
  pastabos: string | null;
};
export type CarUpdate = {
  marke?: string | null;
  modelis?: string | null;
  metai?: number | null;
  numeris?: string | null;
  vin_kodas?: string | null;
  spalva?: string | null;
  kebulo_tipas?: string | null;
  pavarų_deze?: string | null;
  variklio_turis?: number | null;
  galia_kw?: number | null;
  kuro_tipas?: string | null;
  rida?: number | null;
  sedimos_vietos?: number | null;
  klimato_kontrole?: boolean | null;
  navigacija?: boolean | null;
  kaina_parai?: number | null;
  automobilio_statusas?: string | null;
  technikines_galiojimas?: string | null;
  dabartine_vieta_id?: number | null;
  pastabos?: string | null;
};
export type CarStatusUpdate = {
  status: string;
};
export type ReservationSummary = {
  rezervacijos_id: number;
  kliento_id: number;
  automobilio_id: number;
  rezervacijos_pradzia: string;
  rezervacijos_pabaiga: string;
  busena: string;
  marke: string;
  modelis: string;
  vardas: string;
  pavarde: string;
  links: {
    [key: string]: any;
  }[];
};
export type ReservationOut = {
  kliento_id: number;
  automobilio_id: number;
  rezervacijos_pradzia: string;
  rezervacijos_pabaiga: string;
  busena: string;
  rezervacijos_id: number;
  links: {
    [key: string]: any;
  }[];
};
export type ReservationCreate = {
  kliento_id: number;
  automobilio_id: number;
  rezervacijos_pradzia: string;
  rezervacijos_pabaiga: string;
  busena: string;
};
export type ReservationUpdate = {
  kliento_id?: number | null;
  automobilio_id?: number | null;
  rezervacijos_pradzia?: string | null;
  rezervacijos_pabaiga?: string | null;
  busena?: string | null;
};
export type OrderOut = {
  kliento_id: number;
  automobilio_id: number;
  darbuotojo_id: number;
  nuomos_data: string;
  grazinimo_data: string;
  paemimo_vietos_id: number;
  grazinimo_vietos_id: number;
  bendra_kaina: number;
  uzsakymo_busena: string;
  turi_papildomas_paslaugas: boolean;
  uzsakymo_id: number;
  links: {
    [key: string]: any;
  }[];
};
export type OrderCreate = {
  kliento_id: number;
  automobilio_id: number;
  darbuotojo_id: number;
  nuomos_data: string;
  grazinimo_data: string;
  paemimo_vietos_id: number;
  grazinimo_vietos_id: number;
  bendra_kaina: number;
  uzsakymo_busena: string;
  turi_papildomas_paslaugas: boolean;
};
export type OrderUpdate = {
  uzsakymo_busena?: string | null;
  grazinimo_data?: string | null;
  turi_papildomas_paslaugas?: boolean | null;
};
export type ClientOut = {
  vardas?: string;
  pavarde?: string;
  el_pastas: string;
  telefono_nr?: string;
  gimimo_data?: string;
  registracijos_data?: string;
  bonus_taskai?: number;
  kliento_id: number;
  links: {
    [key: string]: any;
  }[];
};
export type ClientCreate = {
  vardas?: string;
  pavarde?: string;
  el_pastas: string;
  telefono_nr?: string;
  gimimo_data?: string;
  registracijos_data?: string;
  bonus_taskai?: number;
};
export type ClientUpdate = {
  vardas?: string;
  pavarde?: string;
  el_pastas: string;
  telefono_nr?: string;
  gimimo_data?: string;
  registracijos_data?: string;
  bonus_taskai?: number;
};
export type ClientSupportOut = {
  kliento_id: number;
  darbuotojo_id?: number | null;
  tema: string;
  pranesimas: string;
  atsakymas?: string | null;
  pateikimo_data?: string | null;
  atsakymo_data?: string | null;
  uzklausos_id: number;
  links: {
    [key: string]: any;
  }[];
};
export type ClientSupportCreate = {
  kliento_id: number;
  darbuotojo_id: number;
  tema: string;
  pranesimas: string;
  atsakymas?: string | null;
  pateikimo_data?: string | null;
  atsakymo_data?: string | null;
};
export type ClientSupportUpdate = {
  atsakymas?: string | null;
  atsakymo_data?: string | null;
  darbuotojo_id?: number | null;
};
export type InvoiceOut = {
  order_id: number;
  total: number;
  invoice_date: string;
  invoice_id: number;
  kliento_id: number;
  status: string;
  client_first_name: string;
  client_last_name: string;
  links: {
    [key: string]: any;
  }[];
};
export type InvoiceCreate = {
  order_id: number;
  total: number;
  invoice_date: string;
};
export type InvoiceStatusUpdate = {
  status: string;
};
export type GeocodeResponse = {
  lat: number;
  lng: number;
};
export type GeocodeRequest = {
  adresas: string;
};
export const {
  useGoogleLoginApiV1GoogleLoginGetQuery,
  useGoogleCallbackApiV1GoogleCallbackGetQuery,
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
  useMeApiV1MeGetQuery,
  useChangePasswordMutation,
  useSwaggerLoginMutation,
  useGetAllEmployeesQuery,
  useCreateEmployeeMutation,
  useGetEmployeeQuery,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetAllCarsQuery,
  useCreateCarMutation,
  useSearchCarsQuery,
  useGetCarByIdQuery,
  useUpdateCarMutation,
  useDeleteCarMutation,
  useUpdateCarStatusMutation,
  useGetLatestReservationsQuery,
  useGetAllReservationsQuery,
  useCreateReservationMutation,
  useUpdateReservationMutation,
  useDeleteReservationMutation,
  useGetReservationByIdQuery,
  useSearchReservationsQuery,
  useGetAllOrdersQuery,
  useCreateOrderMutation,
  useGetOrderByIdQuery,
  useDeleteOrderMutation,
  useUpdateOrderMutation,
  useGetOrderStatsByStatusQuery,
  useGetOrderByClientQuery,
  useGetAllClientsQuery,
  useCreateClientMutation,
  useGetClientByIdQuery,
  useUpdateClientMutation,
  useDeleteClientMutation,
  useGetClientOrderQuery,
  useGetAllSupportsQuery,
  useCreateSupportMutation,
  useGetUnansweredSupportsQuery,
  useGetSupportQuery,
  useAnswerToSupportMutation,
  useGetAllInvoicesQuery,
  useCreateInvoiceMutation,
  useDeleteInvoiceMutation,
  useGetInvoiceByIdQuery,
  useUpdateStatusMutation,
  useGeoCodeMutation,
} = injectedRtkApi;
