import { isAdminAuthed } from '@/lib/auth/server';
import { redirect } from 'next/navigation';

export default async function AdminLoginPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (await isAdminAuthed()) redirect('/admin');

  const sp = await props.searchParams;
  const next = typeof sp.next === 'string' && sp.next.startsWith('/') ? sp.next : '/admin';
  const error = typeof sp.error === 'string' ? sp.error : null;

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[color:var(--line)] bg-white/55 p-8 shadow-[0_18px_60px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted)]">Admin</div>
          <h1 className="mt-2 font-[family-name:var(--font-serif)] text-3xl tracking-tight text-[color:var(--ink)]">
            Log ind
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-2)]">
            Brug din Supabase-bruger. (Kun allowlistede emails får adgang, hvis <span className="font-[family-name:var(--font-mono)]">ADMIN_EMAILS</span> er sat.)
          </p>

          {error ? (
            <div className="mt-5 rounded-2xl border border-[color:color-mix(in_oklab,var(--rose)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--rose)_10%,white)] px-4 py-3 text-sm text-[color:var(--ink)]">
              {error}
            </div>
          ) : null}

          <form className="mt-6 space-y-4" action="/api/auth/login" method="post">
            <input type="hidden" name="next" value={next} />
            <div>
              <label className="block text-sm text-[color:var(--ink-2)]">Email</label>
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-2 text-[color:var(--ink)] shadow-sm outline-none ring-0 focus:border-[color:color-mix(in_oklab,var(--teal)_40%,var(--line))]"
              />
            </div>
            <div>
              <label className="block text-sm text-[color:var(--ink-2)]">Password</label>
              <input
                name="password"
                type="password"
                required
                className="mt-1 w-full rounded-2xl border border-[color:var(--line)] bg-white/70 px-4 py-2 text-[color:var(--ink)] shadow-sm outline-none ring-0 focus:border-[color:color-mix(in_oklab,var(--teal)_40%,var(--line))]"
              />
            </div>
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:-translate-y-0.5"
            >
              Log ind
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

