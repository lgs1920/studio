import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const FAButton = (props) => {

    return (
        <div className="fa-icon-button" {...props.ref} >
            <FontAwesomeIcon {...props} />
        </div>
    )
}