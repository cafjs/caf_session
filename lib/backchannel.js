// Modifications copyright 2020 Caf.js Labs and contributors
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
 * Helper to implement a communication backchannel that uses long polling
 * or websockets.
 *
 * Functions are for internal use only.
 *
 * @module caf_session/backchannel
 *
 */
const json_rpc = require('caf_transport').json_rpc;
const assert = /**@ignore @type {typeof import('assert')} */(require('assert'));

const tunnel = function(request, msg) {
    assert.ok(json_rpc.isRequest(request), 'invalid request ' +
              request.toString());
    const meta = json_rpc.getMeta(request) || {};
    if (msg) {
        const args = [
            meta.from, meta.to, meta.sessionId, request.method
        ].concat(msg);

        const notifMsg = json_rpc.notification.apply(json_rpc, args);
        return json_rpc.reply(null, request, notifMsg);
    } else {
        const timeoutErr = new Error('timeout');
        timeoutErr['timeout'] = true;
        return json_rpc.reply(json_rpc.newAppError(request, 'timeout',
                                                   timeoutErr));
    }
};

const sendBackchannel = function(bc, data) {
    clearTimeout(bc.timeout);
    process.nextTick(function() { bc.cb(null, tunnel(bc.request, data));});
};

/* Drops old messages if queue length exceeds a threshold.*/
const limitBackchannel = function(session, maxLength) {
    if (session) {
        session.limit = maxLength;
        if (session.messages && (maxLength > 0) &&
            (session.messages.length > maxLength)) {
            const dropNum = session.messages.length - maxLength;
            session.messages.splice(0, dropNum);
        }
    }
};
exports.limitBackchannel = limitBackchannel;


/* Queues (or sends straightaway) a new notification message.*/
exports.notifyBackchannel = function(session, msg) {
    if (session.bc) {
        if (session.messages.length !== 0) {
            assert.ok(false, 'BUG!: notifyBackchannel: not empty msg' +
                      ' queue with bc');
        }
        sendBackchannel(session.bc, msg);
        delete session.bc;
        return true;
    } else {
        session.messages.push(msg);
        if (session.limit > 0) {
            limitBackchannel(session, session.limit);
        }
        return false;
    }
};

/*
 * Shutdowns a backchannel.
 *
 * Triggered by channel timeout or CA shutdown.
 *
 */
const finishBackchannel = exports.finishBackchannel = function(session, optBc) {
    if ((session.bc) && ((!optBc) || (session.bc === optBc))) {
        sendBackchannel(session.bc, null);
        delete session.bc;
    } else if (optBc) {
        // timeout of a backchannel not attached to current session
        sendBackchannel(optBc, null);
    }
};

const newBackchannel = function(request, session, timeout, cb) {
    const newBc = { 'request': request, 'cb': cb };
    newBc.timeout = setTimeout(function() {
        finishBackchannel(session, newBc);
    }, timeout);
    // If there is one already, we detach it from session and let it timeout
    session.bc = newBc;
};

/* Polls for new notifications. Invoked by the client. */
exports.pullBackchannel = function(request, session, timeout, cb) {
    const msg = session.messages.shift();
    if (msg) {
        if (session.bc) {
            assert.ok(false, 'BUG!: pullBackchannel: not empty msg queue' +
                      ' with bc');
        }
        cb(null, tunnel(request, msg));
    } else {
        newBackchannel(request, session, timeout, cb);
    }
};
