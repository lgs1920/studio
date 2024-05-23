import './style.css'
import {forwardRef, useEffect} from 'react'
import '@geoblocks/cesium-compass'

export const CompassUI = forwardRef(function CompassUI(props, ref) {

    useEffect(() => {
        const compass = document.querySelector('cesium-compass')
        compass.scene = lgs.viewer.scene
        compass.clock = lgs.viewer.clock

    }, [])

    return (<cesium-compass></cesium-compass>)
})

