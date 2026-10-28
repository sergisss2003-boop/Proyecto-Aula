import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fuentes de la tienda (instaladas con npm, se sirven desde el mismo sitio)
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/syne/700.css'
import '@fontsource/syne/800.css'
import './styles/main.scss'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
