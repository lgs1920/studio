import {StrictMode}  from 'react'

import './assets/css/theme.css'
import {createRoot}  from 'react-dom/client'
import {ViewTrack3D} from './ViewTrack3D.jsx'
import './assets/css/app.css'

createRoot(document.getElementById('root')).render(<StrictMode>
    <ViewTrack3D/>
</StrictMode>)
