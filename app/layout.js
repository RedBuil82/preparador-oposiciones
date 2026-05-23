import './globals.css'

export const metadata = {
  title: 'Preparador de Oposiciones - Aragón',
  description: 'Generador de tests para oposiciones en Aragón',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
