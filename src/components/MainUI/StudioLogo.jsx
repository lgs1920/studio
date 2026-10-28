/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StudioLogo.jsx
 *
 * Author : LGS1920 Team
 * email: studio@lgs1920.fr
 *
 * Created on: 2024-10-03
 * Last modified: 2026-10-28
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import {SloganSvg} from '@Components/MainUI/SloganSvg'
import { formatBuildInfo } from '@Utils/BuildInfoUtils'

export const StudioLogo = (props) => {
    let style = {}
    if (props.width) {
        style = {width: props.width}
    }
    else if (props.height) {
        style = {height: props.height}
    }
    const sizes = {
        xs: '-xs', small: '-s', 'normal': '', 'large': '-l', 'xlarge': '-xl',
    }

    const addClass = props.addClassName ? props.addClassName : ''

    const size = (props.small) ? 'small'
                               : (props.xs) ? 'xs'
                                                : (props.large) ? 'large'
                                                                : (props.large) ? 'xlarge'
                                                                                : 'normal'
    const src = `/assets/images/logo-lgs1920-studio${sizes[size]}.png`

    const date = formatBuildInfo(lgs.build)

    return (
        <div className={`main-logo signage-style ${size} ${addClass}`} style={style}>
            <img src={src}/>
            {props.version &&
                <div className={'version-info'}>{lgs.versions.studio} - {'build'}: {date}</div>
            }
            {props.slogan && <SloganSvg className="the-slogan"/>}
            {props.buttons}
        </div>
    )
}
