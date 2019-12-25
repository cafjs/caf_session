
/**
 * @global
 * @typedef {function(Error?, any?):void} cbType
 *
 */

/**
 * @global
 * @typedef {Object | Array | string | number | null | boolean} jsonType
 *
 */

/**
 * @global
 * @typedef {Object}  sessionBeginType
 * @property {string} nonce Unique session instance identifier.
 * @property {jsonType=} memento Information attached to the session.
 */

/**
 * @global
 * @typedef {Array.<jsonType>}  notificationType
 */


/**
 * @global
 * @typedef {Object} specType
 * @property {string} name
 * @property {string|null} module
 * @property {string=} description
 * @property {Object} env
 * @property {Array.<specType>=} components
 *
 */

/**
 * @global
 * @typedef {Object} specDeltaType
 * @property {string=} name
 * @property {(string|null)=} module
 * @property {string=} description
 * @property {Object=} env
 * @property {Array.<specType>=} components
 *
 */

/**
 * @global
 * @typedef {Object.<string, Object>} ctxType
 */
