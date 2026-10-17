import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-16">
      <article className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">← Back to Strat-Clone</Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Legal</p>
          <h1 className="mt-3 text-4xl font-bold">Privacy Policy</h1>
        </div>
        <section className="space-y-4 text-zinc-400 leading-7">
          <p>We collect the account, dataset, and strategy information needed to provide Strat-Clone Engine. We use this information to authenticate you, operate simulations, and improve the service.</p>
          <h2 className="text-xl font-semibold text-white">Your data</h2>
          <p>Uploaded trading datasets remain associated with your account. Broker credentials are encrypted before storage and are never displayed in the dashboard.</p>
          <h2 className="text-xl font-semibold text-white">Your choices</h2>
          <p>You can request access to, correction of, or deletion of your account data by contacting support. We retain limited records where required for security or legal compliance.</p>
          <h2 className="text-xl font-semibold text-white">Security</h2>
          <p>Keep your password and broker credentials private. No internet service can promise absolute security, but we use access controls and encrypted storage to reduce risk.</p>
        </section>
      </article>
    </main>
  );
}
