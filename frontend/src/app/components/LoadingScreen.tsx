"use client";

// Pilno puslapio "kraunama" ekranas - naudojamas VISUR, kur "isLoading && <LoadingScreen />" (clients/employees/fleet/invoices/orders/reservations/dashboard). Keturių žiedų, skirtingais delay'ais besisukantis efektas NĖRA tiesiog pakeičiamas Tailwind "animate-spin" (tas sukasi kaip VIENAS sluoksnis, ne keturi persidengiantys su skirtingu laiku) - tad CSS čia parašytas ranka, kaip VIENINTELĖ išimtis šiame projekte, kur visur kitur naudojamas Tailwind.
export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center w-full h-[60vh]">
      <div className="flex flex-col items-center">
        <div className="lds-ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>

      <style>{`
        .lds-ring {
          display: inline-block;
          position: relative;
          width: 80px;
          height: 80px;
        }
        .lds-ring div {
          box-sizing: border-box;
          display: block;
          position: absolute;
          width: 64px;
          height: 64px;
          margin: 8px;
          border: 8px solid #2E95D3;
          border-radius: 50%;
          animation: lds-ring 1.2s linear infinite;
          border-color: #2E95D3 transparent transparent transparent;
        }
        .lds-ring div:nth-child(1) {
          animation-delay: -0.45s;
        }
        .lds-ring div:nth-child(2) {
          animation-delay: -0.3s;
        }
        .lds-ring div:nth-child(3) {
          animation-delay: -0.15s;
        }
        @keyframes lds-ring {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
