export const StudioLogo = (props) => {
    let style = {}
    if (props.width) {
        style = {width: props.width}
    }
    else if (props.height) {
        style = {height: props.height}
    }
    return (
        <div className={'main-logo'}>
            <img src={'assets/images/lgs1920-studio.png'}/>
        </div>
    )
}
