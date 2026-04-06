export const metadata = {
  title: 'Отчёты приютов',
  description: 'Система сбора отчётов для приютов',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, padding: 20, fontFamily: 'system-ui' }}>
        {children}
      </body>
    </html>
  )
}