import { JOURNEY_EDITOR_DRAWER }            from '@Core/constants'
import { JourneySelector }                  from '@Editor/journey/JourneySelector'
import { Utils }                            from '@Editor/Utils'
import { faGripDotsVertical, faSquarePlus } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlIconButton, SlTooltip }  from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                            from '@Utils/FA2SL'
import { useRef, useState }                 from 'react'
import { useSnapshot }                      from 'valtio'

export const JourneyToolbar = (props) => {

    const mainUI = lgs.mainProxy.components.mainUI
    const store = lgs.settings.ui.journeyToolbar
    const settings = useSnapshot(store)
    const [offset, setOffset] = useState({x: 0, y: 0})
    const targetRef = useRef(null)
    const grabber = useRef(null)
    const animationFrame = useRef(null)
    const journeyLoaderStore = lgs.mainProxy.components.mainUI.journeyLoader

    const hideToolbar = (event) => {
        mainUI.journeyMenu.active = false
    }

    const journeyLoader = () => {
        journeyLoaderStore.visible = true
    }


    const newJourneySelection = async (event) => {
        await Utils.updateJourneyEditor(event.target.value, {})
    }

    const handleMouseDown = (event) => {
        const rect = targetRef.current.getBoundingClientRect()
        const offsetX = event.clientX - rect.left
        const offsetY = event.clientY - rect.top
        targetRef.current.classList.add('dragging')

        const handleMouseMove = (event) => {
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current)
            }
            animationFrame.current = requestAnimationFrame(() => {
                store.y = event.clientY - offsetY
                store.x = event.clientX - offsetX
            })
        }

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            targetRef.current.classList.remove('dragging')
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current)
                animationFrame.current = null
            }

        }

        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }

    return (
        <div className="journey-toolbar lgs-card on-map" ref={targetRef} style={{top: settings.y, left: settings.x}}>
            <SlTooltip hoist content={'Drag me'}>
                <SlIcon ref={grabber} className="grabber" library="fa" name={FA2SL.set(faGripDotsVertical)}
                        onPointerDown={handleMouseDown}
                />
            </SlTooltip>
            <JourneySelector onChange={newJourneySelection} single="true" size="small" style="card"/>
            <SlTooltip hoist content={'Add a journey'}>
                <SlIconButton library="fa" onClick={journeyLoader} name={FA2SL.set(faSquarePlus)}/>
            </SlTooltip>
        </div>
    )
}