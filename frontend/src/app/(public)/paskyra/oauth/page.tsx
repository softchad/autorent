import { Suspense } from "react";
import CustomerOAuthClient from "@/app/(public)/paskyra/oauth/CustomerOAuthClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CustomerOAuthClient />
    </Suspense>
  );
}
