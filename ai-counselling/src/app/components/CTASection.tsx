export default function CTASection() {
    return (
      <section id="contact" className="bg-white/30 backdrop-blur-[2px] mx-6 md:mx-8 2xl:mx-30 my-36 rounded-2xl px-6 md:px-10 py-12 md:py-20"
>
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-2xl md:text-3xl font-bold text-slate-900">
            Ready to start?
          </h3>
          <p className="mt-3 text-slate-600">
            Tell us your goal (PCOS, pregnancy, fat loss, or general wellness). We’ll
            reply within 24 hours with your onboarding link.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/###########"
              className="rounded-xl bg-green-800 px-6 py-3 text-white font-semibold hover:bg-green-700"
            >
              WhatsApp Us
            </a>
            <a
              href="mailto:hello@nutriwell.fit"
              className="rounded-xl border border-green-800 px-6 py-3 text-green-800 font-semibold hover:bg-green-50"
            >
              Email
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            By booking, you agree to our Terms & Privacy.
          </p>
        </div>
      </section>
    );
  }