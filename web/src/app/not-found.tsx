import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-24 text-center text-white">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">Strat-Clone Engine</p>
      <h1 className="mt-4 text-5xl font-bold">404</h1>
      <p className="mx-auto mt-4 max-w-md text-zinc-400">This page does not exist or is no longer available.</p>
      <Link href="/" className="mt-8 inline-flex rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-white transition hover:bg-emerald-400">Return home</Link>
    </main>
  );
}
