import Link from 'next/link';
import { Zap, BarChart3, Shield, Bot, ArrowRight, Check } from 'lucide-react';

const features = [
  {
    icon: BarChart3,
    title: 'Behavioral ML Cloning',
    description: 'Upload your trade history and our engine extracts your unique trading patterns, win rates, and risk profiles.',
  },
  {
    icon: Bot,
    title: 'Automated Execution',
    description: 'Deploy trained models as live trading bots that execute via broker APIs with full paper trading support.',
  },
  {
    icon: Shield,
    title: 'Risk Guardrails',
    description: 'Set daily loss limits, monitor real-time P&L, and trigger an emergency kill switch to halt all automation instantly.',
  },
];

const pricing = [
  {
    name: 'Starter',
    price: '$49',
    period: '/month',
    features: ['5 datasets', '2 active models', 'Paper trading only', 'Email support'],
  },
  {
    name: 'Pro',
    price: '$149',
    period: '/month',
    popular: true,
    features: ['Unlimited datasets', '10 active models', 'Live + paper trading', 'Priority support', 'Advanced analytics'],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: ['Unlimited everything', 'Dedicated infrastructure', 'Custom ML pipelines', 'SLA guarantee', 'White-label option'],
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-7 h-7 text-accent-green" />
            <span className="text-xl font-bold">Strat-Clone Engine</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="btn-ghost">Log in</Link>
            <Link href="/signup" className="btn-primary">Get Started</Link>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm mb-8">
            <span className="pulse-dot-green" />
            Automated Trading Intelligence
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Clone Your Trading
            <br />
            <span className="gradient-text">Strategy DNA</span>
          </h1>
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Upload historical trades, train behavioral ML models, and deploy automated bots
            that mirror your edge — with institutional-grade risk controls.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/signup" className="btn-primary text-lg px-8 py-3 flex items-center gap-2">
              Start Free Trial <ArrowRight className="w-5 h-5" />
            </Link>
            <Link href="#features" className="btn-ghost text-lg px-8 py-3">Learn More</Link>
          </div>
        </div>
      </section>

      <section id="features" className="max-w-7xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">Platform Features</h2>
        <p className="text-zinc-400 text-center mb-16 max-w-xl mx-auto">
          Everything you need to transform your trading history into automated execution.
        </p>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((f) => (
            <div key={f.title} className="card-hover group">
              <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                <f.icon className="w-6 h-6 text-accent-green" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">Pricing</h2>
        <p className="text-zinc-400 text-center mb-16">Choose the plan that fits your trading volume.</p>
        <div className="grid md:grid-cols-3 gap-8">
          {pricing.map((tier) => (
            <div
              key={tier.name}
              className={`card-hover relative ${tier.popular ? 'border-accent-cyan ring-1 ring-accent-cyan/30' : ''}`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-accent-cyan text-white text-xs font-medium rounded-full">
                  Most Popular
                </span>
              )}
              <h3 className="text-lg font-semibold mb-1">{tier.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold mono-data">{tier.price}</span>
                <span className="text-zinc-400">{tier.period}</span>
              </div>
              <ul className="space-y-3 mb-8">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-accent-green shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`block text-center py-2.5 rounded-lg font-medium transition-all ${
                  tier.popular ? 'btn-primary w-full' : 'border border-border hover:bg-surface-hover'
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent-green" />
            Strat-Clone Engine
          </div>
          <p>&copy; 2026 Strat-Clone Engine. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
