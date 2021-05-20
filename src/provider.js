const axios = require('axios');
const Web3 = require('web3');
const rlp = require('rlp')
const cloakApi = require('./claokApi')
const Account = require('eth-lib/lib/account');
const hash = require('eth-lib/lib/hash');

class CloakProvider {
    constructor(host, httpsAgent, web3) {
        this.host = host
        this.httpsAgent = httpsAgent
        this.supportedMethods = null
        this.web3 = web3
        cloakApi.loadCloakModule(web3)
        this.payloadMapper = getPayloadMapper(web3)
    }

    _sendAsync(payload, callback) {
        if (payload.method in this.payloadMapper) {
            payload = this.payloadMapper[payload.method](payload)
        }
        const apiMethod = "/" + payload.method
        if (!(apiMethod in this.supportedMethods)) {
            callback(`don't support this api: ${payload.method}`)
            return
        }
        const url = this.host + "/app/" + payload.method
        const method = "get" in this.supportedMethods[apiMethod] ? "get" : "post"
        axios({
            url: url,
            method: method,
            httpsAgent: this.httpsAgent,
            data: JSON.stringify(payload.params)
        })
            .then(resp => callback(null, resp.data))
            .catch(callback)
    }

    sendAsync(payload, callback) {
        if (this.supportedMethods != null) {
            this._sendAsync(payload, callback)
            return
        }
        axios({
            url: this.host + "/app/api",
            method: "get",
            httpsAgent: this.httpsAgent,
        })
            .then(resp => {
                super.supportedMethods = resp.data.paths
                this._sendAsync(payload, callback)
            })
            .catch(callback)
    }
}

function getPayloadMapper(web3) {
    return {
        cloak_sendPrivacyPolicy: function (payload) {
            var newPayload = JSON.parse(JSON.stringify(payload))
            newPayload.params = newPayload.params[0]
            var web3 = new Web3()
            newPayload.params.policy = web3.utils.toHex(JSON.stringify(newPayload.params.policy))
            return newPayload
        },
        cloak_sendMultiPartyTransaction: function (payload) {
            var newPayload = JSON.parse(JSON.stringify(payload))
            var p = newPayload.params[0]
            newPayload.params = {params: signMpt(web3, p.privateKey, p.from, p.to, p.data)}
            return newPayload
        },
        cloak_sendRawMultiPartyTransaction: function (payload) {
            var newPayload = JSON.parse(JSON.stringify(payload))
            newPayload.method = "cloak_sendMultiPartyTransaction"
            newPayload.params = {params: newPayload.params[0]}
            return newPayload
        }
    }
}

function signMpt(web3, privateKey, from, to, data, nonce=0) {
    var dataBuffer = Buffer.from(data, 'utf8')
    var msg = rlp.encode([nonce, from, to, dataBuffer])
    var msgHash = hash.keccak256s(msg)
    var vars = Account.decodeSignature(Account.sign(msgHash, privateKey))
    var res = rlp.encode([nonce, from, to, dataBuffer, vars[0], vars[1], vars[2]])
    return web3.utils.toHex(res)
}

exports.CloakProvider = CloakProvider
