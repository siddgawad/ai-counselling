import Hero from "@/app/components/Hero";
import CTASection from "@/app/components/CTASection";
import Footer from "@/app/components/Footer";
import Navbar from "./components/Navbar";

/**
 * Home page. It assembles the hero, programs, pricing and CTA sections. It
 * additionally fetches the latest recipes and articles from the backend so
 * visitors can see fresh content immediately. Data fetching happens on the
 * server because this file is a React Server Component.
 */
export default async function Page() {


  return (
    <div className="min-h-dvh bg-sunset">
      <Navbar />
      <div className="pt-10 lg:mx-8 xl:mx-10">
      <Hero />
      <CTASection />  
        </div>
        <Footer />
    </div>
  );
}