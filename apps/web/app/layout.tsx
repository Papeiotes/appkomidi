import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const sans = Manrope({ subsets: ["latin", "greek"], variable: "--font-manrope" });
const serif = Source_Serif_4({ subsets: ["latin", "greek"], variable: "--font-source" });

export const metadata: Metadata = {
  title: "Αποκομιδή",
  description: "Ραντεβού αποκομιδής για επιχειρήσεις. Commercial waste pickup appointments.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="el" className={`${sans.variable} ${serif.variable} h-full`} suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
      </head>
      <body className="min-h-full antialiased">
        <ThemeProvider attribute="class" forcedTheme="light" enableSystem={false}>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
