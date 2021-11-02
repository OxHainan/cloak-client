
var crypto = require('crypto');
function parse(src) {
    if (src == null) return 0;
    if (src[0] == '0' && src[1] == 'x') return src.slice(2, src.length)
    return src;
}

module.exports = function(privateKey, pubKey) {
    let keyPair = crypto.createECDH('secp256k1').setPrivateKey(parse(privateKey), 'hex');
    let secret = keyPair.computeSecret(Buffer.from(parse(pubKey), 'hex'));
    this.key = crypto.hkdfSync('sha256', secret, '', '', 32);

    this.decrypt = function(encrypted_arr) {
        if (encrypted_arr.length != 3) return;
        if (encrypted_arr[0] == null) return 0;
        let data = parse(encrypted_arr[0]);
        let tag = encrypted_arr[1].slice(2, 34);
        let iv = encrypted_arr[1].slice(34, 58);

        let encrypted = data + tag;
        let decrypter = crypto.createDecipheriv('aes-256-gcm', Buffer.from(this.key), Buffer.from(iv, 'hex'))
        let decrypted = decrypter.update(Buffer.from(encrypted, 'hex'));
        return decrypted.slice(0, decrypted.length - 16)
    }
}