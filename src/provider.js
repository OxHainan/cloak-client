const axios = require('axios');
const Web3 = require('web3');
const rlp = require('rlp')
const cloakApi = require('./claokApi')
const Account = require('eth-lib/lib/account');
const hash = require('eth-lib/lib/hash');
const Transaction = require('./transaction/sign').Transaction
const utils = require('web3-utils')

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
            newPayload.params.policy = utils.toHex(JSON.stringify(newPayload.params.policy))
            return newPayload
        },
        cloak_sendMultiPartyTransaction: function (payload) {
            var newPayload = JSON.parse(JSON.stringify(payload))
            var p = newPayload.params[0]
            newPayload.params = {params: signMpt(p.privateKey, p.from, p.to, p.data)}
            return newPayload
        },
        cloak_sendRawMultiPartyTransaction: function (payload) {
            var p = payload.params[0]
            p.params.data = utils.toHex(JSON.stringify(p.params.data))
            var ethTx = new Transaction(p.params, 2);
            const result = signatrue(p.account.privateKey, ethTx)
            payload.params = [result.rawTransaction]
            return payload
        },
        cloak_sendRawPrivacyTransaction: function (payload) {
            var p = payload.params[0]
            p.params.data = utils.toHex(JSON.stringify(p.params.data))
            var ethTx = new Transaction(p.params, 1);
            const result = signatrue(p.account.privateKey, ethTx)
            payload.params = [result.rawTransaction]
            return payload
        }
    }
}

function signMpt(privateKey, from, to, data, nonce=0) {
    var dataBuffer = Buffer.from(data, 'utf8')
    var msg = rlp.encode([nonce, from, to, dataBuffer])
    var msgHash = hash.keccak256s(msg)
    var vars = Account.decodeSignature(Account.sign(msgHash, privateKey))
    var res = rlp.encode([nonce, from, to, dataBuffer, vars[0], vars[1], vars[2]])
    return utils.toHex(res)
}

function signatrue(privateKey, ethTx) {
    if (privateKey.startsWith('0x')) {
        privateKey = privateKey.substring(2);
    }
    ethTx.sign(Buffer.from(privateKey, 'hex'))
    var validationResult = ethTx.validate(true);
    if (validationResult !== '') {
        console.log('Signer Error: ' + validationResult);
    }
    var rlpEncoded = ethTx.serialize().toString('hex');
    var rawTransaction = '0x' + rlpEncoded;
    var transactionHash = utils.keccak256(rawTransaction);
    var result = {
        messageHash: '0x' + Buffer.from(ethTx.hash(false)).toString('hex'),
        v: '0x' + Buffer.from(ethTx.v).toString('hex'),
        r: '0x' + Buffer.from(ethTx.r).toString('hex'),
        s: '0x' + Buffer.from(ethTx.s).toString('hex'),
        rawTransaction: rawTransaction,
        transactionHash: transactionHash
    };
    return result
}

exports.CloakProvider = CloakProvider
