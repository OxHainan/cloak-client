

const { readFileSync, writeFile } = require('fs');

const Web3 = require('web3');
const Cloak = require('../../index.js')
const { Agent } = require('https');
var args = process.argv.slice(2);
const httpsAgent = new Agent({
    rejectUnauthorized: false,
    ca: readFileSync(args[0] + "/service_cert.pem"),
    cert: readFileSync(args[0] + "/user0_cert.pem"),
    key: readFileSync(args[0] + "/user0_privk.pem"),
})
const web3_url = 'http://localhost:8545';

const cloak_url = 'https://127.0.0.1:8000';
const web3 = new Web3(new Web3.providers.HttpProvider(web3_url));

const cloak = new Cloak(new Cloak.HttpProvider(cloak_url, { agent: httpsAgent }))

let worker = args[1];
let baseline = args[2]
let proxy_addr = args[3]
let logic_path = './../contracts/MemberFactory.json'
var userKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f681e';
let user = web3.eth.accounts.privateKeyToAccount(userKey);
// 发送交易
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function writeData(data) {
    writeFile('data/tps.txt', `${JSON.stringify(data)}\n`, { 'flag': 'a' }, function (err) {
        if (err) throw err;
    });
}

async function send(to, data, nonce, pkey) {
    let hex = await cloak.eth.accounts.signTransaction({
        nonce: nonce,
        to: to,
        data: data.encodeABI(),
        gasPrice: cloak.utils.toHex(0),
        gas: cloak.utils.toHex(50e5)
    }, pkey);

    let receipt = await cloak.eth.sendSignedTransaction(hex.rawTransaction)

    if (to === null) {
        return receipt.contractAddress;
    }

    return receipt.transactionHash;
}

async function sendSignedTransaction(
    instance, privateKey, data, index
) {
    let now = Date.now();
    let receipt = await send(instance._address, data, index, privateKey)
    writeData({
        "worker": worker,
        "baseline": baseline,
        "name": "cloak",
        "method": data._method.name,
        "delay": Date.now() - now,
        "startTime": now,
        "finishTime": Date.now()
    })

    console.log('receipt: ', receipt, 'timestamp: ', Date.now() - now, 'index: ', index)
}

async function deploy(method, path, params) {
    let obj = JSON.parse(readFileSync(path));
    let it = new cloak.eth.Contract(obj.abi);
    let data = await it.deploy({
        data: obj.bytecode,
        arguments: params
    });

    let addr = await send(null, data, 0, userKey, method);
    return new cloak.eth.Contract(obj.abi, addr);
}

async function deploy_proxy() {
    let logic = await deploy("logic", logic_path, [1000000, "TEST", 2, "TT"]);
    return logic;
}

function get_contract_handle(instance, path, addr) {
    let obj = JSON.parse(readFileSync(path));
    return new instance.eth.Contract(obj.abi, addr);
}

async function memberExists(data, index) {
    let now = Date.now();
    let res = await data.call();
    writeData({
        "worker": worker,
        "baseline": baseline,
        "name": "cloak",
        "method": data._method.name,
        "delay": Date.now() - now,
        "startTime": now,
        "finishTime": Date.now()
    })
    console.log('timestamp: ', Date.now() - now, 'index: ', index)

}

async function escrow() {
    let proxy = await deploy_proxy();
    return proxy;
}


function create_account() {
    let accounts = new Array(1000);
    for (let i = 0; i < accounts.length; i++) {
        accounts[i] = web3.eth.accounts.privateKeyToAccount(web3.utils.keccak256("accounts" + i.toString()))
    }

    return accounts;
}

function random(index) {
    let rand;
    do {
        rand = Math.floor(Math.random() * (100 - 1) + 1)
    } while (index == rand);
    return rand
}

delay().then(async () => {
    if (proxy_addr !== undefined) {
        return get_contract_handle(cloak, logic_path, proxy_addr)
    }

    let proxy = await escrow();
    return get_contract_handle(cloak, logic_path, proxy._address);
}).then(async (it) => {
    let nonce = await cloak.eth.getTransactionCount(user.address)
    let accounts = create_account()
    for (let i = 0; i < baseline; i++) {
        let r = i % accounts.length
        let acc = accounts[r];
        let data = it.methods.createMember(acc.address.substr(0, 34), [acc.address.substr(0, 34), acc.address.substr(0, 34)], "account", "account", "account@123.com", [acc.privateKey, acc.privateKey, acc.privateKey], [acc.privateKey], "account", "account");
        sendSignedTransaction(it, userKey, data, i + nonce)

        // memberExists(it.methods.memberExists(acc.address.substr(0, 34)), i)
    }
})
