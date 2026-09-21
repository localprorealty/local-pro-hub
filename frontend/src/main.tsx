import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.tsx'
import { ThemeProvider } from './lib/theme.tsx'
import { DemoModeProvider } from './lib/demo-mode.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DemoModeProvider>
        <App />
      </DemoModeProvider>
    </ThemeProvider>
  </StrictMode>,
)
