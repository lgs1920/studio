import './assets/css/theme.css'
import './assets/css/light.css'
import { StrictMode }  from 'react'
import { createRoot }  from 'react-dom/client'
import { ViewTrack3D } from './ViewTrack3D.jsx'
import './assets/css/app.css'


/**
 * Let's go
 */

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <ViewTrack3D/>
    </StrictMode>)
