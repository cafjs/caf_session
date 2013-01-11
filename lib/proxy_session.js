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

"use strict";
/**
 *  Proxy to access session information and output message queues.
 *
 *
 * @name caf_session/proxy_session
 * @namespace
 * @augments gen_proxy
 *
 */
var caf = require('caf_core');
var genProxy = caf.gen_proxy;

/**
 * Factory method to create a proxy to access session info/queues.
 *
 * @see sup_main
 */
exports.newInstance = function(context, spec, secrets, cb) {

    var that = genProxy.constructor(spec, secrets);

    var sessionMgr = secrets.session_ca;

    /**
     *  Gets a read-only snapshot of the output notification queue.
     *
     * If no session name is provided we use the current session.
     *
     * By convention we reserve 'default' as the name of the default
     * logical session.
     *
     * @param {string=} optSessionId An optional logical session name
     * identifying the output queue.
     * @return {Array.<Array.<caf.json>>} A frozen array with a snapshot
     * of the output queue.
     *
     * @name caf_session/proxy_session#outq
     * @function
     */
    that.outq = function(optSessionId) {
        var session = sessionMgr.getSession(optSessionId);
        return session && session.messages &&
            Object.freeze(session.messages.slice(0));
    };

    /**
     * Gets the name of the current logical session.
     *
     * @return {string} The name of the current logical session.
     *
     * @name  caf_session/proxy_session#getSessionId
     * @function
     */
    that.getSessionId = function() {
        return sessionMgr.getSessionId();
    };

    /**
     * Gets the names of all the logical sessions of this CA.
     *
     * @return {Array.<string>} The names of all the logical sessions .
     *
     * @name  caf_session/proxy_session#getAllSessionIds
     * @function
     */
    that.getAllSessionIds = function() {
        return sessionMgr.getAllSessionIds();
    };

    /**
     * Bounds the length of the output queue by discarding old messages.
     *
     * If no session name is provided we use the current session.
     *
     * By convention we reserve 'default' as the name of the default
     * logical session.
     *
     * @param {number} maxMsgs Maximum number of messages in queue.
     * @param {string=} optSessionId An optional logical session name
     * identifying the output queue.
     *
     * @name  caf_session/proxy_session#boundQueue
     * @function
     */
    that.boundQueue = function(maxMsgs, optSessionId) {
        sessionMgr.boundQueue(maxMsgs, optSessionId);
    };


    /**
     * Queues a notification message.
     *
     * If no session name is provided we use the current session.
     *
     * By convention we reserve 'default' as the name of the default
     * logical session.
     *
     * @param {Array.<caf.json>} argsArray An array with the arguments
     * in the notification.
     * @param {string=} optSessionId An optional logical session name
     * identifying the output queue.
     *
     * @name  caf_session/proxy_session#notify
     * @function
     *
     */
    that.notify = function(argsArray, optSessionId) {
        sessionMgr.notify(argsArray, optSessionId);
    };

    /**
     * Gets the identifier for this CA.
     *
     * @return {string} The id for this CA.
     * @name  caf_session/proxy_session#getMyId
     * @function
     */
    that.getMyId = function() {
        return secrets.myId;
    };



    /**
     *  Starts a persistent session associated with the current logical
     * session.
     *
     *  `begin()` creates a fresh nonce to tie together all the interactions
     * within a persistent session. This solves the issue of  delayed
     * messages  in the network from previous persistent sessions
     * interfering with the current session.
     *
     * `begin()` returns the last memento if the previous session was
     * not properly ended, and this allows a stateless client to
     *  provide 'exactly-once' delivery guarantees for requests in the presence
     * of failures.
     *
     * @return {{nonce: string, memento=}} A unique instance identifier for this
     * persistent session, and an optional memento when the previous session
     * was not properly ended.
     *
     * @name  caf_session/proxy_session#begin
     * @function
     *
     */
    that.begin = function() {
        return sessionMgr.begin();
    };

    /**
     * Ends a persistent session  associated with the current logical
     * session.
     *
     * It deletes the memento associated with this logical session.
     *
     * @param {string} nonce An identifier for this persistent session.
     * @return {boolean} True if the session has ended.
     * False if a different persistent session is in progress, and the nonce
     * did not match.
     *
     * @name  caf_session/proxy_session#end
     * @function
     *
     */
    that.end = function(nonce) {
        return sessionMgr.end(nonce);
    };

    /**
     * Replaces a memento associated with this logical session.
     *
     * Mementos can maintain client state across failures. This is
     * important for clients that need to switch devices or cannot
     * count on reliable local storage.
     *
     * `remember()` is transactional with the processing of the
     * message, and when this call fails and returns
     * false, your code should return an application error so that CAF
     * aborts the transaction.
     *
     * Well-behaved  clients should handle errors (or timeouts) by
     * starting a new persistent session. By calling `begin()` they
     * will know the last successful action (and/or its own state)
     * before the failure.
     *
     * @param {string} nonce  Identifier for this persistent session.
     * @param {caf.json} memento Client state to be checkpointed.
     * @return {boolean} True if the memento changed. False if the
     * nonce did not match and this CA must abort the processing
     * of the message by returning an application error.
     *
     * @name  caf_session/proxy_session#remember
     * @function
     *
     */
    that.remember = function(nonce, memento) {
        return sessionMgr.remember(nonce, memento);
    };

    Object.freeze(that);
    cb(null, that);

};

