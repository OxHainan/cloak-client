

const { readFileSync } = require('fs');

const Cloak = require('../index.js')
const { Agent } = require('https');
var args = process.argv.slice(2);
const httpsAgent = new Agent({
    rejectUnauthorized: false,
    ca: readFileSync(args[0] + "/service_cert.pem"),
    cert: readFileSync(args[0] + "/user0_cert.pem"),
    key: readFileSync(args[0] + "/user0_privk.pem"),
})

const cloak = new Cloak(new Cloak.HttpProvider('https://127.0.0.1:8000', { agent: httpsAgent}))
let contract_addr = args[1];
let logic_path = './contracts/Logic1.json'
var userKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f681e';

// 发送交易
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function send(to, data, pkey) {
    let hex = await cloak.eth.accounts.signTransaction({
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
    instance, privateKey, index
) {
    let now = Date.now();
    let receipt = await send(instance._address, instance.methods.set(12), privateKey)
    console.log('receipt: ', receipt,  'timestamp: ',  Date.now() - now, 'index: ', index)
}

delay().then(()=>{
    let obj = JSON.parse(readFileSync(logic_path));
    return new cloak.eth.Contract(obj.abi, contract_addr);
}).then(async (it) =>{
    for (let i = 0; i < 3; i++) {
        sendSignedTransaction(it, userKey, i)
    }
})

