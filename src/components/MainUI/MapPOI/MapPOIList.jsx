import { POI_TMP_TYPE }                from '@Core/constants'
import { faMask }                      from '@fortawesome/pro-solid-svg-icons'
import { FontAwesomeIcon }             from '@fortawesome/react-fontawesome'
import { SlDetails, SlDivider }        from '@shoelace-style/shoelace/dist/react'
import { UIToast }                     from '@Utils/UIToast'
import classNames                      from 'classnames'
import { Fragment, useEffect, useRef } from 'react'
import { useSnapshot }                 from 'valtio/index'

export const MapPOIList = () => {

    const poiList = useRef(null)
    const pois = useSnapshot(lgs.mainProxy.components.pois)

    const handleCopyCoordinates = (poi) => {
        __.ui.poiManager.copyCoordinatesToClipboard(poi).then(() => {
            UIToast.success({
                                caption: `${poi.name}`,
                                text:    'Coordinates copied to the clipboard <br/>under the form: latitude, longitude',
                            })
        })
    }
    useEffect(() => {
        __.ui.ui.initDetailsGroup(poiList.current)
    }, [])

    return (
        <div id={'edit-map-poi-list'} ref={poiList}>
            {Array.from(pois.list.entries()).map(([id, poi]) => (
                <>
                    {poi.type !== POI_TMP_TYPE &&
                        <SlDetails className={classNames(`edit-map-poi-item`, poi.visible ? '' : 'map-poi-hidden')}
                                   id={`edit-poi-${id}`}
                                   small>
                            <div slot="summary">
                                <span>
                                    <FontAwesomeIcon icon={poi.visible ? poi.icon : faMask} style={{
                                        '--fa-secondary-color':   poi.color,
                                        '--fa-secondary-opacity': 1,
                                    }}/>
                                    {poi.title}
                                </span>
                                <span>
                                            [{sprintf('%.5f, %.5f', poi.latitude, poi.longitude)}]
                                        </span>
                            </div>
                            <SlDivider/>
                        </SlDetails>
                    }
                </>
            ))}

        </div>
    )
}

