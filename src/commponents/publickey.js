const secp256k1 = require('secp256k1');

var publickey = {
    Create: function (privateKey) {
        let pubKey = secp256k1.publicKeyCreate(Buffer.from(privateKey.slice(2), 'hex'), false);
        return "0x" + Buffer.from(pubKey).toString('hex');
    }
}

module.exports = publickey;
