import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-6 py-16">
      <article className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-sm text-emerald-400 hover:text-emerald-300">← Back to Strat-Clone</Link>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Legal</p>
          <h1 className="mt-3 text-4xl font-bold">Terms of Service</h1>
        </div>
        <section className="space-y-4 text-zinc-400 leading-7">
          <p>Strat-Clone Engine provides tools for researching, simulating, and monitoring trading strategies. The service is not investment advice and does not guarantee performance.</p>
          <h2 className="text-xl font-semibold text-white">Responsible use</h2>
          <p>You are responsible for reviewing strategies, protecting your credentials, and complying with the rules that apply to your account and jurisdiction. Always use paper trading while evaluating a strategy.</p>
          <h2 className="text-xl font-semibold text-white">Broker connections</h2>
          <p>Live broker access is optional and should only be enabled after you understand the risks. We do not custody funds or control your brokerage account beyond the permissions you authorize.</p>
          <h2 className="text-xl font-semibold text-white">Changes</h2>
          <p>We may update these terms as the product evolves. Continued use after an update means you accept the revised terms.</p>
        </section>
      </article>
    </main>
  );
}
