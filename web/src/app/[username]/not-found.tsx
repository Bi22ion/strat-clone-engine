import Link from 'next/link';

export default function PublicSiteNotFound() {
  return (
    <main className="min-h-[60vh] bg-white px-6 py-24 text-center text-zinc-900">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">Public profile</p>
      <h1 className="mt-4 text-4xl font-bold">Site not found</h1>
      <p className="mx-auto mt-4 max-w-md text-zinc-500">This profile is unavailable or has not been published yet.</p>
      <Link href="/" className="mt-8 inline-flex rounded-lg bg-zinc-900 px-5 py-3 font-semibold text-white transition hover:bg-zinc-700">Return home</Link>
    </main>
  );
}
