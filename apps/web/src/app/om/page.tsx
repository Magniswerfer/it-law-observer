export const metadata = {
  title: "Om - IT-politisk radar",
  description:
    "Baggrund for IT-politisk radar og hvordan overblikket er tænkt for borgere, fagfolk og politikere.",
};

export default function OmPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Om
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-serif)] text-3xl tracking-tight text-[color:var(--ink)] sm:text-4xl">
            Et samlet, nøgternt overblik over IT-politik
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[color:var(--muted)] sm:text-base">
            IT-politisk radar samler lov- og beslutningsforslag med digital betydning, så du kan
            følge udviklingen på tværs af sektorer og politiske områder. Målet er at gøre det
            lettere at forstå, hvor IT påvirker regulering, offentlige data og digitale tjenester.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Formål
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                Skabe et neutralt beslutningsgrundlag for borgere, fagfolk og politikere, uden at
                forenkle kompleksiteten i lovarbejdet.
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_60%,white)] p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Anvendelse
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-2)]">
                Brug overblikket til at opdage tendenser, følge specifikke emner og skabe dialog om
                IT-politiske konsekvenser.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
