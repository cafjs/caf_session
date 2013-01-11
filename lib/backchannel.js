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
 * Functions to implement a communication backchannel that uses long polling.
 *
 * @module caf_session/backchannel
 *
 */
var caf = require('caf_core');
var json_rpc = caf.json_rpc;
var assert = require('assert');

var tunnel = function(request, msg) {
    assert.ok(json_rpc.isRequest(request), 'invalid request ' +
              request.toString());
    var meta = json_rpc.getMeta(request) || {};
    var notifMsg;
    if (msg) {
        var args = [meta.from, meta.to, meta.sessionId, request.method];
        args = args.concat(msg);
        notifMsg = json_rpc.notification.apply(json_rpc, args);
    }
    return (msg ? json_rpc.reply(request, null, notifMsg) :
             json_rpc.reply(request, 'timeout', null));
};

var sendBackchannel = function(bc, data) {
    clearTimeout(bc.timeout);
    process.nextTick(function() { bc.cb(null, tunnel(bc.request, data));});
};

/** Drops old messages if queue length exceeds a threshold.*/
exports.limitBackchannel = function(session, maxLength) {
    if (session && session.messages && (session.messages.length > maxLength)) {
        var dropNum = session.messages.length - maxLength;
        session.messages.splice(0, dropNum);
    }
};

/** Queues (or sends straightaway) a new notification message.*/
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
        return false;
    }
};

/**
 * Shutdowns a backchannel.
 *
 * Triggered by channel timeout or CA shutdown.
 *
 * @function
 */
var finishBackchannel = exports.finishBackchannel = function(session, optBc) {
    if ((session.bc) && ((!optBc) || (session.bc === optBc))) {
        sendBackchannel(session.bc, null);
        delete session.bc;
    } else if (optBc) {
        // timeout of a backchannel not attached to current session
        sendBackchannel(optBc, null);
    }
};

var newBackchannel = function(request, session, timeout, cb) {
    var newBc = { 'request' : request, 'cb' : cb };
    newBc.timeout = setTimeout(function() {
                                   finishBackchannel(session, newBc);
                               }, timeout);
    // If there is one already, we detach it from session and let it timeout
    session.bc = newBc;
};

/** Polls for new notifications. Invoked by the client. */
exports.pullBackchannel = function(request, session, timeout, cb) {
    var msg = session.messages.shift();
    if (msg) {
        if (session.bc) {
            assert.ok(false, 'BUG!: pullBackchannel not empty msg queue' +
                      ' with bc');
        }
        process.nextTick(function() {cb(null, tunnel(request, msg));});
    } else {
        newBackchannel(request, session, timeout, cb);
    }
};

