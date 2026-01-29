import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Sans, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { isAdminAuthed } from "@/lib/auth/server";

export const metadata: Metadata = {
  title: "IT-politisk radar",
  description:
    "Følg danske lov- og beslutningsforslag med fokus på IT-politiske konsekvenser, emner og påvirkning.",
};

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const displayFont = Newsreader({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const showAdmin = await isAdminAuthed();
  return (
    <html lang="da">
      <body
        className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable} antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <nav className="border-b border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper)_85%,white)] backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:color-mix(in_oklab,var(--teal)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--teal)_12%,white)] text-sm font-semibold text-[color:var(--ink)]">
                  IT
                </span>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    IT-politisk radar
                  </div>
                  <div className="font-[family-name:var(--font-serif)] text-lg text-[color:var(--ink)]">
                    Lovforslag med digitalt aftryk
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm text-[color:var(--ink-2)]">
                <Link
                  href="/"
                  className="rounded-full px-3 py-2 transition hover:bg-white/60"
                >
                  Hjem
                </Link>
                <Link
                  href="/om"
                  className="rounded-full px-3 py-2 transition hover:bg-white/60"
                >
                  Om
                </Link>
                <Link
                  href="/kontakt"
                  className="rounded-full px-3 py-2 transition hover:bg-white/60"
                >
                  Kontakt
                </Link>
                {showAdmin ? (
                  <Link
                    href="/admin"
                    className="rounded-full border border-[color:var(--line)] bg-white/55 px-3 py-2 transition hover:bg-white"
                  >
                    Admin
                  </Link>
                ) : null}
              </div>
            </div>
          </nav>

          <div className="flex-1">{children}</div>

          <footer className="border-t border-[color:var(--line)] bg-[color:color-mix(in_oklab,var(--paper)_88%,white)]">
            <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 text-sm text-[color:var(--muted)] sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr] lg:px-8">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-2)]">
                  IT-politisk radar
                </div>
                <p className="mt-3 max-w-md leading-relaxed">
                  Overblik over lov- og beslutningsforslag med IT-politisk betydning.
                </p>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-2)]">
                  Navigation
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <Link href="/" className="transition hover:text-[color:var(--ink)]">
                    Hjem
                  </Link>
                  <Link href="/om" className="transition hover:text-[color:var(--ink)]">
                    Om
                  </Link>
                  <Link href="/kontakt" className="transition hover:text-[color:var(--ink)]">
                    Kontakt
                  </Link>
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--ink-2)]">
                  Kontakt
                </div>
                <div className="mt-3 space-y-2 leading-relaxed">
                  <div>kontakt@it-radar.dk</div>
                  <div>+45 12 34 56 78</div>
                  <div>København, Danmark</div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
