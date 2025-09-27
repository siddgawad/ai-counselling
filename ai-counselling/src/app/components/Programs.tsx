type Program = {
    key: string;
    title: string;
    blurb: string;
    points: string[];
  };
  
  const programs: Program[] = [
    {
      key: "pregacare",
      title: "Pregacare",
      blurb:
        "Trimester‑wise nutrition to support mother & baby — energy, micronutrients, and safe weight gain.",
      points: [
        "Trimester meal maps",
        "Nausea/acid reflux strategies",
        "Lab markers guidance",
      ],
    },
    {
      key: "pcos",
      title: "PCOS Management",
      blurb:
        "Lower symptoms via insulin‑aware meal design, protein targets, and sustainable routines.",
      points: [
        "Cycle‑aware plans",
        "Protein & fibre targets",
        "Supplement literacy",
      ],
    },
    {
      key: "seasonal",
      title: "Seasonal 6‑Week Plan",
      blurb:
        "A focused 6‑week sprint aligning meals to seasonal produce for taste, budget, and adherence.",
      points: ["Weekly menus", "Food swaps list", "Habit tracking"],
    },
    {
      key: "standard",
      title: "Standard Plans",
      blurb:
        "Clean, affordable coaching for weight, lipid & glucose control with weekly check‑ins.",
      points: ["Macro guidance", "Home & eating‑out playbook", "Weekly review"],
    },
    {
      key: "gold",
      title: "Gold Plans",
      blurb:
        "High‑touch coaching with deeper analytics, custom recipes, and priority chat.",
      points: [
        "Unlimited adjustments",
        "Custom recipe pack",
        "Priority support",
      ],
    },
  ];
  
  export default function Programs() {
    return (
      <section id="programs" className="glass mx-6 md:mx-8 2xl:mx-30 my-36 px-6 md:px-10 py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900">
            Programs
          </h2>
          <p className="mt-3 text-slate-600">
            Choose a path that fits your life stage and goals.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
            {programs.map((p) => (
              <article
                key={p.key}
                className="rounded-2xl border border-slate-200 bg-white p-6 hover:shadow-md transition"
              >
                <h3 className="text-lg font-semibold text-green-800">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">{p.blurb}</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-700">
                  {p.points.map((pt, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-green-700" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }