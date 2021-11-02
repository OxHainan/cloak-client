import {CloakProvider, Methods, KeyExchange} from 'cloak-client';
import {Agent} from 'https';
import Web3 from 'web3';
import {readFileSync} from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import {exit} from 'process';
const p_exec = promisify(exec);

var args = process.argv.slice(2);
if (args.length != 2) {
    console.log("require <CCF_AUTH_DIR> <COMPILE_DIR> arguments")
    exit(1)
}

// Because of encryption, cloak-tee can only accept https request, you need to provide the network.pem of Cloak Network as CA, and a trusted user(cert and pk), 
// `args[0]` is the directory of the three files.
// If you use cloak.py setup your cloak-tee, it will be workerspace/sanbox_common under cloak-tee build directory.
const httpsAgent = new Agent({
    rejectUnauthorized: false,
    ca: readFileSync(args[0]+"/networkcert.pem"),
    cert: readFileSync(args[0]+"/user0_cert.pem"),
    key: readFileSync(args[0]+"/user0_privk.pem"),
});

const compile_dir = args[1]
async function get_abi_and_bin(file, name) {
    const cmd = `solc --combined-json abi,bin --evm-version homestead --optimize ${file}`
    const {stdout,} = await p_exec(cmd)
    const j = JSON.parse(stdout)["contracts"][`${file}:${name}`]
    return j;
}

async function deployContract(web3, account, file, name, params) {
    const contract = await get_abi_and_bin(file, name)
    let addr = await Methods.deploy(web3, contract, params, account.privateKey);
    return addr;
}

async function get_contract_hangle(web3, addr, dir, name) {
    const file = compile_dir + "/" + dir + ".sol";
    const contract = await get_abi_and_bin(file, name)
    return new web3.eth.Contract(contract.abi, addr)
}

// Before executing an MPT, if you are the owner of some state data (*e.g.*, _manager in Demo contract),
// you need to register your public key to the PKI contract,
// and the public key must be specified by a standard PEM format.
async function register_pki(web3, cloakService, account) {
    try {
        let data = await Methods.register_pki(cloakService, account);
        let receipt = await Methods.send(web3, data, data._parent._address, account.privateKey);
    } catch (error) {
        return;
    }  
}

// Cloak-client wraps a Web3 Provider, so you can create a web3 object and create _manager account:
// `https://127.0.0.1:8000` is cloak-tee service host and port.
var web3 = new Web3()
web3.setProvider(new CloakProvider("https://127.0.0.1:8000", httpsAgent, web3))
const acc_1 = web3.eth.accounts.privateKeyToAccount("0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f689e");
var ganache_web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

let cloak_info = await web3.cloak.getCloakService()

// files
const code_file = compile_dir + "/private_contract.sol"
const code_hash = web3.utils.sha3(readFileSync(code_file))
console.log(`code hash:${code_hash}`)
const policy_file = compile_dir + "/policy.json"
console.log(`policy hash:${web3.utils.sha3(readFileSync(policy_file))}`)
const public_contract_file = compile_dir + "/public_contract.sol"

// deploy public contract
var pub_addr = await deployContract(ganache_web3, acc_1, public_contract_file, "Demo", [acc_1.address])
// deploy private contract
var pri_addr = await deployContract(web3, acc_1, code_file, "Demo", [acc_1.address])

let pubContract = await get_contract_hangle(ganache_web3, pub_addr, 'public_contract', 'Demo')
let cloakService = await get_contract_hangle(ganache_web3, cloak_info.cloak_service ,'CloakService', 'CloakService')
let instance = {
    pubContract,
    cloakService
}

await register_pki(ganache_web3, cloakService, acc_1)
// send privacy polickky
await web3.cloak.sendPrivacyTransaction({
    account: acc_1,
    params: {
        to: pri_addr,
        codeHash: code_hash,
        verifierAddr: pub_addr,
        data: web3.utils.toHex(readFileSync(policy_file))
    }
})

// deposit
var mpt_id = await web3.cloak.sendMultiPartyTransaction({
    account: acc_1,
    params: {
        nonce: web3.utils.toHex(100),
        to: pri_addr,
        data: {
            "function": "deposit",
            "inputs": {"value": "100"}
        }
    }
})

// get mpt
await new Promise(resolve => setTimeout(resolve, 3000));
web3.cloak.getMultiPartyTransaction({id: mpt_id}).then(console.log).catch(console.log)

// multi party transfer
const acc_2 = web3.eth.accounts.create();
await register_pki(ganache_web3, cloakService, acc_2)

var mpt_id = await web3.cloak.sendMultiPartyTransaction({
    account: acc_1,
    params: {
        nonce: web3.utils.toHex(100),
        to: pri_addr,
        data: {
            "function": "multiPartyTransfer",
            "inputs": {"value": "10"}
        }
    }
})

await web3.cloak.sendMultiPartyTransaction({
    account: acc_2,
    params: {
        nonce: web3.utils.toHex(100),
        to: mpt_id,
        data: {
            "function": "multiPartyTransfer",
            "inputs": {"to": acc_2.address}
        }
    }
})

// get mpt
await new Promise(resolve => setTimeout(resolve, 3000));
web3.cloak.getMultiPartyTransaction({id: mpt_id}).then(console.log).catch(console.log)

let pubBalance =await Methods.getPubBalance(instance.pubContract, acc_1.address)
console.log(pubBalance)
let priBalance =await Methods.getPriBalance(instance, acc_1.address)
console.log(priBalance)

let keyExchange = new KeyExchange(acc_1.privateKey, cloak_info.tee_public_key);
let decrypted = keyExchange.decrypt(priBalance)
console.log(decrypted)
