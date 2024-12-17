import { faArrowsToCircle }  from '@fortawesome/pro-regular-svg-icons'
import { SlIcon }            from '@shoelace-style/shoelace/dist/react'
import { useEffect, useRef } from 'react'
import { FA2SL } from '@Utils/FA2SL'

export const CameraTarget = () => {
    const box = useRef(0)
    const centerBox = () => {
        const width = Math.round(lgs.canvas.clientWidth / 2)
        const height = Math.round(lgs.canvas.clientHeight / 2)
        box.current.style.left = `${(width - box.current.offsetWidth / 2)}px`
        box.current.style.top = `${(height - box.current.offsetHeight / 2)}px`
    }

    useEffect(() => {
        window.addEventListener('resize', centerBox)
        centerBox()
        return () => {
            window.removeEventListener('resize', centerBox)
        }
    }, [])

    return (
        <div id="camera-target" ref={box} style={
            {
                width:  lgs.settings.getUi.cameraTargetIcon.size,
                height: lgs.settings.getUi.cameraTargetIcon.size,
                color:  lgs.settings.getUi.cameraTargetIcon.color,
            }}>
            <SlIcon library="fa" name={FA2SL.set(faArrowsToCircle)}></SlIcon>
        </div>
    )
}
