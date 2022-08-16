import { Modules } from 'web3';
import { BatchRequest, provider, Providers, Extension } from 'web3-core';
import { Eth } from 'web3-eth';
import { Utils } from 'web3-utils';
import {Network} from './src/network'
export default class Cloak {
    constructor();
    constructor(provider: provider);

    static modules: Modules;
    readonly givenProvider: any;
    static readonly givenProvider: any;
    readonly currentProvider: provider;
    setProvider(provider: provider): boolean;
    static readonly providers: Providers;

    utils: Utils;
    eth: Eth;
    network: Network;
    version: string;
    provider: provider;
    static readonly version: string;
    static readonly utils: Utils;
    extend(extension: Extension): any;
}

export interface Modules {
    Eth: new (provider: provider) => Eth;
    Network: new (provider: provider) => Network;
}