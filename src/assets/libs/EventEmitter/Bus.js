/*******************************************************************************
 *
 * This file is part of the LGS1920/studio project.
 *
 * File: Bus.js
 *
 * Author : LGS1920 Team
 * email: contact@lgs1920.fr
 *
 * Created on: 2026-01-06
 * Last modified: 2026-01-06
 *
 *
 * Copyright © 2026 LGS1920
 ******************************************************************************/

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