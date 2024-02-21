import './style.css'
import {forwardRef, useEffect} from 'react'
import '@geoblocks/cesium-compass'

export const CompassUI = forwardRef(function CompassUI(props, ref) {

    useEffect(() => {
        const compass = document.querySelector('cesium-compass')
        compass.scene = vt3d.viewer.scene
        compass.clock = vt3d.viewer.clock

    }, [])

    return (<cesium-compass></cesium-compass>)
})

