import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export const FAButton = props => {
    return (
        <div className="fa-icon-button">
            <FontAwesomeIcon {...props} />
        </div>
    )
}