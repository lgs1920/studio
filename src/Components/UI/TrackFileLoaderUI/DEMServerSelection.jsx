import {faChevronDown}              from '@fortawesome/pro-regular-svg-icons'
import {SlIcon, SlOption, SlSelect} from '@shoelace-style/shoelace/dist/react'
import {forwardRef}                 from 'react'
import {FA2SL}                      from '../../../Utils/FA2SL'

export const DEMServerSelection = forwardRef(function DEMServerSelection(props, ref) {

    const handleRequestClose = event => {
        event.preventDefault()
    }

    return (
        <>
            <SlSelect hoist label={props.label} value={props.default} onSlChange={props.onChange}
                      onSlSelect={handleRequestClose}>
                <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>

                { // Loop on all servers
                    vt3d.configuration.DEMServers.map(server => (
                        <SlOption key={server.value} value={server.value}>{server.name}</SlOption>))
                }
            </SlSelect>
        </>
    )
})