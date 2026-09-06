import type { Metadata } from "next";
import "./globals.css";
import { TourProvider } from "../components/tour/TourContext";

export const metadata: Metadata = {
  title: "Revora · Operator Console — Adaptive Revenue Recovery",
  description: "Production-grade fintech console for recurring payment failure diagnosis, interpretable ML propensity scoring, deterministic policy decisions, and simulated customer outreach.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#12172B] text-[#F2F0EA] font-grotesk">
        <TourProvider>
          {children}
        </TourProvider>
      </body>
    </html>
  );
}
