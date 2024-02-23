import './assets/css/theme.css'
import {createRoot}  from 'react-dom/client'
import {ViewTrack3D} from './ViewTrack3D.jsx'
import './assets/css/app.css'

//TODO Manage strict mode but avoid to have 2 launches
createRoot(document.getElementById('root')).render(
    <ViewTrack3D/>,
)
