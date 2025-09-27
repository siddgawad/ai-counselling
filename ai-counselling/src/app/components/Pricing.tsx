type Plan = {
    name: string;
    priceInr: number;
    periodLabel: string;
    highlight?: boolean;
    features: string[];
  };
  
  const plans: Plan[] = [
    {
      name: "Starter",
      priceInr: 8000,
      periodLabel: "1 Month",
      features: [
        "Custom weekly meal plan",
        "1× call + weekly text check‑ins",
        "Macros, grocery list, eating‑out guide",
      ],
    },
    {
      name: "Growth",
      priceInr: 15000,
      periodLabel: "3 Months",
      highlight: true,
      features: [
        "Everything in Starter",
        "Bi‑weekly calls + habit tracking",
        "Program switch option (e.g., PCOS → Standard)",
      ],
    },
    {
      name: "Transform",
      priceInr: 22000,
      periodLabel: "6 Months",
      features: [
        "Everything in Growth",
        "Recipe pack + festival/holiday playbook",
        "Priority chat support",
      ],
    },
  ];
  
  function formatInr(n: number) {
    return `₹${n.toLocaleString("en-IN")}`;
  }
  
  /**
   * Pricing section showing the available plan tiers. The highlight property
   * emphasises the recommended plan. This section is static but could be
   * configured via a CMS in the future.
   */
  export default function Pricing() {
    return (
      <section id="pricing" className="bg-white/30 backdrop-blur-[2px] mx-6 md:mx-8 2xl:mx-30 my-36 rounded-2xl px-6 md:px-10 py-12 md:py-20"
>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="text-2xl md:text-4xl font-bold text-slate-900">
              Plans & Pricing
            </h2>
            <p className="mt-3 text-slate-700">
              Simple, transparent plans. Choose 1, 3, or 6 months — upgrade anytime.
            </p>
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={[
                  "rounded-2xl border p-6 bg-white",
                  plan.highlight
                    ? "border-green-700 shadow-[0_0_0_2px_rgba(21,128,61,0.15)]"
                    : "border-slate-200",
                ].join(" ")}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-lg font-semibold text-green-800">
                    {plan.name}
                  </h3>
                  <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-1">
                    {plan.periodLabel}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-slate-900">
                    {formatInr(plan.priceInr)}
                  </div>
                  <div className="text-sm text-slate-500">
                    inclusive of onboarding
                  </div>
                </div>
                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-green-800 px-4 py-3 text-white font-semibold hover:bg-green-700"
                >
                  Get Started
                </a>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-500">
            * Prices shown in INR. International billing available on request.
          </p>
        </div>
      </section>
    );
  }