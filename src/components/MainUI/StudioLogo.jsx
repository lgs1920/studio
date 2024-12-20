import { SLOGAN }   from '@Core/constants'
import { DateTime } from 'luxon'

export const StudioLogo = (props) => {
    let style = {}
    if (props.width) {
        style = {width: props.width}
    }
    else if (props.height) {
        style = {height: props.height}
    }
    const sizes = {
        xsmall: '-xs', small: '-s', 'normal': '', 'large': '-l', 'xlarge': '-xl',
    }

    const addClass = props.addClassName ? props.addClassName : ''

    const size = (props.small) ? 'small'
                               : (props.xsmall) ? 'xsmall'
                                                : (props.large) ? 'large'
                                                                : (props.large) ? 'xlarge'
                                                                                : 'normal'
    const src = `/assets/images/logo-lgs1920-studio${sizes[size]}.png`

    const date = `${DateTime.fromMillis(lgs.build.date ?? Date.now()).toLocaleString(DateTime.DATE_MED)} \
    ${DateTime.fromMillis(lgs.build.date ?? Date.now()).toLocaleString(DateTime.TIME_SIMPLE)}`

    return (
        <div className={`main-logo ${size} ${addClass}`} style={style}>
            <img src={src}/>
            {props.version &&
                <div className={'version-info'}>{lgs.versions.studio} - {'build'}:{date}</div>
            }
            {props.slogan && <span className={'the-slogan'}>{SLOGAN}</span>}
            {props.timer && <span className={'welcome-modal-timer'}>{props.timer} s</span>}
        </div>
    )
}
