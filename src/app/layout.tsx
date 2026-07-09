import type { Metadata } from "next";
import { IBM_Plex_Mono, Public_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({ variable: "--font-public-sans", subsets: ["latin"] });
const sourceSerif = Source_Serif_4({ variable: "--font-source-serif", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", weight: ["400", "600", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TaskKeep Empresarial",
  description: "Gestión empresarial de tareas, responsables y recordatorios",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${publicSans.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
