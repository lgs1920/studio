import { faTrashAlt, faWarning }                from '@fortawesome/pro-regular-svg-icons'
import { SlAlert, SlButton, SlDetails, SlIcon } from '@shoelace-style/shoelace/dist/react'
import { FA2SL }                                from '@Utils/FA2SL'
import React                                    from 'react'
import { useSnapshot }                          from 'valtio/index'
import { useConfirm }                           from '../../../Modals/ConfirmUI'
import './style.css'

export const RemoveProfile = () => {
    const editor = lgs.editorSettingsProxy.account
    const snap = useSnapshot(editor)

    const remove = async () => {
        if (await confirmRemove()) {
            await lgs.db.lgs1920.deleteDB()
            await lgs.db.settings.deleteDB()
            await lgs.db.vault.deleteDB()
            // redirection to the website so the DB won't be recreated
            location.href = `${lgs.servers.site.protocol}://${lgs.servers.site.domain}`
        }
    }

    const ConfirmationDialogMessage = (props) => {
        return (
            <div className="manage-profile-ui">
                {'Are you sure you want to remove your account?'}
                <SlAlert open variant="danger">
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faWarning)}></SlIcon>
                    {'If you confirm your action, you will be redirected to our site.'}<br/>
                    {'None of our data will be stored in your browser.'}<br/>
                </SlAlert>
            </div>
        )
    }

    const [ConfirmRemoveDialog, confirmRemove] = useConfirm(`Remove My Profile`, ConfirmationDialogMessage,
                                                            {icon:       faTrashAlt,
                                                                text: 'Remove My Profile',
                                                                variant: 'danger',
                                                            })

    return (
        <SlDetails small className={'lgs-theme'}>
            <span slot="summary">
                <SlIcon library="fa" name={FA2SL.set(faTrashAlt)}/> {'Remove My Profile'}
            </span>
            <div className="manage-profile-ui">
                <SlAlert open variant="warning">
                    <SlIcon slot="icon" library="fa" name={FA2SL.set(faWarning)}></SlIcon>
                    {'You will delete all the data and databases that your browser has stored on your device in order to manage LGS1920 Studio application.'}<br/>
                    {'It includes journeys, POIS, settings, tokens ...'}<br/>
                </SlAlert>

                <SlButton variant="warning" onClick={remove}>
                    <SlIcon slot="prefix" library="fa"
                            name={FA2SL.set(faTrashAlt)}></SlIcon>{'Remove My Profile'}
                </SlButton>
            </div>
            <ConfirmRemoveDialog/>
        </SlDetails>
    )
}
