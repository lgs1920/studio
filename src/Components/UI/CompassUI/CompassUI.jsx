import './style.css'
import {forwardRef, useEffect} from 'react'
import '@geoblocks/cesium-compass'

export const CompassUI = forwardRef(function CompassUI(props, ref) {

    useEffect(() => {
        const compass = document.querySelector('cesium-compass')
        compass.scene = window.vt3DContext.viewer.scene
        compass.clock = window.vt3DContext.viewer.clock

    }, [])

    return (<cesium-compass></cesium-compass>)
})

