'use strict';
var core = require('web3-core');
var Method = require('web3-core-method');
var formatters = require('web3-core-helpers').formatters;

var Network = function Network() {
    var _this = this;
    core.packageInit(this, arguments);
    var methods = [
        new Method({
            name: 'initializeService',
            call: 'set_ethereumConfiguration',
            params: 1,
            inputFormatter: [function (data){
                return {
                    service: formatters.inputAddressFormatter(data.service),
                    state: formatters.inputAddressFormatter(data.state)
                }
            }]
        }),

        new Method({
            name: 'escrow',
            call: 'send_contractEscrow',
            params: 1,
            inputFormatter: [formatters.inputAddressFormatter]
        })
    ];

    methods.forEach(function (method) {
        method.attachToObject(_this);
        method.setRequestManager(_this._requestManager);
    })
}

module.exports = Network;