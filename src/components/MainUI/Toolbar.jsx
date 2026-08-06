/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Toolbar.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { ProfileButton }      from '@Components/Profile/ProfileButton'
import { SlDivider }      from '@shoelace-style/shoelace/dist/react'
import { JourneyLoaderButton } from '../FileLoader/JourneyLoaderButton'
import { SnapshotButton } from './Snapshot'

export const Toolbar = (props) => {
    return (
        <div className={['lgs-ui-toolbar', props.position, props.mode].join(' ')}>
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
            {props.fileLoader && <JourneyLoaderButton tooltip={props.tooltip}/>}
            {props.profile && <ProfileButton tooltip={props.tooltip}/>}

            {props.right &&
                <>
                    <SlDivider vertical/>{props.right}
                </>
            }
        </div>
    )

}

