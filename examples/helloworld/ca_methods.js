'use strict';

var caf = require('caf_core');

exports.methods = {
    __ca_init__: function(cb) {
        this.state.counter = 0;
        this.$.session.limitQueue(10, 'client1');
        this.$.session.limitQueue(10, 'client2');
        cb(null);
    },
    __ca_pulse__: function(cb) {
        this.state.counter = this.state.counter + 1;
        if (this.state.counter % 2 === 0) {
            this.$.session.notify([this.state.counter], 'client1');
        }
        if (this.state.counter % 3 === 0) {
            this.$.session.notify([this.state.counter], 'client2');
        }
        cb(null);
    },
    sessionInfo: function(cb) {
        var self = this;
        var sessionInfo = {current: this.$.session.getSessionId()};
        this.$.session.getAllSessionIds().forEach(function(x) {
            sessionInfo[x] = self.$.session.outq(x);
        });
        cb(null, sessionInfo);
    },
    notifyAll: function(msg, cb) {
        var self = this;
        this.$.session.getAllSessionIds().forEach(function(x) {
            self.$.session.notify([msg], x);
        });
        this.sessionInfo(cb);
    }
};

caf.init(module);
