

const { readFileSync, writeFile } = require('fs');
const Web3 = require('web3');
var args = process.argv.slice(2);

const web3_url = 'http://localhost:8545';
const web3 = new Web3(new Web3.providers.HttpProvider(web3_url));
let service_addr = '';
var ServicePath = './../contracts/Service.json';
var ProxyPath = './../contracts/TransparentProxy.json'
let logic_path = './../contracts/ERC20.json'
var userKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f681e';
var accountKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f682e';
let user = web3.eth.accounts.privateKeyToAccount(userKey);
let account = web3.eth.accounts.privateKeyToAccount(accountKey);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function writeData(data) {
    writeFile('data/unescrow.txt', `${JSON.stringify(data)}\n`, { 'flag': 'a' }, function (err) {
        if (err) throw err;
    });
}

async function sendToWeb3(to, data, pkey, deploy_method, params) {
    let hex = await web3.eth.accounts.signTransaction({
        to: to,
        data: data.encodeABI(),
        gasPrice: web3.utils.toHex(0),
        gas: web3.utils.toHex(50e5)
    }, pkey);

    let receipt = await web3.eth.sendSignedTransaction(hex.rawTransaction)
    if (deploy_method === "updateStateAndCancel") {
        writeData({
            "name": "send",
            "id": params.id,
            "address": params.proxy,
            "gasUsed": receipt.gasUsed,
            "size": Buffer.byteLength(hex.rawTransaction, 'utf8')
        })
    }


    if (to === null) {
        return receipt.contractAddress;
    }

    return receipt.transactionHash;
}



async function read_file() {
    let filename = "./data/txs.txt"
    const data = readFileSync(filename, 'utf8');

    // 将文件内容按行拆分到数组中
    const lines = data.split('\n');
    var result = new Array();
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 0) {
            let tx_hash = JSON.parse(lines[i]).id;
            let tx = await web3.eth.getTransaction(tx_hash)
            if (service_addr === '') {
                service_addr = tx.to
            }
            const decodedData = web3.eth.abi.decodeParameters(['address[]', 'bytes[]'], tx.input.slice(10));

            result.push({
                params: decodedData[1][0],
                proxy: decodedData[0][0],
                id: tx_hash,
            })
        }
    }

    return result
} 0

async function deploy(method, path, params) {
    let obj = JSON.parse(readFileSync(path));
    let it = new web3.eth.Contract(obj.abi);
    let data = await it.deploy({
        data: obj.bytecode,
        arguments: params
    });

    let addr = await sendToWeb3(null, data, userKey, method);
    return new web3.eth.Contract(obj.abi, addr);
}

async function deploy_proxy() {
    let logic = await deploy("logic", logic_path, [100000000000000, "TEST", 2, "TT"]);
    let proxy = await deploy("proxy", ProxyPath, [logic._address, user.address])
    await sendToWeb3(proxy._address, logic.methods.mint(1000000000000), accountKey);
    return proxy;
}

function get_contract_handle(instance, path, addr) {
    let obj = JSON.parse(readFileSync(path));
    return new instance.eth.Contract(obj.abi, addr);
}


async function escrow() {
    let proxy = await deploy_proxy();
    let logic = await proxy.methods.implementation().call({ from: user.address });
    let service = get_contract_handle(web3, ServicePath, service_addr);
    let bridge = await service.methods.proxyBridge().call();
    await sendToWeb3(proxy._address, proxy.methods.upgradeTo(bridge), userKey);
    await sendToWeb3(service._address, service.methods.escrow(proxy._address, logic), userKey);
    console.log('Proxy: ', proxy._address)
    return proxy;
}

delay().then(async () => {
    let params = await read_file()
    let service = get_contract_handle(web3, ServicePath, service_addr);

    for (let i = 0; i < params.length; i++) {
        let proxy = await escrow();
        let data = service.methods.updateState(proxy._address, params[i].params)
        await sendToWeb3(service._address, data, userKey, 'updateStateAndCancel', params[i])
    }

})

