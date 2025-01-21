import Scrollbars from 'react-custom-scrollbars'

// https://github.com/RobPethick/react-custom-scrollbars-2/blob/master/docs/customization.md
export const LGSScrollbars = (props) => {
    return (
        <Scrollbars className="lgs-scrollbars" {...props} autoHide
                    renderTrackHorizontal={props => <div {...props} className="track-horizontal"/>}
                    renderTrackVertical={props => <div {...props} className="track-vertical"/>}
                    renderThumbHorizontal={props => <div {...props} className="thumb-horizontal"/>}
                    renderThumbVertical={props => <div {...props} className="thumb-vertical"/>}
                    renderView={props => <div {...props} className="view"/>}>
            {props.children}
        </Scrollbars>
    )
}