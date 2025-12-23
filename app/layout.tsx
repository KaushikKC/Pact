import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import { Header } from "./components/layout/header";
import { MobileNav } from "./components/layout/mobileNav";

export const metadata: Metadata = {
  title: "Pact | Commitments Enforced by Code",
  description: "Commitments Enforced by Code",
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0E0F12] text-white flex flex-col font-space noise-bg">
        <Header />
        
        <main className="flex-1">
          {children}
        </main>
        
        {/* <footer className="hidden md:block border-t border-[#23262F] py-8 px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
            <Image 
              src="/logo.png" 
              alt="Pact Logo" 
              width={20} 
              height={20}
              className="object-contain"
            />
            <span className="text-xs text-[#8E9094]">© 2024 Pact Protocol</span>
          </div>
        </footer> */}
        
        <MobileNav />
      </body>
    </html>
  );
}
