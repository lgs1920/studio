import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'

export const FAButton = (props) => {
    const {className, id, ref, ...rest} = props
    return (
        <div className={classNames('fa-icon-button', className)} ref={ref} id={id}>
            <FontAwesomeIcon {...rest} />
        </div>
    )
}