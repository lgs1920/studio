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

    const size = (props.small) ? 'small'
                               : (props.xsmall) ? 'xsmall'
                                                : (props.large) ? 'large'
                                                                : (props.large) ? 'xlarge'
                                                                                : 'normal'
    const src = `/assets/images/logo-lgs1920-studio${sizes[size]}.png`
    return (
        <div className={`main-logo ${size}`} style={style}>
            <img src={src}/>
        </div>
    )
}
