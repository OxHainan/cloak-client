const cloak = require('../src');
const https = require('https');
const Web3 = require('web3');
const fs = require('fs');
var assert = require('assert');

const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    ca: fs.readFileSync(process.env.CCF_AUTH_DIR+"/networkcert.pem"),
    cert: fs.readFileSync(process.env.CCF_AUTH_DIR+"/user0_cert.pem"),
    key: fs.readFileSync(process.env.CCF_AUTH_DIR+"/user0_privk.pem"),
});

function deployGetSum() {
    var web3 = new Web3()
    web3.setProvider(new cloak.CloakProvider("https://127.0.0.1:8000", httpsAgent, web3))
    const account = web3.eth.accounts.create()
    var evm_test_json = JSON.parse(
        fs.readFileSync(process.env.EVM_TEST_DIR + "/EvmTest_combined.json"))
    abi = evm_test_json["contracts"]["EvmTest.sol:EvmTest"]["abi"]
    bin = evm_test_json["contracts"]["EvmTest.sol:EvmTest"]["bin"]
    var contract = new web3.eth.Contract(abi)
    return contract.deploy({data: bin}).send({from: account.address})
}

describe('demo', function() {
    it("is a stupid Demo", function(){
        assert.equal(1+1, 2)
    })
})

describe('eth', function () {
    describe('getBalance', function () {
        it('', async function () {
            var web3 = new Web3()
            web3.setProvider(new cloak.CloakProvider("https://127.0.0.1:8000", httpsAgent, web3))
            const account = web3.eth.accounts.create()
            var balance = await web3.eth.getBalance(account.address)
            assert.equal(balance, 0)
        });
    });

    describe('DeployContract', function(){
        it('', async function(){
            var deployed = await deployGetSum()
            var res = await deployed.methods.getSum(1, 22).call({from: deployed.options.address})
            assert.equal(res, 23)
        })
    })
});

describe('cloak', function(){
    describe('sendMpt', async function(){
        it('should be ok', async function() {
            var web3 = new Web3()
            web3.setProvider(new cloak.CloakProvider("https://127.0.0.1:8000", httpsAgent, web3))
            deployed = await deployGetSum()
            const account = web3.eth.accounts.create()

            await web3.cloak.sendPrivacyTransaction({
                account: account,
                params: {
                    from: account.address,
                    to: account.address,
                    codeHash: account.address,
                    verifierAddr: account.address,
                    data: JSON.parse(fs.readFileSync(process.env.EVM_TEST_DIR + "/EvmTestPolicy.json"))
                }
            })
            return web3.cloak.sendMultiPartyTransaction({
                account: account,
                params: {
                    nonce: web3.utils.toHex(0),
                    from: account.address,
                    to: account.address,
                    data: web3.toHex(fs.readFileSync(process.env.EVM_TEST_DIR + "/mptParams.json"))
                }
            })
        })
    })
})
