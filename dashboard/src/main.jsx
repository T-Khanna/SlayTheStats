import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/theme.css'
import App from './App.jsx'
import { RunDataProvider } from './data/RunDataContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RunDataProvider>
      <App />
    </RunDataProvider>
  </StrictMode>,
)
