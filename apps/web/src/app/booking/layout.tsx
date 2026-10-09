import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrivateWorkflowLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
