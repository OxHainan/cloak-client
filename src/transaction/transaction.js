"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var ethereumjs_util_1 = require("ethereumjs-util");
var ethereumjs_common_1 = require("ethereumjs-common");
var buffer_1 = require("buffer");
// secp256k1n/2
var N_DIV_2 = new ethereumjs_util_1.BN('7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0', 16);
var privacy = [
    {
        name: 'to',
        allowZero: true,
        length: 20,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'verifierAddr',
        allowZero: true,
        length: 20,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'codeHash',
        allowZero: true,
        length: 32,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'data',
        allowZero: true,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'v',
        allowZero: true,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'r',
        length: 32,
        allowZero: true,
        allowLess: true,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 's',
        length: 32,
        allowZero: true,
        allowLess: true,
        default: new buffer_1.Buffer.from([]),
    },
];

var cloak = [
    {
        name: 'nonce',
        allowLess: true,
        length: 32,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'to',
        // allowZero: true,
        allowLess: true,
        // length: 20,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'data',
        allowZero: true,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'v',
        allowZero: true,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 'r',
        length: 32,
        allowZero: true,
        allowLess: true,
        default: new buffer_1.Buffer.from([]),
    },
    {
        name: 's',
        length: 32,
        allowZero: true,
        allowLess: true,
        default: new buffer_1.Buffer.from([]),
    },
];

var Transaction = /** @class */ (function () {
    function Transaction(data, schema, opts) {
        if (data === void 0) { data = {}; }
        if (opts === void 0) { opts = {}; }

        if (opts.common) {
            if (opts.chain || opts.hardfork) {
                throw new Error('Instantiation with both opts.common, and opts.chain and opts.hardfork parameter not allowed!');
            }
            this._common = opts.common;
        } else {
            var chain  = opts.chain ? opts.chain : 'mainnet';
            var hardfork = opts.hardfork ? opts.hardfork : 'petersburg';
            this._common = new ethereumjs_common_1.default(chain, hardfork);
        }

        this.fields = schema == 1 ?  privacy : cloak;
  
        ethereumjs_util_1.defineProperties(this, this.fields, data)

        Object.defineProperty(this, 'from', {
            enumerable: true,
            configurable: true,
            get: this.getSenderAddress.bind(this),
        });
        this._validateV(this.v);
        this._overrideVSetterWithValidation();
    }

    Transaction.prototype.toCreationAddress = function () {
        return this.to.toString('hex') === '';
    };

    Transaction.prototype.hash = function (includeSignature) {
        if ( includeSignature === void 0) {
            includeSignature = true;
        }

        var items;
        if(includeSignature) {
            items = this.raw;
        } else {
            var length = this.fields.length - 3;
            if (this._implementsEIP155()) {
                items = this.raw.slice(0, length).concat([
                    ethereumjs_util_1.toBuffer(this.getChainId()),
                    ethereumjs_util_1.stripZeros(ethereumjs_util_1.toBuffer(0)),
                    ethereumjs_util_1.stripZeros(ethereumjs_util_1.toBuffer(0)),
                ])
            } else {
                items = this.raw.slice(0, length);
            }
        }
        return ethereumjs_util_1.rlphash(items);
    };

    Transaction.prototype.getChainId = function () {
        return this._common.chainId();
        // return 1;
    }

    Transaction.prototype.getSenderAddress = function () {
        if (this._from) {
            return this._from;
        }
        var pubkey = this.getSenderPublicKey();
        this._from = ethereumjs_util_1.publicToAddress(pubkey);
        return this._from;
    };

    Transaction.prototype.getSenderPublicKey = function () {
        if (!this.verifySignature()) {
            throw new Error('Invalid Signature');
        }

        return this._senderPubKey;
    }

    Transaction.prototype.verifySignature = function () {
        var msgHash = this.hash(false);
        if (this._common.gteHardfork('homestead') && new ethereumjs_util_1.BN(this.s).cmp(N_DIV_2) === 1 ) {
            return false;
        }
        try {
            var v = ethereumjs_util_1.bufferToInt(this.v);
            var useChainIdWhileRecoveringPubKey = v >= this.getChainId() * 2 + 35 && this._common.gteHardfork('spuriousDragon');        
            this._senderPubKey = ethereumjs_util_1.ecrecover(msgHash, v, this.r, this.s,  useChainIdWhileRecoveringPubKey ? this.getChainId() : undefined );
        } catch (error) {
            return false;
        }
        return !!this._senderPubKey;
    }
 
    Transaction.prototype.sign = function (privateKey) {
        this.v = new buffer_1.Buffer.from([]);
        this.s = new buffer_1.Buffer.from([]);
        this.r = new buffer_1.Buffer.from([]);
        var msgHash = this.hash(false);
        var sig = ethereumjs_util_1.ecsign(msgHash, privateKey);
        if (this._implementsEIP155()) {
            sig.v += this.getChainId() * 2 + 8;
        }
        Object.assign(this, sig);

    }

    Transaction.prototype.validate = function (stringError) {
        if ( stringError === void 0 ) {
            stringError = false;
        }

        var errors = [];
        if (!this.verifySignature()) {
            errors.push('Invalid Signatrue');
        }

        if ( stringError === false) {
            return errors.length === 0;
        } else {
            return errors.join(' ');
        }
    };

    Transaction.prototype.serialize = function () {
        return ethereumjs_util_1.rlp.encode(this.raw);
    }

    Transaction.prototype.toJSON = function (lables) {
        if (lables === void 0) {
            lables = false;
        }
        return {};
    }

    Transaction.prototype._validateV = function (v) {
        if ( v === undefined || v.length === 0) {
            return;
        }
        
        if (!this._common.gteHardfork('spuriousDragon')) {
            return;
        }

        var vInt = ethereumjs_util_1.bufferToInt(v);
        if (vInt === 27 || vInt === 28) {
            return;
        }

        var isValidEIP155V = vInt === this.getChainId() * 2 + 35 || vInt === this.getChainId() * 2 + 36;
        if ( !isValidEIP155V) {
            throw new Error("Incompatible EIP155-based V" + vInt + " and chain id " + this.getChainId() + ".")
        }
    };

    Transaction.prototype._isSigned = function () {
        return this.v.length > 0 && this.r.length > 0 && this.s.length > 0;
    };

    Transaction.prototype._overrideVSetterWithValidation = function () {
        var _this = this;
        var vDescriptor = Object.getOwnPropertyDescriptor(this, 'v');
        Object.defineProperty(this, 'v', __assign({}, vDescriptor, { set: function (v) {
            if (v !== undefined) {
                _this._validateV(ethereumjs_util_1.toBuffer(v))
            }
            vDescriptor.set(v);
        }}))
    };

    Transaction.prototype._implementsEIP155 = function () {
        var onEIP155BlockOrLater = this._common.gteHardfork('spuriousDragon');
        if (!this._isSigned()) {
            // We sign with EIP155 all unsigned transactions after spuriousDragon
            return onEIP155BlockOrLater;
        }
        var v = ethereumjs_util_1.bufferToInt(this.v);
        // var vAndChainIdMeetEIP155Conditions = v === this.getChainId() * 2 + 35 || v === this.getChainId() * 2 + 36;
        var vAndChainIdMeetEIP155Conditions = v === this.getChainId() * 2 + 35 || v === this.getChainId() * 2 + 36;
        return vAndChainIdMeetEIP155Conditions
    }

    return Transaction;

}());
exports.default = Transaction;
