import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-16 text-[color:var(--muted)] sm:px-6 lg:px-8">
          Indlæser radar…
        </div>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
