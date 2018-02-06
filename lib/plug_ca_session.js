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
 * Manages logical sessions/output queues for this CA.
 *
 * It should be named `session` in `ca.json`
 *
 * Properties:
 *
 *        {backchannelTimeout: number}
 *
 * `backchannelTimeout` is a timeout in msec that resets the backchannel. It is
 * expected that the client will immediately retry.
 *
 * This enables a reliable path for notifications, even when the client is
 * behind a firewall, or http proxies timeout idle connections. It also
 * helps the server to garbage collect backchannels of dead clients.
 *
 * @module caf_session/plug_ca_session
 * @augments external:caf_components/gen_plug_ca
 *
 */
// @ts-ignore: augments not attached to a class
var caf_comp = require('caf_components');
var genPlugCA = caf_comp.gen_plug_ca;
var assert = require('assert');
var myUtils = caf_comp.myUtils;
var json_rpc = require('caf_transport').json_rpc;
var backchannel = require('./backchannel');

exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlugCA.constructor($, spec);
        $._.$.log && $._.$.log.debug('New Session Manager plug');
        var sessions = {};

        assert.equal(typeof(spec.env.backchannelTimeout), 'number',
                     "'spec.env.backchannelTimeout' is not a number");
        var bcTimeout = spec.env.backchannelTimeout;

        var currentSessionId = null;

        that.getSessionId = function(optSessionId) {
            var sessionId = optSessionId || currentSessionId;
            if (!sessionId) {
                assert.ok(false, 'BUG!: no sessionID');
            }
            return sessionId;
        };

        that.getSession = function(optSessionId) {
            return sessions[that.getSessionId(optSessionId)];
        };

        var instanceSession = function(optSessionId) {
            var newSession = function() {
                return {
                    'messages': [], // pending notifications
                    'nonce': null, // session id, refreshed with each begin()
                    'memento': null, // client info persisted with checkpoint
                    'bc': null, // backchannel
                    'limit': -1 // max number of pending notifications.
                };
            };
            var session = that.getSession(optSessionId);
            if (!session) {
                session = newSession();
                sessions[that.getSessionId(optSessionId)] = session;
            }
            return session;
        };

        that.getAllSessionIds = function() {
            return Object.keys(sessions);
        };

        // transactional ops
        var target = {
            notifyImpl: function(sessionId, argsArray, cb0) {
                var session = instanceSession(sessionId);
                backchannel.notifyBackchannel(session, argsArray);
                cb0(null);
            },
            beginImpl: function(sessionId, nonce, cb0) {
                var session = instanceSession(sessionId);
                session.nonce = nonce;
                cb0(null);
            },
            endImpl: function(sessionId, cb0) {
                var session = instanceSession(sessionId);
                delete session.nonce;
                delete session.memento;
                cb0(null);
            },
            rememberImpl: function(sessionId, memento, cb0) {
                var session = instanceSession(sessionId);
                session.memento = memento;
                cb0(null);
            },
            limitQueueImpl: function(sessionId, maxMsgs, cb0) {
                var session = instanceSession(sessionId);
                backchannel.limitBackchannel(session, maxMsgs);
                cb0(null);
            }
        };

        that.__ca_setLogActionsTarget__(target);


        that.notify = function(argsArray, optSessionId) {
            that.__ca_lazyApply__('notifyImpl',
                                  [that.getSessionId(optSessionId), argsArray]);
        };

        that.limitQueue = function(maxMsgs, optSessionId) {
            that.__ca_lazyApply__('limitQueueImpl',
                                  [that.getSessionId(optSessionId), maxMsgs]);
        };

        /* Session methods to help stateless clients provide exactly-once
         * request delivery.*/

        that.begin = function() {
            var sessionId = that.getSessionId();
            var memento = sessions[sessionId] && sessions[sessionId].memento;
            var result = {nonce: myUtils.uniqueId(), memento: memento};
            that.__ca_lazyApply__('beginImpl', [sessionId, result.nonce]);
            return result;
        };

        that.end = function(nonce) {
            var sessionId = that.getSessionId();
            if (sessions[sessionId] && (sessions[sessionId].nonce === nonce)) {
                that.__ca_lazyApply__('endImpl', [sessionId]);
                return true;
            } else if (sessions[sessionId] && (!sessions[sessionId].nonce) &&
                       (!sessions[sessionId].memento)) {
                // assumed already deleted
                return true;
            } else {
                return false;
            }
        };

        that.remember = function(nonce, memento) {
            var sessionId = that.getSessionId();
            if (sessions[sessionId] && (sessions[sessionId].nonce === nonce)) {
                that.__ca_lazyApply__('rememberImpl', [sessionId, memento]);
                return true;
            } else {
                return false;
            }
        };


        // pull is not transactional and can race with message processing
        that.pull = function(request, cb0) {
            var sessionId = json_rpc.getSessionId(request);
            if (sessionId) {
                backchannel.pullBackchannel(request,
                                            instanceSession(sessionId),
                                            bcTimeout, cb0);
            } else {
                var err = new Error('Error: no session ID in request.');
                err['request'] = request;
                cb0(err);
            }

        };


        // override gen_transactional methods
        var super__ca_init__ = myUtils.superior(that, '__ca_init__');
        that.__ca_init__ = function(cb0) {
            sessions = {};
            super__ca_init__(cb0);
        };

        var super__ca_resume__ = myUtils.superior(that, '__ca_resume__');
        that.__ca_resume__ = function(cp, cb0) {
            sessions = cp.sessions || {};
            super__ca_resume__(cp, cb0);
        };

        var super__ca_begin__ = myUtils.superior(that, '__ca_begin__');
        that.__ca_begin__ = function(msg, cb0) {
            var sessionId = json_rpc.getSessionId(msg);
            if (sessionId) {
                currentSessionId = sessionId;
                super__ca_begin__(msg, cb0);
            } else {
                var err = new Error('Error: no session ID in msg');
                err['msg'] = msg;
                cb0(err);
            }
        };

        var super__ca_prepare__ = myUtils.superior(that, '__ca_prepare__');
        that.__ca_prepare__ = function(cb0) {
            super__ca_prepare__(function(err, data) {
                if (err) {
                    cb0(err, data);
                } else {
                    var cleanupF = function(key) {
                        return (key === 'bc');
                    };
                    data.sessions = myUtils
                                            .deepClone(sessions, cleanupF);
                    cb0(err, data);
                }
            });
        };

        var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            for (var sessionId in sessions) {
                backchannel.finishBackchannel(sessions[sessionId]);
            }
            super__ca_shutdown__(data, cb0);
        };

        cb(null, that);
    } catch (err) {
        cb(err);
    }
};
