import { faArrowsRotate, faSquareCheck }         from '@fortawesome/pro-regular-svg-icons'
import { SlButton, SlDetails, SlIcon, SlSwitch } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                 from '@Utils/FA2SL'
import React                                     from 'react'
import { useSnapshot }                           from 'valtio/index'
import { useConfirm }                            from '../../../Modals/ConfirmUI'
import './style.css'

export const ResetAccount = () => {
    const editor = lgs.editorSettingsProxy.account
    const snap = useSnapshot(editor)

    const reset = async () => {
        if (await confirmReset()) {
            if (snap.reset.lgs1920) {
                await lgs.db.lgs1920.deleteDB()
            }
            if (snap.reset.settings) {
                await lgs.db.settings.deleteDB()
            }
            if (snap.reset.vault) {
                await lgs.db.vault.deleteDB()
            }
            // Reload the app, the DB willbe recreated with defaults
            location.reload()
        }
    }
    const toggleProfileData = (type) => {
        editor.reset[type] = !editor.reset[type]
    }

    const change = (event, type) => {
        toggleProfileData(type)
    }

    const ConfirmationDialogMessage = (props) => {
        return (<>
            <div className="manage-account-ui">
                {'Are you sure you want to reset the data below?'}
                <ul>
                    {snap.reset.lgs1920 &&
                        <li key={'reset-account-lgs1920-confirm'}>
                            <SlIcon library="fa" name={FA2SL.set(faSquareCheck)}/> Your journeys
                        </li>
                    }
                    {snap.reset.settings &&
                        <li key={'reset-account-settings-confirm'}>
                            <SlIcon library="fa" name={FA2SL.set(faSquareCheck)}/> Your settings
                        </li>
                    }{snap.reset.vault &&
                    <li key={'reset-account-vault-confirm'}>
                        <SlIcon library="fa" name={FA2SL.set(faSquareCheck)}/> Your Tokens
                    </li>
                }
                </ul>
            </div>
        </>)
    }


    const [ConfirmResetDialog, confirmReset] = useConfirm(`Reset My Account`, ConfirmationDialogMessage,
                                                          {icon: faArrowsRotate, text: 'Reset'})


    return (
        <SlDetails small className={'lgs-theme'}>
            <span slot="summary">
                <SlIcon library="fa" name={FA2SL.set(faArrowsRotate)}/> {'Reset My Account'}
            </span>
            <div className="manage-account-ui">
                {'Please select the profile data you wish to reset:'}

                <SlSwitch size="small" checked={snap.reset.lgs1920}
                          onSlChange={(event) => change(event, 'lgs1920')}>
                    Your journeys
                    <span slot="help-text">{'Remove your journeys, POIs...'}</span>
                </SlSwitch>


                <SlSwitch size="small" checked={snap.reset.settings}
                          onSlChange={(event) => change(event, 'settings')}>
                    Your settings
                    <span slot="help-text">{'Reset all your settings and default data.'}</span>
                </SlSwitch>

                <SlSwitch size="small" checked={snap.reset.vault}
                          onSlChange={(event) => change(event, 'vault')}>
                    Your Tokens
                    <span slot="help-text">{'Clear all your tokens for freemium/premium access.'}</span>
                </SlSwitch>

                <SlButton variant="primary" onClick={reset}
                          disabled={!(Object.values(snap.reset).some(value => value === true))}>
                    <SlIcon slot="prefix" library="fa"
                            name={FA2SL.set(faArrowsRotate)}></SlIcon>{'Reset My Account'}
                </SlButton>
            </div>
            <ConfirmResetDialog/>
        </SlDetails>
    )
}
