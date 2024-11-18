import { faTrianglePersonDigging } from '@fortawesome/pro-solid-svg-icons'
import { SlAlert, SlIcon }         from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                   from '@Utils/FA2SL'
import React                       from 'react'

export const Style = () => {

    return (<SlAlert open variant="warning">
            <SlIcon slot="icon" library="fa" name={FA2SL.set(faTrianglePersonDigging)}></SlIcon>
            {'Working in Progress.'}<br/>
        </SlAlert>

    )
}