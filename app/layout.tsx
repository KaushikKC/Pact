import type { Metadata } from "next";
import "./globals.css";
import { Header } from "./components/layout/header";
import { MobileNav } from "./components/layout/mobileNav";

export const metadata: Metadata = {
  title: "Pact | Commitments Enforced by Code",
  description: "Commitments Enforced by Code",
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
        
        <footer className="hidden md:block border-t border-[#23262F] py-12 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-[#F26B3A] flex items-center justify-center font-bold text-[#0E0F12] text-sm">P</div>
              <span className="text-sm font-bold tracking-tighter uppercase">Pact Protocol</span>
            </div>
            
            <div className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094]">
              © 2024 PACT. ENFORCED BY THE MOVEMENT.
            </div>
            
            <div className="flex gap-6">
              {['Docs', 'Github', 'Twitter', 'Status'].map(link => (
                <a key={link} href="#" className="text-[10px] uppercase font-bold tracking-widest text-[#8E9094] hover:text-white transition-colors">{link}</a>
              ))}
            </div>
          </div>
        </footer>
        
        <MobileNav />
      </body>
    </html>
  );
}
