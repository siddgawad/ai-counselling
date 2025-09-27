// import StreakPill from "./ui/StreakPill";
// import ProgressRing from "./ui/ProgressRing";

import Image from "next/image";
import heroSunset from "../../../public/heroSunset.png"

// Option 1: Add margin and positioning like navbar
export default function Hero() {
    return (
      <section className="glass mx-6 md:mx-8 2xl:mx-30 my-36 px-6 md:px-10 py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900">
              Nutrition that adapts to{' '}
              <span className="text-green-800">you</span>.
            </h1>

            {/* the streak and pill thing */}
            {/* <div className="mt-4 flex items-center gap-3">
  <StreakPill days={7}/>
  <div className="hidden sm:block"><ProgressRing xp={70} goal={100}/></div>
</div> */}
            <p className="mt-5 text-slate-700 leading-relaxed">
              Personalised plans for pregnancy, PCOS, and sustainable weight
              management—guided by evidence, designed for real life.
            </p>
            <div className="mt-8 flex gap-3">
              <a
                href="#pricing"
                className="inline-flex items-center justify-center rounded-xl bg-green-800 px-5 py-3 text-white font-semibold hover:bg-green-700"
              >
                View Plans
              </a>
              <a
                href="#programs"
                className="inline-flex items-center justify-center rounded-xl border border-green-800 px-5 py-3 text-green-800 font-semibold hover:bg-green-100"
              >
                Explore Programs
              </a>
            </div>
            <div className="mt-6 text-xs text-slate-500">
              * WhatsApp onboarding in 24 hours · Flexible meal styles · India &
              Global clients
            </div>
          </div>
          <div className="aspect-[4/3] md:aspect-square rounded-2xl bg-white/30 backdrop-blur-sm shadow-inner border border-white/20 flex items-center justify-center">
          <Image src={heroSunset} alt={"Hero Image"}/>
          </div>
        </div>
      </section>
    );
  }