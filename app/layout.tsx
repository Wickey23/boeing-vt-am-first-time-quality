import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "AM First-Time Quality | Virginia Tech", description: "AI-assisted metallic additive manufacturing build preparation and first-time-quality workspace." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}