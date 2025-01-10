import './assets/css/theme.css'
import './assets/css/light.css'
import { createRoot } from 'react-dom/client'
import { LGS1920 }    from './LGS1920.jsx'
import './assets/css/app.css?v=1.0.5'
import './assets/css/animations.css'

/**
 * Let's go
 */

createRoot(document.getElementById('lgs1920-container')).render(
    <LGS1920/>,
)
