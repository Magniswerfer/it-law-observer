export const metadata = {
  title: "Kontakt - IT-politisk radar",
  description:
    "Kontaktinformation og praktiske oplysninger om dialog vedrørende IT-politisk radar.",
};

export default function KontaktPage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[color:var(--line)] bg-white/60 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Kontakt
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-serif)] text-3xl tracking-tight text-[color:var(--ink)] sm:text-4xl">
            Dialog og praktisk info
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-[color:var(--muted)] sm:text-base">
            Har du forslag til forbedringer, manglende emner eller spørgsmål til visningen? Vi
            tager gerne imod input og samarbejder om at holde overblikket relevant.
          </p>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Kontakt
              </div>
              <div className="mt-3 space-y-2 text-sm text-[color:var(--ink-2)]">
                <div>kontakt@it-radar.dk</div>
                <div>+45 12 34 56 78</div>
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper-2)_60%,white)] p-5">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Adresse
              </div>
              <div className="mt-3 text-sm text-[color:var(--ink-2)]">
                København, Danmark
              </div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">
                Brug gerne din sædvanlige faglige kanal, hvis du allerede har en kontakt.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
