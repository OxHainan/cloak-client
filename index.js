"use strict";
var version = require('./package.json').version;
var core = require('web3-core');
var Eth = require('web3-eth');
var utils = require('web3-utils');
var Network = require('./src/network')
var HttpProvider = require('./src/providers-https')

var Cloak = function Cloak() {
    var _this = this;
    core.packageInit(this, arguments);
    this.version = version;
    this.utils = utils;
    this.eth = new Eth(this);
    this.network = new Network(this);
    var setProvider = this.setProvider;
    this.setProvider = function (provider) {
        setProvider.apply(_this, arguments);
        _this.eth.setRequestManager(_this._requestManager)
        return true;
    }
}

Cloak.version = version;
Cloak.utils = utils;
Cloak.HttpProvider = HttpProvider;

Cloak.module = {
    Eth: Eth,
    Network: Network,
}

core.addProviders(Cloak);
module.exports = Cloak;
