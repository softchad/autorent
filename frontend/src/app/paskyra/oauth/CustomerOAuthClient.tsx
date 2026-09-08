"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/app/providers/CustomerAuthProvider";

export default function CustomerOAuthClient() {
  const router = useRouter();
  const { applyTokenFromOAuth } = useCustomerAuth();
  const [error, setError] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
    const token = new URLSearchParams(hash).get("access_token");
    if (!token) {
      setError(true);
      return;
    }
    applyTokenFromOAuth(token).then(() => router.replace("/paskyra"));
  }, [applyTokenFromOAuth, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0E0B1F] px-4">
      <p className="text-sm text-[#8899AA]">
        {error ? (
          <>
            Nepavyko prisijungti. Grįžkite į{" "}
            <Link href="/" className="text-[#4BAFD4] hover:underline">
              pradinį puslapį
            </Link>{" "}
            ir bandykite dar kartą.
          </>
        ) : (
          "Jungiamasi..."
        )}
      </p>
    </div>
  );
}
