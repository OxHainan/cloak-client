var _ = require('underscore');

var errors = require('web3-core-helpers').errors;
var XHR2 = require('xhr2-cookies').XMLHttpRequest; // jshint ignore: line

var HttpProvider = function HttpProvider(host, options) {
    options = options || {};
    this.withCredentials = options.withCredentials || false;
    this.timeout = options.timeout || 0;
    this.headers = options.headers;
    this.agent = options.agent;
    this.connected = false;
    const keepAlive = options.keepAlive !== false;

    this.host = host || 'https://localhost:8000';
    if (!this.agent) {
        throw new Error('No https');
    }

    if (this.host.substring(0,5) !== "https"){
        throw new Error("Invalid HTTPS protocol")
    }

    this.httpsAgent = this.agent;
    
};

HttpProvider.prototype._prepareRequest = function(path) {
    var request;
    request = new XHR2();
    var url = this.host + '/app/' + path;
    var agents = { httpsAgent: this.httpsAgent, httpAgent: this.httpAgent, baseUrl: this.baseUrl };
    if (this.agent) {
        agents.httpsAgent = this.httpsAgent;
        agents.httpAgent = this.agent.http;
        agents.baseUrl = this.agent.baseUrl;
    }

    request.nodejsSet(agents);
    request.open('POST', url, true);
    request.setRequestHeader('Content-Type', 'application/json');
    request.timeout = this.timeout;
    request.withCredentials = this.withCredentials;
    if (this.headers) {
        this.headers.forEach(function (header) {
            request.setRequestHeader(header.name, header.value);
        });
    }
    return request;
}

HttpProvider.prototype.send = function (payload, callback) {
    var _this = this;
    let params = payload.params.length == 1 && _.isObject(payload.params[0]) ? payload.params[0] : payload.params;
    var request = this._prepareRequest(payload.method);
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.timeout !== 1) {
            var result = request.responseText;
            var error = null;
            try {
                result = JSON.parse(result);
            }
            catch (e) {
                error = errors.InvalidResponse(request.responseText);
            }
            _this.connected = true;
            callback(error, result);
        }
    };
    request.ontimeout = function () {
        _this.connected = false;
        callback(errors.ConnectionTimeout(this.timeout));
    };
    try {
        request.send(JSON.stringify(params));
    }
    catch (error) {
        this.connected = false;
        callback(errors.InvalidConnection(this.host));
    }
};

HttpProvider.prototype.disconnect = function () {
    //NO OP
};

module.exports = HttpProvider;
