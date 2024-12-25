import './assets/css/theme.css'
import './assets/css/light.css'
//import { StrictMode }  from 'react'
import { createRoot } from 'react-dom/client'
import { LGS1920 }    from './LGS1920.jsx'
import './assets/css/app.css'
import './assets/css/animations.css'

/**
 * Let's go
 */

createRoot(document.getElementById('lgs1920-container')).render(
    // <StrictMode>
    <LGS1920/>,
    // </StrictMode>,
)
