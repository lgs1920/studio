import './assets/css/theme.css'
import './assets/css/light.css'
//import { StrictMode }  from 'react'
import { createRoot } from 'react-dom/client'
import { LGS1920 }    from './LGS1920.jsx'
import './assets/css/app.css'

/**
 * Let's go
 */

createRoot(document.getElementById('root')).render(
    // <StrictMode>
    <LGS1920/>,
    // </StrictMode>,
)
