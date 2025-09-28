"use client";

import VoiceCircle from "./VoiceCircle";

// Option 1: Add margin and positioning like navbar
export default function Hero() {
    return (
      <section className="glass mx-6 md:mx-8 2xl:mx-30 my-36 px-6 md:px-10 py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold text-slate-900">
              AI Counsellor made for{' '}
              <span className="text-green-800">you</span>.
            </h1>

           
            <p className="mt-5 text-slate-700 leading-relaxed">
              Personalised plans for pregnancy, PCOS, and sustainable weight
              management—guided by evidence, designed for real life.
            </p>
         
          
          </div>
         <div className="flex justify-center">
          <VoiceCircle />
         </div>
        </div>
      </section>
    );
  }