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
 * Manages logical sessions/output queues for this CA.
 *
 * It should be named 'session_ca' in ca.json
 *
 *
 * @name caf_session/plug_ca_session
 * @namespace
 * @augments gen_transactional
 *
 */
var caf = require('caf_core');
var genTransactional = caf.gen_transactional;
var assert = require('assert');
var myutils = caf.myutils;
var json_rpc = caf.json_rpc;
var crypto = require('crypto');
var backchannel = require('./backchannel');


// transactional ops
var notifyOp = function(sessionId, argsArray) {
    return {op: 'notify', sessionId: sessionId, argsArray: argsArray};
};

var beginOp = function(sessionId, nonce) {
    return {op: 'begin', sessionId: sessionId, nonce: nonce};
};

var endOp = function(sessionId) {
    return {op: 'end', sessionId: sessionId};
};

var rememberOp = function(sessionId, memento) {
    return {op: 'remember', sessionId: sessionId, memento: memento};
};

var boundQueueOp = function(sessionId, maxMsgs) {
     return {op: 'boundQueue', sessionId: sessionId, maxMsgs: maxMsgs};
};

var newSession = function() {
    return {
        'messages' : [], // pending notifications
        // undefined explicitly returned for documentation purposes
        'nonce' : undefined, // session id, refreshed with each begin()
        'memento' : undefined, // client info persisted with checkpoint
        'bc' : undefined // backchannel
    };
};

/**
 * Factory method to create an stateful plug to manage sessions for this CA.
 *
 * @see sup_main
 */
exports.newInstance = function(context, spec, secrets, cb) {
    var that = genTransactional.constructor(spec, secrets);
    var $ = context;
    var logActions = [];
    $.log && $.log.debug('New Session Manager plug');
    var sessions = {};
    var bcTimeout = 1000 * ((spec.env && spec.env.bcTimeout) || 10);
    var currentSessionId;

    that.instanceSession = function(sessionId, sessionsObj) {
        var allSessions = sessionsObj || sessions;
        var session = allSessions[sessionId];
        if (!session) {
            session = newSession();
            allSessions[sessionId] = session;
        }
        return session;
    };

    that.setCurrentSessionId = function(sessionId) {
        currentSessionId = sessionId;
    };

    that.getSessionId = function(optSessionId) {
        var sessionId = optSessionId || currentSessionId;
        if (!sessionId) {
            assert.ok(false, 'BUG!: no sessionID');
        }
        return sessionId;
    };

    that.getCurrentSession = function() {
        return (currentSessionId && sessions[currentSessionId]);
    };

    that.getSession = function(optSessionId) {
      return (optSessionId ? sessions[optSessionId] :
              that.getCurrentSession());
    };

    that.getAllSessionIds = function() {
        return Object.keys(sessions);
    };

    that.notify = function(argsArray, optSessionId) {
        var sessionId = that.getSessionId(optSessionId);
        logActions.push(notifyOp(sessionId, argsArray));
    };

    that.boundQueue = function(maxMsgs, optSessionId) {
        var sessionId = that.getSessionId(optSessionId);
        logActions.push(boundQueueOp(sessionId, maxMsgs));
    };

    /* Session methods to help stateless clients provide exactly-once
     * request delivery.*/

    var uniqueId = function() {
        return new Buffer(crypto.randomBytes(15)).toString('base64');
    };

    var queuedMementoLookup = function(sessionId) {
        var memento = undefined;
        logActions.forEach(function(action) {
                               if (action.sessionId === sessionId) {
                                   if (action.op === 'end') {
                                       // null means delete
                                       memento = null;
                                   } else if (action.op === 'remember') {
                                       memento = action.memento;
                                   }
                               }
                           });
        return memento;
    };

    that.begin = function() {
        var sessionId = that.getSessionId();
        var memento = sessions[sessionId] && sessions[sessionId].memento;
        var queuedMemento = queuedMementoLookup(sessionId);
        memento = ((queuedMemento === null) ? undefined : // null means delete
                   (queuedMemento ? queuedMemento : memento));
        var result = {nonce: uniqueId(), memento: memento};
        logActions.push(beginOp(sessionId, result.nonce));
        return result;
    };

    that.end = function(nonce) {
        var sessionId = that.getSessionId();
        if (sessions[sessionId] && (sessions[sessionId].nonce === nonce)) {
            logActions.push(endOp(sessionId));
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
            logActions.push(rememberOp(sessionId, memento));
            return true;
        } else {
            return false;
        }
    };

    var replayLog = function() {
        logActions
            .forEach(function(action) {
                         var session = that.instanceSession(action.sessionId);
                         switch (action.op) {
                         case 'notify':
                             backchannel
                                 .notifyBackchannel(session, action.argsArray);
                             break;
                         case 'begin':
                             session.nonce = action.nonce;
                             break;
                         case 'end':
                             delete session.nonce;
                             delete session.memento;
                             break;
                         case 'remember':
                             session.memento = action.memento;
                             break;
                         case 'boundQueue':
                             backchannel
                                 .limitBackchannel(session, action.maxMsgs);
                             break;
                         default:
                             throw new Error('CA Session: invalid log action ' +
                                             action.op);
                         }
                     });
        logActions = [];
    };

    // override gen_transactional methods

    that.__ca_init__ = function(cb0) {
        sessions = {};
        logActions = [];
        cb0(null);
    };

    that.__ca_resume__ = function(cp, cb0) {
        logActions = cp.logActions || [];
        sessions = cp.sessions || {};
        replayLog();
        cb0(null);
    };

    that.__ca_begin__ = function(msg, cb0) {
        var sessionId = json_rpc.getSessionId(msg);
        if (sessionId) {
            that.setCurrentSessionId(sessionId);
            that.instanceSession(sessionId);
            logActions = [];
            cb0(null);
        } else {
            cb0('Error: no session ID in msg');
        }
    };

    that.__ca_prepare__ = function(cb0) {
        var dumpState = function() {
            var cleanupF = function(key, value) {
                return ((key === 'bc') ? undefined : value);
            };
            return JSON.stringify({sessions: sessions, logActions: logActions},
                                  cleanupF);
        };
        cb0(null, dumpState());
    };

    that.__ca_commit__ = function(cb0) {
        replayLog();
        that.setCurrentSessionId(undefined);
        cb0(null);
    };

    that.__ca_abort__ = function(cb0) {
        logActions = [];
        that.setCurrentSessionId(undefined);
        cb0(null);
    };

    // pull is not transactional and can race with message processing

    that.pull = function(request, cb0) {
        var sessionId = json_rpc.getSessionId(request);
        if (sessionId) {
             backchannel.pullBackchannel(request,
                                         that.instanceSession(sessionId),
                                         bcTimeout, cb0);
        } else {
            cb0('Error: no session ID in request' + JSON.stringify(request));
        }

    };


    var super_shutdown = that.superior('shutdown');
    that.shutdown = function(context0, cb0) {
        for (var sessionId in sessions) {
            backchannel.finishBackchannel(sessions[sessionId]);
        }
        super_shutdown(context0, cb0);
    };

    cb(null, that);
};
