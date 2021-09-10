import {CloakProvider} from 'cloak-client';
import {Agent} from 'https';
import Web3 from 'web3';
import {readFileSync} from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import {exit} from 'process';

const p_exec = promisify(exec);

var args = process.argv.slice(2);
if (args.length != 3) {
    console.log("require <CCF_AUTH_DIR> <COMPILE_DIR> <PKI_ADDRESS> arguments")
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
const pki_address = args[2]
async function get_abi_and_bin(file, name) {
    const cmd = `solc --combined-json abi,bin --evm-version homestead --optimize ${file}`
    const {stdout,} = await p_exec(cmd)
    const j = JSON.parse(stdout)["contracts"][`${file}:${name}`]
    return [j["abi"], j["bin"]]
}

async function deployContract(web3, account, file, name, params) {
    const [abi, bin] = await get_abi_and_bin(file, name)
    var contract = new web3.eth.Contract(abi)
    const tx = contract.deploy({data: bin, arguments: params})
    const tx_options = {
        data: tx.encodeABI(),
        gas: 1900000,
        gasPrice: 0,
    }
    var signed = await web3.eth.accounts.signTransaction(tx_options, account.privateKey)
    return web3.eth.sendSignedTransaction(signed.rawTransaction)
}

async function get_pem_pk(account) {
    const cmd = `echo 302e0201010420 ${account.privateKey.substring(2,)} a00706052b8104000a | xxd -r -p | openssl ec -inform d -pubout`
    const {stdout,} = await p_exec(cmd)
    return stdout.toString()
}

// Before executing an MPT, if you are the owner of some state data (*e.g.*, _manager in Demo contract),
// you need to register your public key to the PKI contract,
// and the public key must be specified by a standard PEM format.
async function register_pki(web3, account) {
    const pki_file = compile_dir + "/CloakPKI.sol"
    const [abi, ] = await get_abi_and_bin(pki_file, "CloakPKI")
    var pki = new web3.eth.Contract(abi, pki_address)
    var tx = {
        to: pki_address,
        data: pki.methods.announcePk(await get_pem_pk(account)).encodeABI(),
        gas: 900000,
        gasPrice: 0,
    }
    var signed = await web3.eth.accounts.signTransaction(tx, account.privateKey)
    return web3.eth.sendSignedTransaction(signed.rawTransaction)
}

// Cloak-client wraps a Web3 Provider, so you can create a web3 object and create _manager account:
// `https://127.0.0.1:8000` is cloak-tee service host and port.
var web3 = new Web3()
web3.setProvider(new CloakProvider("https://127.0.0.1:8000", httpsAgent, web3))
const acc_1 = web3.eth.accounts.privateKeyToAccount("0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f689e");
var ganache_web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
await register_pki(ganache_web3, acc_1)

// files
const code_file = compile_dir + "/private_contract.sol"
const code_hash = web3.utils.sha3(readFileSync(code_file))
console.log(`code hash:${code_hash}`)
const policy_file = compile_dir + "/policy.json"
console.log(`policy hash:${web3.utils.sha3(readFileSync(policy_file))}`)
const public_contract_file = compile_dir + "/public_contract.sol"

// deploy public contract
var pub_deployed = await deployContract(ganache_web3, acc_1, public_contract_file, "Demo", [acc_1.address])
// deploy private contract
var pri_deployed = await deployContract(web3, acc_1, code_file, "Demo", [acc_1.address])

// send privacy policy
await web3.cloak.sendPrivacyTransaction({
    account: acc_1,
    params: {
        to: pri_deployed.contractAddress,
        codeHash: code_hash,
        verifierAddr: pub_deployed.contractAddress,
        data: web3.utils.toHex(readFileSync(policy_file))
    }
})

// deposit
var mpt_id = await web3.cloak.sendMultiPartyTransaction({
    account: acc_1,
    params: {
        nonce: web3.utils.toHex(100),
        to: pri_deployed.contractAddress,
        data: {
            "function": "deposit",
            "inputs": [
                {"name": "value", "value": "100"},
            ]
        }
    }
})

// get mpt
await new Promise(resolve => setTimeout(resolve, 3000));
web3.cloak.getMultiPartyTransaction({id: mpt_id}).then(console.log).catch(console.log)

// multi party transfer
const acc_2 = web3.eth.accounts.create();
await register_pki(ganache_web3, acc_2)

var mpt_id = await web3.cloak.sendMultiPartyTransaction({
    account: acc_1,
    params: {
        nonce: web3.utils.toHex(100),
        to: pri_deployed.contractAddress,
        data: {
            "function": "multiPartyTransfer",
            "inputs": [
                {"name": "value", "value": "10"},
            ]
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
            "inputs": [
                {"name": "to", "value": acc_2.address},
            ]
        }
    }
})

// get mpt
await new Promise(resolve => setTimeout(resolve, 3000));
web3.cloak.getMultiPartyTransaction({id: mpt_id}).then(console.log).catch(console.log)
