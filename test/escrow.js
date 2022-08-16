const Web3 = require('web3');
const { readFileSync } = require('fs');
const Cloak = require('../index.js')
const { Agent } = require('https');

var args = process.argv.slice(2);

const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

const httpsAgent = new Agent({
    rejectUnauthorized: false,
    ca: readFileSync(args[0] + "/service_cert.pem"),
    cert: readFileSync(args[0] + "/user0_cert.pem"),
    key: readFileSync(args[0] + "/user0_privk.pem"),
})

const cloak = new Cloak(new Cloak.HttpProvider('https://127.0.0.1:8000', { agent: httpsAgent}))

var userKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f681e';
var serviceKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f689e'
var ServicePath = './contracts/Service.json';
var LogicPath = './contracts/Logic1.json'
var ProxyPath = './contracts/TransparentProxy.json'
let user = web3.eth.accounts.privateKeyToAccount(userKey);
let service = web3.eth.accounts.privateKeyToAccount(serviceKey);

async function send(to, data, pkey) {
    let hex = await web3.eth.accounts.signTransaction({
        to: to,
        data: data.encodeABI(),
        gasPrice: web3.utils.toHex(0),
        gas: web3.utils.toHex(50e5)
    }, pkey);

    let receipt = await web3.eth.sendSignedTransaction(hex.rawTransaction)
    if (to === null) {
        return receipt.contractAddress;
    }

    return receipt.transactionHash;
}

async function deploy(path, params){
    let obj = JSON.parse(readFileSync(path));
    let it = new web3.eth.Contract(obj.abi);

    let data = await it.deploy({
        data: obj.bytecode,
        arguments: params
    });

    let addr = await send(null, data, userKey);
    return new web3.eth.Contract(obj.abi, addr);
}

async function get_service(addr) {
    let obj = JSON.parse(readFileSync(ServicePath));
    return new web3.eth.Contract(obj.abi, addr);
}

async function deploy_proxy() {
    let logic = await deploy(LogicPath);
    let proxy = await deploy(ProxyPath, [logic._address, user.address])
    return proxy;
}

// 完成托管
async function escrow() {
    let proxy = await deploy_proxy();
    let logic = await proxy.methods.implementation().call({from: user.address});
    let service = await get_service(args[1])
    let bridge = await service.methods.proxyBridge().call();
    await send(proxy._address, proxy.methods.upgradeTo(bridge), userKey)
    await send(service._address, service.methods.escrow(proxy._address, logic), userKey);
    cloak.network.escrow(proxy._address).then(console.log)
    console.log('Proxy: ', proxy._address)
}

escrow()
