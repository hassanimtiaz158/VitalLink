export const metadata = {
  title: "VitalLink",
  description: "Real-time blood & organ donor matching",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
