import { faArrowsRotate, faTriangleExclamation } from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlButton, SlDialog, SlIcon }   from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'
import parse                                     from 'html-react-parser'


/**
 *
 * @param props
 *
 * @prop message  error message
 *
 * @return {JSX.Element}
 */
export const InitErrorMessage = (props) => {
    return (
        <SlDialog label={`${lgs.settings.applicationName}  stopped!`}
                  open={true}
                  id={'init-error-modal'}
                  className={'lgs-theme'}
        >
            <p>{'The application was stopped due to this error:'}</p>
            <SlAlert variant="danger" open>
                <SlIcon slot="icon" library="fa" name={FA2SL.set(faTriangleExclamation)}/>
                {parse(props.message)}
            </SlAlert>

            <div slot="footer">
                <div id={'footer'}>
                    <div className="buttons-bar">
                        <SlButton autofocus variant="primary" onClick={() => window.location.reload()}>
                            <SlIcon slot="prefix" library="fa" name={FA2SL.set(faArrowsRotate)}></SlIcon>{'Retry'}
                        </SlButton>
                    </div>
                </div>
            </div>

        </SlDialog>
    )
}