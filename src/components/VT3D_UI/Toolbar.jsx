import { TrackFileLoaderUI }  from '@Components/FileLoader/FileLoader'
import { ProfileButton }      from '@Components/Profile/ProfileButton'
import { TracksEditorButton } from '@Components/TracksEditor/TracksEditorButton'
import { SlDivider }          from '@shoelace-style/shoelace/dist/react'
import { SnapshotButton }     from './Snapshot'

export const Toolbar = (props) => {
    return (
        <div className={['vt3d-ui-toolbar', props.position, props.mode].join(' ')}>
            {props.left &&
                <>
                    {props.left}<SlDivider vertical/>
                </>
            }

            {props.snapshot &&
                <>
                    <SnapshotButton tooltip={props.tooltip} snapshot={props.snapshot}/>
                    <SlDivider vertical/>
                </>
            }

            {props.center &&
                <>
                    {props.center}<SlDivider vertical/>
                </>
            }
            {props.fileLoader && <TrackFileLoaderUI tooltip={props.tooltip}/>}
            {props.editor && <TracksEditorButton tooltip={props.tooltip}/>}
            {props.profile && <ProfileButton tooltip={props.tooltip}/>}

            {props.right &&
                <>
                    <SlDivider vertical/>{props.right}
                </>
            }
        </div>
    )

}

