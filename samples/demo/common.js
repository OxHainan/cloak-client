"use strict";

import { CloakProvider, Methods, KeyExchange } from 'cloak-client';
import {Agent} from 'https';
import Web3 from 'web3';
import {readFileSync} from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';

const p_exec = promisify(exec);

async function get_abi_and_bin(file, name) {
    const cmd = `solc --combined-json abi,bin --evm-version homestead --optimize ${file}`
    const {stdout,} = await p_exec(cmd)
    const j = JSON.parse(stdout)["contracts"][`${file}:${name}`]
    return j;
}

async function deployPrivateContract(web3, account, dir, name) {
    const contract = await get_abi_and_bin(dir + '/private_contract.sol', name)
    let addr = await Methods.cloakDeploy(web3, contract, null, account.privateKey);
    return new web3.eth.Contract(contract.abi, addr);
}

async function deployPublicContract(web3, cloakService, account, dir, name, params) {
    const contract = await get_abi_and_bin(dir + '/public_contract.sol', name)
    let addr = await Methods.deploy(web3, cloakService, contract, params, account)
    return new web3.eth.Contract(contract.abi, addr);
}

async function deployContract(cloakWeb3, ethWeb3, cloakService, account, dir, name, params) {
    const pub = await deployPublicContract(ethWeb3, cloakService, account, dir, name, params);
    const pri = await deployPrivateContract(cloakWeb3, account, dir, name);
    return [pub, pri];
}

async function getCloakService(web3, addr, path) {
    const obj = JSON.parse(readFileSync(path))
    return new web3.eth.Contract(obj.abi, addr)
}

async function transfer(web3, defaultAccount, targetAddr) {
    web3.eth.getBalance(targetAddr).then(balance => {
        if (balance > web3.utils.toWei('5', 'ether')) {
            return;
        }

        web3.eth.sendTransaction({from: defaultAccount, to: targetAddr, value:  web3.utils.toWei('8', 'ether')})
    })
}

async function deposit(web3, cloakService, account) {
    const available = await Methods.getAvailableBalance(cloakService, account.address);
    if (available > web3.utils.toWei('5', 'ether')) {
        return;
    }

    await Methods.send(web3, null, cloakService._address, account.privateKey, web3.utils.toWei('5', 'ether'))
}

async function generateAccounts(web3, cloakService) {
    let accounts = new Array(10);
    let transferAcc = await web3.eth.getAccounts();
    for (let i = 0; i < accounts.length; i++) {
        accounts[i] = web3.eth.accounts.privateKeyToAccount(web3.utils.keccak256("account" + i));
        if (await Methods.isRegisterPki(cloakService, accounts[i].address)) {
            await register_pki(web3, cloakService, accounts[i]); 
        }

        await transfer(web3, transferAcc[i], accounts[i].address);
    }

    await new Promise(resolve => { setTimeout(resolve, 6000) });
    for (let i = 0; i < accounts.length; i++) {
        await deposit(web3, cloakService, accounts[i]);
    }

    return accounts;
}

async function register_pki(web3, cloakService, account) {
    try {
        let data = await Methods.register_pki(cloakService, account);
        let receipt = await Methods.send(web3, data, data._parent._address, account.privateKey);
    } catch (error) {
        return;
    }  
}

async function sendPrivacyTransaction(web3, account, pubAddr, priAddr, dir) {
    const codeHash = web3.utils.keccak256(readFileSync(dir + "/private_contract.sol"))
    await web3.cloak.sendPrivacyTransaction({
        account: account,
        params: {
            to: priAddr,
            codeHash: codeHash,
            verifierAddr: pubAddr,
            data: web3.utils.toHex(readFileSync(dir + "/policy.json"))
        }
    })
}

async function sendMultiPartyTransaction(web3, account, target, params) {
    const id = await web3.cloak.sendMultiPartyTransaction({
        account: account,
        params: {
            nonce: web3.utils.toHex(100),
            to: target,
            data: params
        }
    })

    getMultiPartyTransaction(web3, id).then(console.log)
    return id;
}

async function getMultiPartyTransaction(web3, id) {
    await new Promise(resolve => { setTimeout(resolve, 3000) });
    return await web3.cloak.getMultiPartyTransaction({id: id});
}

async function register_service(ccfAuthDir, eth_url = 'http://localhost:8545', cloak_url = 'https://127.0.0.1:8000') {
    const eth_web3 = new Web3(new Web3.providers.HttpProvider(eth_url));
    const web3 = new Web3();
    const httpsAgent = new Agent({
        rejectUnauthorized: false,
        ca: readFileSync(ccfAuthDir+"/networkcert.pem"),
        cert: readFileSync(ccfAuthDir+"/user0_cert.pem"),
        key: readFileSync(ccfAuthDir+"/user0_privk.pem"),
    });

    web3.setProvider(new CloakProvider(cloak_url, httpsAgent, web3));
    web3.cloakInfo = await web3.cloak.getCloak();
    return [web3, eth_web3];
}

export default {
    register_service, getCloakService, deployContract, generateAccounts,
    sendPrivacyTransaction, sendMultiPartyTransaction, getMultiPartyTransaction, deposit
}