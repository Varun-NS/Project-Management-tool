import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { Toaster } from "@/components/ui/sonner";
import { BackgroundProvider } from "@/components/providers/BackgroundProvider";
import { MainArea } from "@/components/layout/MainArea";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Project Management Tool",
  description: "A modern, intuitive project management tool.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground overflow-hidden`}>
        <BackgroundProvider>
          <div className="flex flex-col h-screen">
            <Header />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <MainArea>{children}</MainArea>
            </div>
          </div>
          <Toaster />
        </BackgroundProvider>
      </body>
    </html>
  );
}
