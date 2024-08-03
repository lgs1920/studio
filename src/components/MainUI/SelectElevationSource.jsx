import { faChevronDown }              from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlOption, SlSelect } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'

/**
 *
 * @prop {string} label : Associated label
 * @prop {array} servers : which servers will be listed
 * @prop {string} default : which instance is selected by default
 * @prop {function} onChange : On change callback
 *
 * @return {JSX.Element}
 * @constructor
 */
export const SelectElevationSource = (props) => {

    const handleRequestClose = event => {
        event.preventDefault()
    }
    return (
        <>
            <SlSelect hoist label={props.label}
                      value={props.default}
                      onSlChange={props.onChange}
                      onSlSelect={handleRequestClose}>
                <SlIcon library="fa" name={FA2SL.set(faChevronDown)} slot={'expand-icon'}/>

                { // Loop on all servers
                    props.servers.map(server => (
                        <SlOption key={server.id} value={server.id}>
                            <SlIcon library="fa" name={FA2SL.set(server.icon)} slot={'prefix'}/>
                            {server.label}
                        </SlOption>
                    ))
                }
            </SlSelect>
        </>
    )

}