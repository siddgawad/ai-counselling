'use client';

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import CTASection from "./CTASection";
import { SignedIn, UserButton, SignOutButton } from "@clerk/nextjs";

const navItems: { href: string; label: string }[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/programs", label: "Programs" },
  { href: "/pricing", label: "Plans" },
  { href: "/recipes", label: "Recipes" },
  { href: "/articles", label: "Articles" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const cap: React.SVGProps<SVGPathElement>["strokeLinecap"] = "round";
  const join: React.SVGProps<SVGPathElement>["strokeLinejoin"] = "round";

  return (
    <header className="fixed inset-x-0 z-40 bg-transparent backdrop-blur-[2px]  mt-6 rounded-2xl ">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8  flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="NutriWell logo"
            width={100}
            height={100}
            priority
          />
          <span className="font-bold text-green-800 text-lg tracking-tight hidden sm:block">
            NutriWell
          </span>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-4 text-md lg:gap-10 lg:text-lg font-medium">
          {navItems.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={
                  (isActive ? "text-green-900 font-bold " : "text-green-800") +
                  " hover:underline underline-offset-4 decoration-2"
                }
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: auth (desktop only) + mobile toggle */}
        <div className="flex items-center gap-4 mr-8">
          {/* Desktop auth control (User menu with Sign out) */}
          <div className="hidden md:block">
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>

          {/* Mobile menu toggle visible on small screens */}
          <button
            className="md:hidden p-2 text-green-800 focus:outline-none"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle menu"
          >
            {/* Simple hamburger / close icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-6 w-6"
            >
              {mobileOpen ? (
                <path strokeLinecap={cap} strokeLinejoin={join} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap={cap} strokeLinejoin={join} d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu overlay (no UserButton dropdown; just a clear Sign out button when signed in) */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur border-b border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
            {navItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={pathname === href ? "text-green-900 font-semibold" : "text-green-800"}
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}

            {/* Mobile-only Sign out (visible only when signed in) */}
            <SignedIn>
              <SignOutButton redirectUrl="/">
                <button className="w-full rounded-lg h-auto flex justify-start bg-green-700 px-4 py-2 text-white text-sm">
                  Sign out
                </button>
              </SignOutButton>
            </SignedIn>

            {/* CTA button in mobile menu */}
            <div className="mt-4">
              <CTASection />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
