import { Suspense } from "react";
import OAuthClient from "./OAuthClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store"; // kad nieko necachintų

export default function Page() {
  return (
    <Suspense fallback={null}>
      <OAuthClient />
    </Suspense>
  );
}
