import './globals.css';

export const metadata = {
  title: 'ChurchConnect',
  description: 'AI-enhanced church management platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
