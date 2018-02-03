'use strict';

var caf = require('caf_core');

exports.methods = {
    async __ca_init__() {
        this.state.counter = 0;
        this.$.session.limitQueue(10, 'client1');
        this.$.session.limitQueue(10, 'client2');
        return [];
    },
    async __ca_pulse__() {
        this.state.counter = this.state.counter + 1;
        if (this.state.counter % 2 === 0) {
            this.$.session.notify([this.state.counter], 'client1');
        }
        if (this.state.counter % 3 === 0) {
            this.$.session.notify([this.state.counter], 'client2');
        }
        return [];
    },
    async sessionInfo() {
        var self = this;
        var sessionInfo = {current: this.$.session.getSessionId()};
        this.$.session.getAllSessionIds().forEach(function(x) {
            sessionInfo[x] = self.$.session.outq(x);
        });
        return [null, sessionInfo];
    },
    async notifyAll(msg) {
        var self = this;
        this.$.session.getAllSessionIds().forEach(function(x) {
            self.$.session.notify([msg], x);
        });
        return this.sessionInfo();
    }
};

caf.init(module);
