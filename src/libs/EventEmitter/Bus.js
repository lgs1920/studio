/**********************************************************************************************************************
 *                                                                                                                    *
 * Project : shelteradmin                                                                                             *
 * File : Bus.js                                                                                                      *
 *                                                                                                                    *
 * @author: Christian Denat                                                                                           *
 * @email: contact@noleam.fr                                                                                          *
 *                                                                                                                    *
 * Last updated on : 16/07/2023  17:38                                                                                *
 *                                                                                                                    *
 * Copyright (c) 2023 - noleam.fr                                                                                     *
 *                                                                                                                    *
 **********************************************************************************************************************/

import {EventEmitter} from './EventEmitter.js'

/**
 * EventEmitter classe singleton.
 * Require EventEmitter class
 */
const Bus = (function () {

    /** @type {Object} module public api */
    var singleton = {};

    /** @type {EventEmitter} the instance of EventEmitter class */
    var _instance;

    /**
     * Creates and/or returns an instance of the EventEmitter class.
     * @return {EventEmitter} an EventEmitter class instance
     * @private
     */
    singleton._getInstance = function () {
        if (!_instance) {
            _instance = new EventEmitter();
        }
        return _instance;
    };

    // returns unique instance of EventEmitter
    return singleton._getInstance();

})();


export {Bus}