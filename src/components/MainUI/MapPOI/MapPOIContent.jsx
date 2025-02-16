import { TextValueUI }       from '@Components/TextValueUI/TextValueUI'
import { SECOND }            from '@Core/constants'
import { faFlagSwallowtail } from '@fortawesome/duotone-light-svg-icons'
import { FontAwesomeIcon }   from '@fortawesome/react-fontawesome'
import { UIUtils }           from '@Utils/UIUtils'
import { ELEVATION_UNITS }   from '@Utils/UnitUtils'
import { useRef }            from 'react'
import Timeout               from 'smart-timeout'
import './style.css'

export const MapPOIContent = ({point, hide}) => {
    const inner = useRef(null)

    const handleContextMenu = (event) => {
        event.preventDefault()
        if (!__.ui.cameraManager.isRotating()) {
            lgs.mainProxy.components.pois.context.visible = true
            lgs.mainProxy.components.pois.current = point
            __.ui.sceneManager.propagateEventToCanvas(event)
        }
    }

    return (
        <div className="poi-on-map">
            <div
                className="poi-on-map-inner"
                ref={inner}
                onContextMenu={handleContextMenu}
                onClick={handleContextMenu}
                onPointerLeave={() => {
                    Timeout.set(
                        lgs.mainProxy.components.pois.context.timer,
                        hide,
                        1.5 * SECOND,
                    )
                }}
            >
                {!point.showFlag && point.expanded && (
                    <>
                        <h3>{point.title ?? 'Point Of Interest'}</h3>
                        {point.scale > 0.6 && (
                            <div className="poi-full-coordinates">
                                {!point.simulatedHeight && (
                                    <TextValueUI
                                        className="poi-elevation"
                                        text={'Altitude: '}
                                        value={point.height}
                                        format={'%d'}
                                        units={ELEVATION_UNITS}
                                    />
                                )}
                                {point.simulatedHeight && <span>&nbsp;</span>}
                                <div className="poi-coordinates">
                                        <span>
                                            {UIUtils.toDMS(point.latitude)},{' '}
                                            {UIUtils.toDMS(point.longitude)}
                                        </span>
                                    <br/>
                                    <span>
                                            [{sprintf('%.5f', point.latitude)},{' '}
                                        {sprintf('%.5f', point.longitude)}]
                                        </span>
                                    <br/>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {point.showFlag || !point.expanded &&
                    <FontAwesomeIcon icon={faFlagSwallowtail} className="poi-as-flag"/>
                }
            </div>
            <div className="poi-on-map-marker"></div>
        </div>
    )
}