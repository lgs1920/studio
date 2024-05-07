import { ProfileButton }      from '@Components/Profile/ProfileButton'
import { TrackFileLoaderUI }  from '@Components/TrackFileLoaderUI/TrackFileLoaderUI'
import { TracksEditorButton } from '@Components/TracksEditor/TracksEditorButton'

export const Toolbar = (props) => {
    return (
        <div className={['vt3d-ui-toolbar', props.position].join(' ')}>
            {props.fileLoader && <TrackFileLoaderUI/>}
            {props.editor && <TracksEditorButton/>}
            {props.profile && <ProfileButton/>}
        </div>
    )

}

