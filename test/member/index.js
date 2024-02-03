

const { readFileSync } = require('fs');
const Web3 = require('web3');
const { writeData } = require("../generate")
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
let service_addr = args[1];
let baseline = args[2]
let proxy_addr = args[3]
var ProxyPath = './../contracts/TransparentProxy.json'
let logic_path = './../contracts/MemberFactory.json'
var ServicePath = './../contracts/Service.json';
var userKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f681e';
let user = web3.eth.accounts.privateKeyToAccount(userKey);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function send(instance, to, data, nonce, pkey, deploy_method) {
    let hex = await instance.eth.accounts.signTransaction({
        nonce: nonce,
        to: to,
        data: data.encodeABI(),
        gasPrice: instance.utils.toHex(0),
        gas: instance.utils.toHex(50e5)
    }, pkey);

    let receipt = await instance.eth.sendSignedTransaction(hex.rawTransaction)
    if (check_network_is_web3(instance)) {
        writeData({
            "baseline": baseline,
            "name": "send",
            "method": deploy_method === undefined ? data._method.name : deploy_method,
            "gasUsed": receipt.gasUsed,
            "size": Buffer.byteLength(hex.rawTransaction, 'utf8')
        })
    }
    if (to === null) {
        return receipt.contractAddress;
    }

    return receipt.transactionHash;
}

async function sendToWeb3(to, data, pkey, deploy_method) {
    let hex = await web3.eth.accounts.signTransaction({
        to: to,
        data: data.encodeABI(),
        gasPrice: web3.utils.toHex(0),
        gas: web3.utils.toHex(50e5)
    }, pkey);

    let receipt = await web3.eth.sendSignedTransaction(hex.rawTransaction)

    writeData({
        "baseline": baseline,
        "name": "send",
        "method": deploy_method === undefined ? data._method.name : deploy_method,
        "gasUsed": receipt.gasUsed,
        "size": Buffer.byteLength(hex.rawTransaction, 'utf8')
    })

    if (to === null) {
        return receipt.contractAddress;
    }

    return receipt.transactionHash;
}

async function sendSignedTransaction(
    instance, privateKey, data, index
) {
    let now = Date.now();
    let receipt = await send(cloak, instance._address, data, index, privateKey)
    writeData({
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
    let it = new web3.eth.Contract(obj.abi);
    let data = await it.deploy({
        data: obj.bytecode,
        arguments: params
    });
    let nonce = await web3.eth.getTransactionCount(user.address)

    let addr = await send(web3, null, data, nonce, userKey, method);
    return new web3.eth.Contract(obj.abi, addr);
}

async function deploy_proxy() {
    let logic = await deploy("logic", logic_path);
    let proxy = await deploy("proxy", ProxyPath, [logic._address, user.address])
    return proxy;
}

function get_contract_handle(instance, path, addr) {
    let obj = JSON.parse(readFileSync(path));
    return new instance.eth.Contract(obj.abi, addr);
}

function check_network_is_web3(instance) {
    return instance._provider.host === web3_url;
}

async function escrow() {
    let proxy = await deploy_proxy();
    let logic = await proxy.methods.implementation().call({ from: user.address });
    console.log("logic: ", logic)
    let service = get_contract_handle(web3, ServicePath, service_addr);
    let bridge = await service.methods.proxyBridge().call();
    let nonce = await web3.eth.getTransactionCount(user.address)
    await send(web3, proxy._address, proxy.methods.upgradeTo(bridge), nonce, userKey);
    await send(web3, service._address, service.methods.escrow(proxy._address, logic), nonce + 1, userKey);
    cloak.network.escrow(proxy._address).then(console.log)
    await delay(1000)
    console.log('Proxy: ', proxy._address)
    return proxy;
}

async function get_logic(proxy_addr) {
    const _ROLLBACK_SLOT = "0x2a7ee7a990a244bda6b8218d6cc50c824030ffcca1203a6c59bdca9cb30f9e58";
    let logic = await web3.eth.getStorageAt(proxy_addr, _ROLLBACK_SLOT);
    return get_contract_handle(web3, logic_path, logic)
}

function create_account() {
    let accounts = new Array(100);
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
    // let logic = await get_logic(it._address)
    let accounts = create_account()
    let nonce = await cloak.eth.getTransactionCount(user.address)
    let web3Tx = new Array(baseline);
    for (let i = 0; i < baseline; i++) {
        let r = i % accounts.length
        let acc = accounts[r];
        let data = it.methods.createMember(acc.address.substr(0, 34), [acc.address.substr(0, 34), acc.address.substr(0, 34)], "account", "account", "account@123.com", [acc.privateKey, acc.privateKey, acc.privateKey], [acc.privateKey], "account", "account");
        sendSignedTransaction(it, userKey, data, i + nonce)
        web3Tx[i] = data;
    }

})
