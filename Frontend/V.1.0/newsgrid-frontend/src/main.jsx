import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './App.css'
import App from './App.jsx'
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';
import '@fontsource/vazirmatn/800.css';
import '@tabler/icons-webfont/dist/tabler-icons.min.css';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <App />
    </StrictMode>,
)