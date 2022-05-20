import common from './common.js';
var args = process.argv.slice(2);
if (args.length != 2) {
    console.log("require <CCF_AUTH_DIR> <COMPILE_DIR> arguments")
    exit(1)
}

const AUTH_DIR = args[0], COMPILE_DIR = args[1];

const [cloak_web3, eth_web3] = await common.register_service(AUTH_DIR)

const cloakService = await common.getCloakService(eth_web3, cloak_web3.cloakInfo.cloak_service, './CloakService.json');
const accounts = await common.generateAccounts(eth_web3, cloakService)
const [pub, pri] = await common.deployContract(cloak_web3, eth_web3, cloakService, accounts[0], COMPILE_DIR, 'Son', [accounts[0].address]);

await common.sendPrivacyTransaction(cloak_web3, accounts[0], pub._address, pri._address, COMPILE_DIR, 'Son');

const mpt_id = await common.sendMultiPartyTransaction(cloak_web3, accounts[0], pri._address, 100, {
    function: "getFi1",
    inputs: {
    }
})
await new Promise(resolve => setTimeout(resolve, 3000));

const mpt_id1 = await common.sendMultiPartyTransaction(cloak_web3, accounts[0], pri._address, 101, {
    function: "updatefather",
    inputs: {
        tmp: "6"
    },
})
await new Promise(resolve => setTimeout(resolve, 3000));

const mpt_id2 = await common.sendMultiPartyTransaction(cloak_web3, accounts[0], pri._address, 101, {
    function: "getFi5",
    inputs: {
    }
})
await new Promise(resolve => setTimeout(resolve, 3000));

const mpt_id3 = await common.sendMultiPartyTransaction(cloak_web3, accounts[0], pri._address, 101, {
    function: "callfather",
    inputs: {
        a: "7"
    }
})
await new Promise(resolve => setTimeout(resolve, 3000));

const mpt_id4 = await common.sendMultiPartyTransaction(cloak_web3, accounts[0], pri._address, 102, {
    function: "getFi5",
    inputs: {
    }
})
await new Promise(resolve => setTimeout(resolve, 3000));


const mpt_id5 = await common.sendMultiPartyTransaction(cloak_web3, accounts[0], pri._address, 103, {
    function: "deposit",
    inputs: {
        value: "100"
    }
})
await new Promise(resolve => setTimeout(resolve, 3000));

const mpt_id6 = await common.sendMultiPartyTransaction(cloak_web3, accounts[0], pri._address, 103, {
    function: "multiPartyTransfer",
    inputs: {
        value: "10"
    }
})

await common.sendMultiPartyTransaction(cloak_web3, accounts[1], mpt_id6, 103, {
    function: "multiPartyTransfer",
    inputs: {
        to: accounts[1].address
    }
})

