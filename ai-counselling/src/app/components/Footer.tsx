"use client";

import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-white/90 mt-6  backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-10">
        {/* Grid: 1 col on mobile, 3 cols on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 flex items-center md:justify-start justify-center ">
          {/* 1/3 — Logo */}
          <div className="flex justify-center">
          <Image
  src="/logo.png"
  alt="NutriWell logo"
  width={200}
  height={200}
  // This controls which file Next serves at each breakpoint
  sizes="(min-width: 768px) 8rem, (min-width: 640px) 6rem, 4rem"
  // This controls the rendered box size
  className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 object-contain"
  priority
/>
          </div>

          {/* 2/3 — Links */}
          <div className="flex flex-col items-center md:items-start gap-2 text-green-800">
            <Link href="/privacy" className="hover:underline underline-offset-4 decoration-2">Privacy</Link>
            <Link href="/policy" className="hover:underline underline-offset-4 decoration-2">Policy</Link>
            <Link href="/faqs" className="hover:underline underline-offset-4 decoration-2">FAQs</Link>
            <Link href="/refund-policy" className="hover:underline underline-offset-4 decoration-2">Refund Policy</Link>
            <Link href="/terms" className="hover:underline underline-offset-4 decoration-2">Terms of Service</Link>
          </div>

          {/* 3/3 — Social */}
          <div className="flex flex-col items-center md:items-start gap-4">
            <h1 className="text-lg font-semibold text-green-900">Follow us</h1>
            <div className="flex items-center gap-4 text-green-800">
              {/* Instagram */}
              <Link href="https://instagram.com/" aria-label="Instagram" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" title="Instagram">
          
              </Link>
              {/* YouTube */}
              <Link href="https://youtube.com/" aria-label="YouTube" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" title="YouTube">
               
              </Link>
              {/* Facebook */}
              <Link href="https://facebook.com/" aria-label="Facebook" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" title="Facebook">
                
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom small print */}
        <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} NutriWell. All rights reserved.
        </div>
      </div>
    </footer>
  );
}