import './style.css'
import { useEffect } from 'react'
import '@geoblocks/cesium-compass'

export const CompassUI = () => {

    useEffect(() => {
        const compass = document.querySelector('cesium-compass')
        compass.scene = lgs.viewer.scene
        compass.clock = lgs.viewer.clock

    }, [])

    return (<cesium-compass></cesium-compass>)
}

