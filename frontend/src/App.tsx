import { useState, useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { router } from './config/routes'
import { LoadingScreen } from './components/ui'

export default function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [showApp, setShowApp] = useState(false)

  useEffect(() => {
    // Show app content after a brief delay for smooth transition
    if (!isLoading) {
      const timer = setTimeout(() => setShowApp(true), 100)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  return (
    <>
      {isLoading && (
        <LoadingScreen
          minDuration={2500}
          onLoadingComplete={() => setIsLoading(false)}
        />
      )}
      {showApp && (
        <>
          <RouterProvider router={router} />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: 'hsl(var(--card))',
                color: 'hsl(var(--card-foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </>
      )}
    </>
  )
}
