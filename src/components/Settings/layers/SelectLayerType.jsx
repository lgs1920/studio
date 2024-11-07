import { faBringForward, faMountains, faSendBackward } from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlOption, SlSelect }                  from '@shoelace-style/shoelace/dist/react'
import React                                           from 'react'
import { useSnapshot }                                 from 'valtio'
import { FA2SL }                                       from '../../../Utils/FA2SL'

export const SelectLayerType = () => {

    const settings = lgs.editorSettingsProxy
    const snap = useSnapshot(settings)

    const changeHandler = (event) => {
        settings.layer.selectedType = event.target.value
    }

    return (
        <SlSelect placeholder="Select type"
                  value={snap.layer.selectedType}
                  onSlChange={changeHandler}>
            <SlOption value="base">
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faSendBackward)}/> {'Base'}
            </SlOption>
            <SlOption value="overlay">
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faBringForward)}/> {'Overlay'}
            </SlOption>
            <SlOption value="terrain">
                <SlIcon slot="prefix" library="fa" name={FA2SL.set(faMountains)}/> {'Terrains'}
            </SlOption>
        </SlSelect>
    )
}