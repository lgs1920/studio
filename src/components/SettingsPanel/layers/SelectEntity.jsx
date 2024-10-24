import { LAYERS_THUMBS_DIR } from '@Core/constants'
import { faCircleCheck }     from '@fortawesome/pro-solid-svg-icons'
import { SlIcon }            from '@shoelace-style/shoelace/dist/react'
import { FA2SL }             from '@Utils/FA2SL'
import { Fragment, useRef }  from 'react'

import { useSnapshot }    from 'valtio'
import { OVERLAY_LAYERS } from '../../../core/constants'

export const SelectEntity = (props) => {

    const thumbnailBackground = image => `url("${LAYERS_THUMBS_DIR}/${image}")`

    let settings = useSnapshot(lgs.settings.layers)
    const entityRef = useRef(null)

    const Thumbnail = (props) => {

        const selected = props.entity.id === settings[props.entity.type]
        const classes = ['layers-entity', 'lgs-card']
        if (selected) {
            classes.push('entity-selected')
        }
        return (

            <sl-tooltip content={props.entity.name}>
                <div className={classes.join(' ')}
                     style={{backgroundImage: thumbnailBackground(props.entity.image)}}>
                    <a onClick={props.onClick} type={props.entity.type} name={props.entity.id}>
                        <div className={'entity-checkbox'}>
                            {selected &&
                                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faCircleCheck)}/>
                            }
                        </div>
                    </a>
                </div>
            </sl-tooltip>
        )
    }

    let tmp = ''
    const list = props.list
    list.map((entity, index) => {
        if (entity.provider !== tmp) {
            tmp = entity.provider
            entity.providerName = __.layerManager.providers.get(entity.provider).name
            list[index] = entity
        }
    })

    const selectEntityHandler = (event) => {
        const type = event.target.getAttribute('type')
        const name = event.target.getAttribute('name')
        lgs.settings.layers[event.target.getAttribute('type')] =
            // Clicking on the same overlay will deselect it
            (type === OVERLAY_LAYERS && lgs.settings.layers[event.target.getAttribute('type')] === name) ? '' : name
    }

    return (

        <div className={'layers-entities-wrapper lgs-card'}>

            {list.map((entity, index) => {
                return (
                    // If there is a new provider, let's show it's name

                    <Fragment key={index}>
                        {
                            entity.providerName &&
                            <div className="layers-provider-header">
                                <span className={'provider-name'}>{entity.providerName}</span>
                            </div>
                        }
                        <Thumbnail entity={entity} key={entity.name} onClick={selectEntityHandler}/>
                    </Fragment>
                )
            })}
        </div>


    )

}