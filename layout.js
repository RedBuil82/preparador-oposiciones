import './globals.css'

export const metadata = {
  title: 'Preparador de Oposiciones - Aragón',
  description: 'Generador de tests para oposiciones en Aragón (DGA, Ayuntamiento Zaragoza, Diputación)',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
