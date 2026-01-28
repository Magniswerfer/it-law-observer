import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Law Observer",
  description:
    "Track Danish parliamentary proposals through an IT-policy lens: relevance, topics, and rationale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className="antialiased">{children}</body>
    </html>
  );
}
