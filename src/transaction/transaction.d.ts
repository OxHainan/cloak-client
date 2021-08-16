/// <reference types="node" />
/// <reference types="bn.js" />
import { BN } from 'ethereumjs-util';
export declare type BufferLike = Buffer | TransformableToBuffer | PrefixedHexString | number;
import Common from 'ethereumjs-common';

interface TxData {
    to?: BufferLike;
    /**
     * The transaction's nonce.
     */
     verifierAddr?: BufferLike;
     codeHash?: BufferLike;
    /**
     * This will contain the data of the message or the init of a contract
     */
    data?: BufferLike;
    /**
     * EC recovery ID.
     */
    v?: BufferLike;
    /**
     * EC signature parameter.
     */
    r?: BufferLike;
    /**
     * EC signature parameter.
     */
    s?: BufferLike;
}

interface CloakData {
    to?: BufferLike;
    /**
     * The transaction's nonce.
    /**
     * This will contain the data of the message or the init of a contract
     */
    data?: BufferLike;
    /**
     * EC recovery ID.
     */
    v?: BufferLike;
    /**
     * EC signature parameter.
     */
    r?: BufferLike;
    /**
     * EC signature parameter.
     */
    s?: BufferLike;
}
export interface TransactionOptions {
    /**
     * A Common object defining the chain and the hardfork a transaction belongs to.
     */
    common?: Common;
    /**
     * The chain of the transaction, default: 'mainnet'
     */
    chain?: number | string;
    /**
     * The hardfork of the transaction, default: 'petersburg'
     */
    hardfork?: string;
}
export default class Transaction {
    raw: Buffer[];
    to: Buffer;
    data: Buffer;
    // verifierAddr: Buffer;
    // codeHash: Buffer;
    v: Buffer;
    r: Buffer;
    s: Buffer;
    private _senderPubKey?;
    protected _from?: Buffer;
    private _fields;
    constructor(data?: Buffer | TxData | BufferLike[], schema?: Number, opts?: TransactionOptions)
    toCreationAddress(): boolean;
    /**
     * Computes a sha3-256 hash of the serialized tx
     * @param includeSignature - Whether or not to include the signature
     */
    hash(includeSignature?: boolean): Buffer;
    /**
     * returns chain ID
     */
    getChainId(): number;
    /**
     * returns the sender's address
     */
    getSenderAddress(): Buffer;
    /**
     * returns the public key of the sender
     */
    getSenderPublicKey(): Buffer;
    /**
     * Determines if the signature is valid
     */
    verifySignature(): boolean;
    /**
     * sign a transaction with a given private key
     * @param privateKey - Must be 32 bytes in length
     */
    sign(privateKey: Buffer): void;
    /**
     * The amount of gas paid for the data in this tx
     */
    getDataFee(): BN;
    /**
     * the minimum amount of gas the tx must have (DataFee + TxFee + Creation Fee)
     */
    getBaseFee(): BN;
    /**
     * the up front amount that an account must have for this transaction to be valid
     */
    getUpfrontCost(): BN;
    /**
     * Validates the signature and checks to see if it has enough gas.
     */
    validate(): boolean;
    validate(stringError: false): boolean;
    validate(stringError: true): string;
    /**
     * Returns the rlp encoding of the transaction
     */
    serialize(): Buffer;
    /**
     * Returns the transaction in JSON format
     * @see {@link https://github.com/ethereumjs/ethereumjs-util/blob/master/docs/index.md#defineproperties|ethereumjs-util}
     */
    toJSON(labels?: boolean): {
        [key: string]: string;
    } | string[];
    private _validateV;
    private _isSigned;
    private _overrideVSetterWithValidation;
    private _implementsEIP155;
}