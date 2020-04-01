'use strict';

const caf = require('caf_core');

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
        const sessionInfo = {current: this.$.session.getSessionId()};
        this.$.session.getAllSessionIds().forEach((x) => {
            sessionInfo[x] = this.$.session.outq(x);
        });
        return [null, sessionInfo];
    },
    async notifyAll(msg) {
        this.$.session.getAllSessionIds().forEach((x) => {
            this.$.session.notify([msg], x);
        });
        return this.sessionInfo();
    }
};

caf.init(module);
