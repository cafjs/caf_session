'use strict';

const caf = require('caf_core');

exports.methods = {
    async __ca_init__() {
        this.state.counters = {};
        return [];
    },
    async begin() {
        return [null, this.$.session.begin()];
    },
    async buy(nonce, itemIndex, item) {
        if (this.$.session.remember(nonce, itemIndex)) {
            const counter = this.state.counters[item] || 0;
            this.state.counters[item] = counter + 1;
            return this.getCounters();
        } else {
            const err = new Error('Ignoring buy operation, bad nonce');
            err.item = item;
            return [err];
        }
    },
    async end(nonce) {
        return [null, this.$.session.end(nonce)];
    },
    async getCounters() {
        return [null, this.state.counters];
    }
};

caf.init(module);
