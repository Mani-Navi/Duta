import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// OPTIMIZED: Load only regular (400) and bold (700) weights to save 1,400ms on mobile
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/700.css';

// Tabler Icons Webfont
import '@tabler/icons-webfont/dist/tabler-icons.min.css';

import './App.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </StrictMode>,
)