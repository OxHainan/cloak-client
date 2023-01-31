const Web3 = require('web3');
const { readFileSync } = require('fs');
const Cloak = require('../index.js')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const { Agent } = require('https');
const { writeData } = require("./generate");
var args = process.argv.slice(2);
const httpsAgent = new Agent({
    rejectUnauthorized: false,
    ca: readFileSync(args[0] + "/service_cert.pem"),
    cert: readFileSync(args[0] + "/user0_cert.pem"),
    key: readFileSync(args[0] + "/user0_privk.pem"),
})

const cloak = new Cloak(new Cloak.HttpProvider('https://127.0.0.1:8000', { agent: httpsAgent }))

var priKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f689e';
var path = './contracts/Service.json';

async function deploy() {
    let obj = JSON.parse(readFileSync(path));
    let it = new web3.eth.Contract(obj.abi);

    let data = await it.deploy({
        data: obj.bytecode,
        arguments: []
    });

    let hex = await web3.eth.accounts.signTransaction({
        data: data.encodeABI(),
        gasPrice: web3.utils.toHex(0),
        gas: web3.utils.toHex(50e5)
    }, priKey);

    let receipt = await web3.eth.sendSignedTransaction(hex.rawTransaction)
    writeData({
        "name": "Deploy",
        "mathod": "CloakService",
        "gasUsed": receipt.gasUsed,
        "size": Buffer.byteLength(hex.rawTransaction, 'utf8')
    })
    console.log("Cloak Service: ", receipt.contractAddress);
    return new web3.eth.Contract(obj.abi, receipt.contractAddress);
}

async function initializeService() {
    let service = await deploy();
    let result = await cloak.network.initializeService({
        service: service._address,
        state: await service.methods.stateFactory().call()
    })

    if (!result) {
        throw new Error('Could not initialize service');
    }
}

initializeService()