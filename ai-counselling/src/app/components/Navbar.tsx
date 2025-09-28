
import { SignedIn, UserButton} from "@clerk/nextjs";


export default function Navbar() {
return (
    <header className="fixed inset-x-0 z-40 bg-transparent backdrop-blur-[2px]  mt-6 rounded-2xl ">
         <div className="flex pr-10 justify-end bg-transparent">
         {/* Desktop auth control (User menu with Sign out) */}
         <SignedIn>
              <UserButton />
            </SignedIn>
      </div>
         

          


    </header>
  );
}
