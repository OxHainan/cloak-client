var _ = require('underscore');

var errors = require('web3-core-helpers').errors;
var https = require('https');
// Apply missing polyfill for IE
require('cross-fetch/polyfill');
require('es6-promise').polyfill();
require('abortcontroller-polyfill/dist/polyfill-patch-fetch');

var HttpProvider = function HttpProvider(host, options) {
    options = options || {};
    this.withCredentials = options.withCredentials || false;
    this.timeout = options.timeout || 0;
    this.headers = options.headers;
    this.connected = false;
    const keepAlive = options.keepAlive !== false;

    this.host = host || 'https://localhost:8000';

    if (this.host.substring(0, 5) !== "https") {
        throw new Error("Invalid HTTPS protocol")
    }

    this.httpsAgent = options.agent;
    this.httpsAgent.keepAlive = keepAlive;
};

HttpProvider.prototype._prepareRequest = function (payload) {
    let params = payload.params.length == 1 && _.isObject(payload.params[0]) ? payload.params[0] : payload.params;
    var options = {
        method: 'POST',
        body: JSON.stringify(params)
    };

    var headers = {};
    var controller;
    if (typeof AbortController !== 'undefined') {
        controller = new AbortController();
    }
    else if (typeof window !== 'undefined' && typeof window.AbortController !== 'undefined') {
        // Some chrome version doesn't recognize new AbortController(); so we are using it from window instead
        // https://stackoverflow.com/questions/55718778/why-abortcontroller-is-not-defined
        controller = new window.AbortController();
    }

    if (typeof controller !== 'undefined') {
        options.signal = controller.signal;
    }

    var agents = { httpsAgent: this.httpsAgent, httpAgent: this.httpAgent };
    options.agent = agents.httpsAgent;

    if (this.headers) {
        this.headers.forEach(function (header) {
            headers[header.name] = header.value;
        });
    }
    // Default headers
    if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    // As the Fetch API supports the credentials as following options 'include', 'omit', 'same-origin'
    // https://developer.mozilla.org/en-US/docs/Web/API/fetch#credentials
    // To avoid breaking change in 1.x we override this value based on boolean option.
    if (this.withCredentials) {
        options.credentials = 'include';
    }
    else {
        options.credentials = 'omit';
    }
    options.headers = headers;
    if (this.timeout > 0 && typeof controller !== 'undefined') {
        this.timeoutId = setTimeout(function () {
            controller.abort();
        }, this.timeout);
    }

    return options;
}

HttpProvider.prototype.send = function (payload, callback) {
    var options = this._prepareRequest(payload);
    var success = function (response) {
        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
        }
        // Response is a stream data so should be awaited for json response
        response.json().then(function (data) {
            callback(null, data);
        }).catch(function (error) {
            callback(errors.InvalidResponse(response));
        });
    };
    var failed = function (error) {
        if (this.timeoutId !== undefined) {
            clearTimeout(this.timeoutId);
        }
        if (error.name === 'AbortError') {
            callback(errors.ConnectionTimeout(this.timeout));
        }
        callback(errors.InvalidConnection(this.host));
    };

    fetch(this.host + '/app/' + payload.method, options)
        .then(success.bind(this))
        .catch(failed.bind(this));
};

HttpProvider.prototype.disconnect = function () {
    //NO OP
};

module.exports = HttpProvider;
