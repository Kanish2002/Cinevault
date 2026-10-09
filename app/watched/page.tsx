import { Suspense } from "react";
import { CineApp } from "@/components/cine-app";
export default function Page() {
  return (
    <Suspense
      fallback={<div className="boot-screen">Opening your CineVault…</div>}
    >
      <CineApp />
    </Suspense>
  );
}
