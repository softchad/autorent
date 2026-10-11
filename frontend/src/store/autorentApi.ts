import { baseApi as api } from "./baseApi";
const injectedRtkApi = api.injectEndpoints({
  endpoints: (build) => ({
    githubLogin: build.query<GithubLoginApiResponse, GithubLoginApiArg>({
      query: () => ({ url: `/api/v1/github/login` }),
    }),
    githubCallback: build.query<
      GithubCallbackApiResponse,
      GithubCallbackApiArg
    >({
      query: () => ({ url: `/api/v1/github/callback` }),
    }),
    googleLogin: build.query<GoogleLoginApiResponse, GoogleLoginApiArg>({
      query: () => ({ url: `/api/v1/google/login` }),
    }),
    customerGoogleLogin: build.query<
      CustomerGoogleLoginApiResponse,
      CustomerGoogleLoginApiArg
    >({
      query: () => ({ url: `/api/v1/customer/google/login` }),
    }),
    googleCallback: build.query<
      GoogleCallbackApiResponse,
      GoogleCallbackApiArg
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
    logout: build.mutation<LogoutApiResponse, LogoutApiArg>({
      query: () => ({ url: `/api/v1/logout`, method: "POST" }),
    }),
    getCurrentUser: build.query<
      GetCurrentUserApiResponse,
      GetCurrentUserApiArg
    >({
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
    getLocations: build.query<GetLocationsApiResponse, GetLocationsApiArg>({
      query: () => ({ url: `/api/v1/cars/locations/all` }),
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
    getStaffConversations: build.query<
      GetStaffConversationsApiResponse,
      GetStaffConversationsApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations`,
        params: {
          filter: queryArg.filter,
        },
      }),
    }),
    getStaffConversation: build.query<
      GetStaffConversationApiResponse,
      GetStaffConversationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations/${queryArg.pokalbioId}`,
      }),
    }),
    claimStaffConversation: build.mutation<
      ClaimStaffConversationApiResponse,
      ClaimStaffConversationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations/${queryArg.pokalbioId}/claim`,
        method: "POST",
      }),
    }),
    reassignStaffConversation: build.mutation<
      ReassignStaffConversationApiResponse,
      ReassignStaffConversationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations/${queryArg.pokalbioId}/reassign`,
        method: "POST",
        body: queryArg.reassignRequest,
      }),
    }),
    addStaffMessage: build.mutation<
      AddStaffMessageApiResponse,
      AddStaffMessageApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations/${queryArg.pokalbioId}/messages`,
        method: "POST",
        body: queryArg.staffMessageCreate,
      }),
    }),
    addStaffNote: build.mutation<AddStaffNoteApiResponse, AddStaffNoteApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations/${queryArg.pokalbioId}/notes`,
        method: "POST",
        body: queryArg.noteCreate,
      }),
    }),
    resolveStaffConversation: build.mutation<
      ResolveStaffConversationApiResponse,
      ResolveStaffConversationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations/${queryArg.pokalbioId}/resolve`,
        method: "POST",
        body: queryArg.resolveRequest,
      }),
    }),
    markStaffConversationSeen: build.mutation<
      MarkStaffConversationSeenApiResponse,
      MarkStaffConversationSeenApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations/${queryArg.pokalbioId}/seen`,
        method: "POST",
        body: queryArg.seenRequest,
      }),
    }),
    issueSupportDiscountCode: build.mutation<
      IssueSupportDiscountCodeApiResponse,
      IssueSupportDiscountCodeApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/support/conversations/${queryArg.pokalbioId}/discount-code`,
        method: "POST",
        body: queryArg.generateDiscountCodeRequest,
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
    geoCode: build.mutation<GeoCodeApiResponse, GeoCodeApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/geocode`,
        method: "POST",
        body: queryArg.geocodeRequest,
      }),
    }),
    getPublicCars: build.query<GetPublicCarsApiResponse, GetPublicCarsApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/public/cars`,
        params: {
          marke: queryArg.marke,
          kebulo_tipas: queryArg.kebuloTipas,
          kuro_tipas: queryArg.kuroTipas,
          pavaru_deze: queryArg.pavaruDeze,
          min_kaina: queryArg.minKaina,
          max_kaina: queryArg.maxKaina,
          sedimos_vietos: queryArg.sedimosVietos,
          vietos_id: queryArg.vietosId,
          only_available: queryArg.onlyAvailable,
          date_from: queryArg.dateFrom,
          date_to: queryArg.dateTo,
        },
      }),
    }),
    getPublicCar: build.query<GetPublicCarApiResponse, GetPublicCarApiArg>({
      query: (queryArg) => ({
        url: `/api/v1/public/cars/${queryArg.automobilioId}`,
        params: {
          date_from: queryArg.dateFrom,
          date_to: queryArg.dateTo,
        },
      }),
    }),
    getPublicCarBusyDates: build.query<
      GetPublicCarBusyDatesApiResponse,
      GetPublicCarBusyDatesApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/public/cars/${queryArg.automobilioId}/busy-dates`,
      }),
    }),
    customerRegister: build.mutation<
      CustomerRegisterApiResponse,
      CustomerRegisterApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/register`,
        method: "POST",
        body: queryArg.customerRegisterRequest,
      }),
    }),
    customerLogin: build.mutation<
      CustomerLoginApiResponse,
      CustomerLoginApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/login`,
        method: "POST",
        body: queryArg.customerLoginRequest,
      }),
    }),
    customerMe: build.query<CustomerMeApiResponse, CustomerMeApiArg>({
      query: () => ({ url: `/api/v1/customer/me` }),
    }),
    updateCustomerProfile: build.mutation<
      UpdateCustomerProfileApiResponse,
      UpdateCustomerProfileApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/profile`,
        method: "PATCH",
        body: queryArg.customerProfileUpdate,
      }),
    }),
    getCustomerReservations: build.query<
      GetCustomerReservationsApiResponse,
      GetCustomerReservationsApiArg
    >({
      query: () => ({ url: `/api/v1/customer/reservations` }),
    }),
    createCustomerReservation: build.mutation<
      CreateCustomerReservationApiResponse,
      CreateCustomerReservationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/reservations`,
        method: "POST",
        body: queryArg.customerReservationCreate,
      }),
    }),
    getCustomerLoyaltyStatus: build.query<
      GetCustomerLoyaltyStatusApiResponse,
      GetCustomerLoyaltyStatusApiArg
    >({
      query: () => ({ url: `/api/v1/customer/loyalty` }),
    }),
    redeemCustomerLoyaltyReward: build.mutation<
      RedeemCustomerLoyaltyRewardApiResponse,
      RedeemCustomerLoyaltyRewardApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/loyalty/rewards/${queryArg.atlygioId}/redeem`,
        method: "POST",
      }),
    }),
    getCustomerDiscountCodes: build.query<
      GetCustomerDiscountCodesApiResponse,
      GetCustomerDiscountCodesApiArg
    >({
      query: () => ({ url: `/api/v1/customer/discount-codes` }),
    }),
    getCustomerConversations: build.query<
      GetCustomerConversationsApiResponse,
      GetCustomerConversationsApiArg
    >({
      query: () => ({ url: `/api/v1/customer/support/conversations` }),
    }),
    createCustomerConversation: build.mutation<
      CreateCustomerConversationApiResponse,
      CreateCustomerConversationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/support/conversations`,
        method: "POST",
        body: queryArg.conversationCreate,
      }),
    }),
    getCustomerConversation: build.query<
      GetCustomerConversationApiResponse,
      GetCustomerConversationApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/support/conversations/${queryArg.pokalbioId}`,
      }),
    }),
    addCustomerMessage: build.mutation<
      AddCustomerMessageApiResponse,
      AddCustomerMessageApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/support/conversations/${queryArg.pokalbioId}/messages`,
        method: "POST",
        body: queryArg.messageCreate,
      }),
    }),
    markCustomerConversationSeen: build.mutation<
      MarkCustomerConversationSeenApiResponse,
      MarkCustomerConversationSeenApiArg
    >({
      query: (queryArg) => ({
        url: `/api/v1/customer/support/conversations/${queryArg.pokalbioId}/seen`,
        method: "POST",
        body: queryArg.seenRequest,
      }),
    }),
  }),
  overrideExisting: false,
});
export { injectedRtkApi as autorentApi };
export type GithubLoginApiResponse = /** status 200 Successful Response */ any;
export type GithubLoginApiArg = void;
export type GithubCallbackApiResponse =
  /** status 200 Successful Response */ any;
export type GithubCallbackApiArg = void;
export type GoogleLoginApiResponse = /** status 200 Successful Response */ any;
export type GoogleLoginApiArg = void;
export type CustomerGoogleLoginApiResponse =
  /** status 200 Successful Response */ any;
export type CustomerGoogleLoginApiArg = void;
export type GoogleCallbackApiResponse =
  /** status 200 Successful Response */ any;
export type GoogleCallbackApiArg = void;
export type LoginApiResponse =
  /** status 200 Successful Response */ TokenResponse;
export type LoginApiArg = {
  loginRequest: LoginRequest;
};
export type LogoutApiResponse = /** status 200 Successful Response */ any;
export type LogoutApiArg = void;
export type GetCurrentUserApiResponse =
  /** status 200 Successful Response */ UserInfo;
export type GetCurrentUserApiArg = void;
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
export type UpdateCarApiResponse = /** status 200 Successful Response */ CarOut;
export type UpdateCarApiArg = {
  carId: number;
  carUpdate: CarUpdate;
};
export type DeleteCarApiResponse = /** status 200 Successful Response */ any;
export type DeleteCarApiArg = {
  carId: number;
};
export type GetLocationsApiResponse =
  /** status 200 Successful Response */ LocationOut[];
export type GetLocationsApiArg = void;
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
export type GetAllOrdersApiResponse =
  /** status 200 Successful Response */ OrderOut[];
export type GetAllOrdersApiArg = void;
export type CreateOrderApiResponse =
  /** status 200 Successful Response */ OrderOut;
export type CreateOrderApiArg = {
  orderCreate: OrderCreate;
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
export type GetAllClientsApiResponse =
  /** status 200 Successful Response */ ClientOut[];
export type GetAllClientsApiArg = void;
export type CreateClientApiResponse =
  /** status 200 Successful Response */ ClientOut;
export type CreateClientApiArg = {
  clientCreate: ClientCreate;
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
export type GetStaffConversationsApiResponse =
  /** status 200 Successful Response */ StaffConversationSummaryOut[];
export type GetStaffConversationsApiArg = {
  filter?: string;
};
export type GetStaffConversationApiResponse =
  /** status 200 Successful Response */ StaffConversationDetailOut;
export type GetStaffConversationApiArg = {
  pokalbioId: number;
};
export type ClaimStaffConversationApiResponse =
  /** status 200 Successful Response */ StaffConversationDetailOut;
export type ClaimStaffConversationApiArg = {
  pokalbioId: number;
};
export type ReassignStaffConversationApiResponse =
  /** status 200 Successful Response */ StaffConversationDetailOut;
export type ReassignStaffConversationApiArg = {
  pokalbioId: number;
  reassignRequest: ReassignRequest;
};
export type AddStaffMessageApiResponse =
  /** status 200 Successful Response */ StaffConversationDetailOut;
export type AddStaffMessageApiArg = {
  pokalbioId: number;
  staffMessageCreate: StaffMessageCreate;
};
export type AddStaffNoteApiResponse =
  /** status 200 Successful Response */ StaffConversationDetailOut;
export type AddStaffNoteApiArg = {
  pokalbioId: number;
  noteCreate: NoteCreate;
};
export type ResolveStaffConversationApiResponse =
  /** status 200 Successful Response */ StaffConversationDetailOut;
export type ResolveStaffConversationApiArg = {
  pokalbioId: number;
  resolveRequest: ResolveRequest;
};
export type MarkStaffConversationSeenApiResponse =
  /** status 200 Successful Response */ StaffConversationSummaryOut;
export type MarkStaffConversationSeenApiArg = {
  pokalbioId: number;
  seenRequest: SeenRequest;
};
export type IssueSupportDiscountCodeApiResponse =
  /** status 200 Successful Response */ DiscountCodeOut;
export type IssueSupportDiscountCodeApiArg = {
  pokalbioId: number;
  generateDiscountCodeRequest: GenerateDiscountCodeRequest;
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
export type GeoCodeApiResponse =
  /** status 200 Successful Response */ GeocodeResponse;
export type GeoCodeApiArg = {
  geocodeRequest: GeocodeRequest;
};
export type GetPublicCarsApiResponse =
  /** status 200 Successful Response */ PublicCarOut[];
export type GetPublicCarsApiArg = {
  marke?: string | null;
  kebuloTipas?: string | null;
  kuroTipas?: string | null;
  pavaruDeze?: string | null;
  minKaina?: number | null;
  maxKaina?: number | null;
  sedimosVietos?: number | null;
  vietosId?: number | null;
  onlyAvailable?: boolean;
  dateFrom?: string | null;
  dateTo?: string | null;
};
export type GetPublicCarApiResponse =
  /** status 200 Successful Response */ PublicCarOut;
export type GetPublicCarApiArg = {
  automobilioId: number;
  dateFrom?: string | null;
  dateTo?: string | null;
};
export type GetPublicCarBusyDatesApiResponse =
  /** status 200 Successful Response */ any;
export type GetPublicCarBusyDatesApiArg = {
  automobilioId: number;
};
export type CustomerRegisterApiResponse =
  /** status 200 Successful Response */ CustomerTokenResponse;
export type CustomerRegisterApiArg = {
  customerRegisterRequest: CustomerRegisterRequest;
};
export type CustomerLoginApiResponse =
  /** status 200 Successful Response */ CustomerTokenResponse;
export type CustomerLoginApiArg = {
  customerLoginRequest: CustomerLoginRequest;
};
export type CustomerMeApiResponse =
  /** status 200 Successful Response */ CustomerInfo;
export type CustomerMeApiArg = void;
export type UpdateCustomerProfileApiResponse =
  /** status 200 Successful Response */ CustomerProfileUpdateOut;
export type UpdateCustomerProfileApiArg = {
  customerProfileUpdate: CustomerProfileUpdate;
};
export type GetCustomerReservationsApiResponse =
  /** status 200 Successful Response */ CustomerReservationOut[];
export type GetCustomerReservationsApiArg = void;
export type CreateCustomerReservationApiResponse =
  /** status 200 Successful Response */ CustomerReservationOut;
export type CreateCustomerReservationApiArg = {
  customerReservationCreate: CustomerReservationCreate;
};
export type GetCustomerLoyaltyStatusApiResponse =
  /** status 200 Successful Response */ LoyaltyStatusOut;
export type GetCustomerLoyaltyStatusApiArg = void;
export type RedeemCustomerLoyaltyRewardApiResponse =
  /** status 200 Successful Response */ RedeemRewardOut;
export type RedeemCustomerLoyaltyRewardApiArg = {
  atlygioId: number;
};
export type GetCustomerDiscountCodesApiResponse =
  /** status 200 Successful Response */ DiscountCodeOut[];
export type GetCustomerDiscountCodesApiArg = void;
export type GetCustomerConversationsApiResponse =
  /** status 200 Successful Response */ ConversationSummaryOut[];
export type GetCustomerConversationsApiArg = void;
export type CreateCustomerConversationApiResponse =
  /** status 200 Successful Response */ ConversationDetailOut;
export type CreateCustomerConversationApiArg = {
  conversationCreate: ConversationCreate;
};
export type GetCustomerConversationApiResponse =
  /** status 200 Successful Response */ ConversationDetailOut;
export type GetCustomerConversationApiArg = {
  pokalbioId: number;
};
export type AddCustomerMessageApiResponse =
  /** status 200 Successful Response */ ConversationDetailOut;
export type AddCustomerMessageApiArg = {
  pokalbioId: number;
  messageCreate: MessageCreate;
};
export type MarkCustomerConversationSeenApiResponse =
  /** status 200 Successful Response */ ConversationSummaryOut;
export type MarkCustomerConversationSeenApiArg = {
  pokalbioId: number;
  seenRequest: SeenRequest;
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
export type UserInfo = {
  darbuotojo_id: number;
  vardas: string;
  pavarde: string;
  telefono_nr: string;
  el_pastas: string;
  pareigos: string;
  atlyginimas: number;
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
  telefono_nr: string;
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
  telefono_nr: string;
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
  pavaru_deze: string;
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
  pastabos?: string | null;
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
  pavaru_deze: string;
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
  pastabos?: string | null;
};
export type CarUpdate = {
  marke?: string | null;
  modelis?: string | null;
  metai?: number | null;
  numeris?: string | null;
  vin_kodas?: string | null;
  spalva?: string | null;
  kebulo_tipas?: string | null;
  pavaru_deze?: string | null;
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
  nuolaidos_kodas?: string | null;
};
export type OrderUpdate = {
  uzsakymo_busena?: string | null;
  grazinimo_data?: string | null;
  turi_papildomas_paslaugas?: boolean | null;
};
export type ClientOut = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  registracijos_data?: string | null;
  kliento_id: number;
  links: {
    [key: string]: any;
  }[];
};
export type ClientCreate = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  registracijos_data?: string | null;
};
export type ClientUpdate = {
  vardas?: string | null;
  pavarde?: string | null;
  el_pastas?: string | null;
  telefono_nr?: string | null;
  gimimo_data?: string | null;
  registracijos_data?: string | null;
};
export type ReservationContext = {
  rezervacijos_id: number;
  marke: string;
  modelis: string;
  rezervacijos_pradzia: string;
  rezervacijos_pabaiga: string;
};
export type StaffConversationSummaryOut = {
  pokalbio_id: number;
  tema: string;
  kategorija: string;
  busena: string;
  sukurimo_data: string;
  atnaujinimo_data: string;
  paskutine_zinute?: string | null;
  paskutine_zinute_autorius?: string | null;
  neperskaityta?: boolean;
  rezervacija?: ReservationContext | null;
  sprendimo_santrauka?: string | null;
  kliento_vardas: string;
  darbuotojo_id?: number | null;
  darbuotojo_vardas?: string | null;
  reikia_atsakyti?: boolean;
};
export type MessageOut = {
  zinutes_id: number;
  autoriaus_tipas: string;
  autorius_vardas?: string | null;
  tekstas: string;
  sukurimo_data: string;
};
export type NoteOut = {
  pastabos_id: number;
  darbuotojo_vardas: string;
  tekstas: string;
  sukurimo_data: string;
};
export type StaffConversationDetailOut = {
  pokalbio_id: number;
  tema: string;
  kategorija: string;
  busena: string;
  sukurimo_data: string;
  atnaujinimo_data: string;
  paskutine_zinute?: string | null;
  paskutine_zinute_autorius?: string | null;
  neperskaityta?: boolean;
  rezervacija?: ReservationContext | null;
  sprendimo_santrauka?: string | null;
  kliento_vardas: string;
  darbuotojo_id?: number | null;
  darbuotojo_vardas?: string | null;
  reikia_atsakyti?: boolean;
  zinutes: MessageOut[];
  pastabos: NoteOut[];
};
export type ReassignRequest = {
  darbuotojo_id: number;
};
export type StaffMessageCreate = {
  tekstas: string;
  busena: string;
};
export type NoteCreate = {
  tekstas: string;
};
export type ResolveRequest = {
  santrauka: string;
};
export type SeenRequest = {
  zinutes_id: number;
};
export type DiscountCodeOut = {
  kodo_id: number;
  kodas: string;
  verte_eur: number;
  kilme: string;
  pastaba?: string | null;
  sukurimo_data?: string | null;
  panaudojimo_data?: string | null;
};
export type GenerateDiscountCodeRequest = {
  verte_eur: number;
  priezastis: string;
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
export type GeocodeResponse = {
  lat: number;
  lng: number;
};
export type GeocodeRequest = {
  adresas: string;
};
export type PublicCarOut = {
  automobilio_id: number;
  marke: string;
  modelis: string;
  metai: number;
  spalva: string;
  kebulo_tipas: string;
  pavaru_deze: string;
  variklio_turis: number;
  galia_kw: number;
  kuro_tipas: string;
  rida: number;
  sedimos_vietos: number;
  klimato_kontrole: boolean;
  navigacija: boolean;
  kaina_parai: number;
  automobilio_statusas: string;
  lokacija: LocationOut | null;
  laisvas_pasirinktu_laikotarpiu?: boolean | null;
};
export type CustomerTokenResponse = {
  access_token: string;
  token_type?: string;
};
export type CustomerRegisterRequest = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  slaptazodis: string;
};
export type CustomerLoginRequest = {
  el_pastas: string;
  slaptazodis: string;
};
export type CustomerInfo = {
  kliento_id: number;
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  registracijos_data?: string | null;
};
export type CustomerProfileUpdateOut = {
  kliento_id: number;
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  registracijos_data?: string | null;
  access_token?: string | null;
};
export type CustomerProfileUpdate = {
  vardas?: string | null;
  pavarde?: string | null;
  el_pastas?: string | null;
  telefono_nr?: string | null;
  gimimo_data?: string | null;
};
export type CustomerReservationOut = {
  rezervacijos_id: number;
  automobilio_id: number;
  marke: string;
  modelis: string;
  rezervacijos_pradzia: string;
  rezervacijos_pabaiga: string;
  busena: string;
  dienu_skaicius: number;
  kaina_parai: number;
  viso_kaina: number;
};
export type CustomerReservationCreate = {
  automobilio_id: number;
  date_from: string;
  date_to: string;
};
export type LoyaltyRewardOut = {
  atlygio_id: number;
  etapo_numeris: number;
  busena: string;
  verte_eur: number;
  sukurimo_data?: string | null;
  panaudojimo_data?: string | null;
};
export type LoyaltyStatusOut = {
  uzbaigtu_nuomu_skaicius: number;
  progresas_dabartiniame_etape: number;
  etapo_dydis: number;
  atlygio_verte_eur: number;
  atlygiai: LoyaltyRewardOut[];
};
export type RedeemRewardOut = {
  atlygio_id: number;
  etapo_numeris: number;
  busena: string;
  verte_eur: number;
  sukurimo_data?: string | null;
  panaudojimo_data?: string | null;
  kodas: string;
};
export type ConversationSummaryOut = {
  pokalbio_id: number;
  tema: string;
  kategorija: string;
  busena: string;
  sukurimo_data: string;
  atnaujinimo_data: string;
  paskutine_zinute?: string | null;
  paskutine_zinute_autorius?: string | null;
  neperskaityta?: boolean;
  rezervacija?: ReservationContext | null;
  sprendimo_santrauka?: string | null;
};
export type ConversationDetailOut = {
  pokalbio_id: number;
  tema: string;
  kategorija: string;
  busena: string;
  sukurimo_data: string;
  atnaujinimo_data: string;
  paskutine_zinute?: string | null;
  paskutine_zinute_autorius?: string | null;
  neperskaityta?: boolean;
  rezervacija?: ReservationContext | null;
  sprendimo_santrauka?: string | null;
  zinutes: MessageOut[];
};
export type ConversationCreate = {
  tema: string;
  kategorija?: string;
  pranesimas: string;
  rezervacijos_id?: number | null;
};
export type MessageCreate = {
  tekstas: string;
};
export const {
  useGithubLoginQuery,
  useGithubCallbackQuery,
  useGoogleLoginQuery,
  useCustomerGoogleLoginQuery,
  useGoogleCallbackQuery,
  useLoginMutation,
  useLogoutMutation,
  useGetCurrentUserQuery,
  useChangePasswordMutation,
  useSwaggerLoginMutation,
  useGetAllEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useGetAllCarsQuery,
  useCreateCarMutation,
  useUpdateCarMutation,
  useDeleteCarMutation,
  useGetLocationsQuery,
  useGetLatestReservationsQuery,
  useGetAllReservationsQuery,
  useCreateReservationMutation,
  useUpdateReservationMutation,
  useDeleteReservationMutation,
  useGetAllOrdersQuery,
  useCreateOrderMutation,
  useDeleteOrderMutation,
  useUpdateOrderMutation,
  useGetAllClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
  useGetClientOrderQuery,
  useGetStaffConversationsQuery,
  useGetStaffConversationQuery,
  useClaimStaffConversationMutation,
  useReassignStaffConversationMutation,
  useAddStaffMessageMutation,
  useAddStaffNoteMutation,
  useResolveStaffConversationMutation,
  useMarkStaffConversationSeenMutation,
  useIssueSupportDiscountCodeMutation,
  useGetAllInvoicesQuery,
  useCreateInvoiceMutation,
  useDeleteInvoiceMutation,
  useGeoCodeMutation,
  useGetPublicCarsQuery,
  useGetPublicCarQuery,
  useGetPublicCarBusyDatesQuery,
  useCustomerRegisterMutation,
  useCustomerLoginMutation,
  useCustomerMeQuery,
  useUpdateCustomerProfileMutation,
  useGetCustomerReservationsQuery,
  useCreateCustomerReservationMutation,
  useGetCustomerLoyaltyStatusQuery,
  useRedeemCustomerLoyaltyRewardMutation,
  useGetCustomerDiscountCodesQuery,
  useGetCustomerConversationsQuery,
  useCreateCustomerConversationMutation,
  useGetCustomerConversationQuery,
  useAddCustomerMessageMutation,
  useMarkCustomerConversationSeenMutation,
} = injectedRtkApi;
