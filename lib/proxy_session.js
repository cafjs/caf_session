/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

'use strict';
/**
 *  Proxy to access session information and output message queues.
 *
 *
 * @module caf_session/proxy_session
 * @augments external:caf_components/gen_proxy
 *
 */
// @ts-ignore: augments not attached to a class
const caf_comp = require('caf_components');
const genProxy = caf_comp.gen_proxy;

exports.newInstance = async function($, spec) {

    const that = genProxy.create($, spec);

    /**
     * Gets a read-only snapshot of the output notification queue.
     *
     * If no session name is provided we use the current session.
     *
     * By convention we reserve `default` as the name of an
     * unnamed logical session.
     *
     * The type of an entry in the notification queue, `caf.notif` is:
     *
     *        Array.<caf.json>
     *
     * @param {string=} optSessionId An optional logical session name
     * identifying the output queue. Defaults to the current session.
     * @return {Array.<notificationType>} A frozen array with a snapshot
     * of the output queue.
     *
     * @memberof! module:caf_session/proxy_session#
     * @alias outq
     */
    that.outq = function(optSessionId) {
        const session = $._.getSession(optSessionId);
        const msgs = session && session.messages &&
            Object.freeze(session.messages.slice(0));
        return (msgs ? msgs : Object.freeze([]));
    };

    /**
     * Gets the name of the current logical session.
     *
     * @return {string} The name of the current logical session.
     *
     * @memberof! module:caf_session/proxy_session#
     * @alias getSessionId
     */
    that.getSessionId = function() {
        return $._.getSessionId();
    };

    /**
     * Gets the names of all the logical sessions of this CA.
     *
     * @return {Array.<string>} The names of all the logical sessions.
     *
     * @memberof! module:caf_session/proxy_session#
     * @alias getAllSessionIds
     */
    that.getAllSessionIds = function() {
        return $._.getAllSessionIds();
    };

    /**
     * Bounds the length of the output queue by discarding old messages.
     *
     * If no session name is provided we use the current session.
     *
     * By convention we reserve `default` as the name of the unnamed
     * logical session.
     *
     * @param {number} maxMsgs Maximum number of messages in queue.
     * @param {string=} optSessionId An optional logical session name
     * identifying the output queue.
     *
     * @memberof! module:caf_session/proxy_session#
     * @alias limitQueue
     */
    that.limitQueue = function(maxMsgs, optSessionId) {
        $._.limitQueue(maxMsgs, optSessionId);
    };


    /**
     * Queues a notification message.
     *
     * If no session name is provided we use the current session.
     *
     * The type of a notification, `caf.notif` is:
     *
     *        Array.<caf.json>
     *
     * @param {notificationType} argsArray An array with the arguments
     * in the notification.
     * @param {string=} optSessionId An optional logical session name
     * identifying the output queue.
     *
     * @memberof! module:caf_session/proxy_session#
     * @alias notify
     *
     */
    that.notify = function(argsArray, optSessionId) {
        $._.notify(argsArray, optSessionId);
    };

    /**
     *  Starts a persistent session associated with the current logical
     * session.
     *
     *  `begin()` creates a fresh nonce to tie together all the interactions
     * within a persistent session. This solves the issue of delayed
     * messages in the network from previous persistent sessions
     * interfering with the current session.
     *
     * `begin()` returns the last memento if the previous session was
     * not properly ended, and this allows a stateless client to
     *  provide `exactly-once` delivery guarantees for requests in the presence
     * of failures.
     *
     * The type of `caf.sessionBegin` is
     *
     *      {nonce: string, memento: jsonType=}
     *
     * @return {sessionBeginType} A unique instance
     * identifier for this persistent session, and an optional memento if the
     * previous session was not properly ended.
     *
     * @memberof! module:caf_session/proxy_session#
     * @alias begin
     *
     */
    that.begin = function() {
        return $._.begin();
    };

    /**
     * Ends a persistent session associated with the current logical
     * session.
     *
     * It deletes the memento associated with this logical session.
     *
     * @param {string} nonce An identifier for this persistent session.
     * @return {boolean} True if the session has ended.
     * False if a different persistent session is in progress, and the nonce
     * did not match.
     *
     * @memberof! module:caf_session/proxy_session#
     * @alias end
     *
     */
    that.end = function(nonce) {
        return $._.end(nonce);
    };

    /**
     * Replaces a memento associated with this logical session.
     *
     * Mementos can maintain client state across failures. This is
     * important for clients that want to switch devices, or cannot
     * rely on reliable local storage.
     *
     * `remember()` is transactional with the processing of the
     * message, and when it fails by returning
     * `false`, your code should return an application error so that CAF
     * aborts the transaction.
     *
     * Well-behaved clients should handle errors (or timeouts) by
     * starting a new persistent session. When they call `begin()` they
     * will learn the last successful action (and/or its own state)
     * before the failure.
     *
     * @param {string} nonce  Identifier for this persistent session.
     * @param {jsonType} memento Client state to be checkpointed.
     * @return {boolean} True if the memento changed. False if the
     * nonce did not match, and this CA must abort the processing
     * of the message by returning an application error.
     *
     * @memberof! module:caf_session/proxy_session#
     * @alias remember
     *
     */
    that.remember = function(nonce, memento) {
        return $._.remember(nonce, memento);
    };

    Object.freeze(that);

    return [null, that];
};
