

const { readFileSync } = require('fs');
const Web3 = require('web3');
const { writeData } = require("./generate")
const Cloak = require('../index.js')
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
var ProxyPath = './contracts/TransparentProxy.json'
let logic_path = './contracts/Logic1.json'
var ServicePath = './contracts/Service.json';
var userKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f681e';
let user = web3.eth.accounts.privateKeyToAccount(userKey);
// 发送交易
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function sendNoSinged(to, data, from) {
    let receipt = await web3.eth.sendTransaction({
        from: from,
        to: to,
        data: data.encodeABI()
    })

    writeData({
        "baseline": baseline,
        "name": "send",
        "method": data._method.name,
        "gasUsed": receipt.gasUsed,
        // "size": Buffer.byteLength(hex.rawTransaction, 'utf8')
    })
}

async function send(instance, to, data, pkey, deploy_method) {
    let hex = await instance.eth.accounts.signTransaction({
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

async function sendSignedTransaction(
    instance, privateKey, data, index
) {
    let now = Date.now();
    let receipt = await send(cloak, instance._address, data, privateKey)
    writeData({
        "baseline": baseline,
        "name": "cloak",
        "method": data._method.name,
        "times": Date.now() - now,
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

    let addr = await send(web3, null, data, userKey, method);
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
    await send(web3, proxy._address, proxy.methods.upgradeTo(bridge), userKey);
    await send(web3, service._address, service.methods.escrow(proxy._address, logic), userKey);
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


function set(it, input, index, logic_addr, from) {
    let data = it.methods.set(input);
    sendSignedTransaction(it, userKey, data, index)
    sendNoSinged(logic_addr, data, from)
}

delay().then(async () => {
    if (proxy_addr !== undefined) {
        return get_contract_handle(cloak, logic_path, proxy_addr)
    }

    let proxy = await escrow();
    return get_contract_handle(cloak, logic_path, proxy._address);
}).then(async (it) => {
    let logic = await get_logic(it._address)
    let accounts = await web3.eth.getAccounts()
    for (let i = 0; i < baseline; i++) {
        set(it, 12, i, logic._address, accounts[0]);
    }

    await delay(10000);
})

