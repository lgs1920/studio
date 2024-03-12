import './assets/css/theme.css'
import {createRoot}  from 'react-dom/client'
import {ViewTrack3D} from './ViewTrack3D.jsx'
import './assets/css/app.css'


/**
 * Let's go
 */

createRoot(document.getElementById('root')).render(
    <ViewTrack3D/>,
)
