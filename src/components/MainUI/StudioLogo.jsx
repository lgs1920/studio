/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: StudioLogo.jsx
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-05-10
 * Last modified: 2026-05-10
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

import { SLOGAN }          from '@Core/constants'
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
            {props.slogan && <span className={'the-slogan'}>{SLOGAN}</span>}
            {props.timer > 0 && lgs.settings.ui.welcome.autoClose &&
                <span className={'welcome-modal-timer'}>{props.timer} s</span>}
            {props.buttons}
        </div>
    )
}
