

import Hero from "@/app/components/Hero";
import Navbar from "./components/Navbar";


export default async function Page() {
  return (
    <div className="min-h-screen bg-sunset flex flex-col">
      <Navbar />
      <div>
        <Hero /> 
      </div>

    </div>
  );
}