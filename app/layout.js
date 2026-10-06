import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "Galaxy Cruise | Fleet Operations & Cruise Intelligence",
  description: "Real-time cruise inventory, scraper health monitoring, and deck plan management.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className={`${inter.className} font-sans antialiased`}
      >
        {children}

        {/* Toast Notifications */}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}