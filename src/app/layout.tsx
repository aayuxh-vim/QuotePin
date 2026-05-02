import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "QuotePin | AI Chat with Inline Context",
  description: "Highlight any word in an AI response to ask about it in a popup.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "QuotePin",
    description: "Highlight any word in an AI response to ask about it in a popup.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
