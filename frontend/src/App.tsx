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
                boxShadow: '0 4px 20px -4px hsl(var(--foreground) / 0.15)',
              },
              success: {
                iconTheme: {
                  primary: 'hsl(142, 76%, 36%)',
                  secondary: 'hsl(var(--card))',
                },
                style: {
                  border: '1px solid hsl(142, 76%, 36%, 0.4)',
                },
              },
              error: {
                iconTheme: {
                  primary: 'hsl(var(--destructive))',
                  secondary: 'hsl(var(--destructive-foreground))',
                },
                style: {
                  border: '1px solid hsl(var(--destructive) / 0.4)',
                },
              },
              loading: {
                iconTheme: {
                  primary: 'hsl(var(--primary))',
                  secondary: 'hsl(var(--card))',
                },
              },
            }}
          />
        </>
      )}
    </>
  )
}
