import { faTriangleExclamation }     from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlDialog, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                     from '@Utils/FA2SL'
import { useSnapshot }               from 'valtio'


/**
 *
 * @param props
 *
 * @prop message  error message
 *
 * @return {JSX.Element}
 */
export const RestartBackend = (props) => {

    const handleRequestClose = (event) => {
        if (event.detail.source === 'overlay') {
            event.preventDefault()
        }
    }

    const check = useSnapshot(lgs.mainProxy)
    console.log(check.backendRestart)
    return (
        <SlDialog label={`Trying to restart the backend...`}
                  open={check.backendRestart}
                  id={'restart-backend'}
                  className={'lgs-theme'}
                  noHeader onSlRequestClose={handleRequestClose}
                  style={{'--body-spacing': 0}}
        >
            <SlAlert variant="warning" open>
                <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
                {'Restarting the backend...'}
            </SlAlert>
        </SlDialog>

    )
}