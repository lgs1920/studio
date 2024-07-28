import { faChevronDown }              from '@fortawesome/pro-regular-svg-icons'
import { SlIcon, SlOption, SlSelect } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                      from '@Utils/FA2SL'

/**
 *
 * @prop {string} label : Associated label
 * @prop {array} excluded : wich servers need to be excluded
 * @prop {string} default : which server is selected by default
 * @prop {function} onChange : On change callback
 *
 * @return {JSX.Element}
 * @constructor
 */
export const SelectElevationSource = (props) => {

    // Use defied Elevation servers
    const servers = lgs.elevationServers

    // Exclude some servers
    for (let server of props.excluded ?? []) {
        servers.delete(server)
    }


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
                    Array.from(servers.values()).map(server => (
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