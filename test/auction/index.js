

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
// let logic_path = './../contracts/Logic1.json'
let logic_path = './../contracts/AuctionEngine.json'
let erc20_path = './../contracts/MZToken.json'
var erc20_onchain = ''
var erc20_offchain = ''
let nft_path = './../contracts/BookToken.json'
var nft_onchain = ''
var nft_offchain = ''
var ServicePath = './../contracts/Service.json';
var userKey = '0x55b99466a43e0ccb52a11a42a3b4e10bfba630e8427570035f6db7b5c22f681e';
let user = web3.eth.accounts.privateKeyToAccount(userKey);
// 发送交易
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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

async function deploy(instance, method, path, params) {
    let obj = JSON.parse(readFileSync(path));
    let it = new instance.eth.Contract(obj.abi);
    let data = await it.deploy({
        data: obj.bytecode,
        arguments: params
    });
    let nonce = await instance.eth.getTransactionCount(user.address)
    let addr = await send(instance, null, data, nonce, userKey, method);
    return new instance.eth.Contract(obj.abi, addr);
}

async function deploy_cloak(instance, method, path, nonce, params) {
    let obj = JSON.parse(readFileSync(path));
    let it = new instance.eth.Contract(obj.abi);
    let data = await it.deploy({
        data: obj.bytecode,
        arguments: params
    });
    // let nonce =  await instance.eth.getTransactionCount(user.address)
    let addr = await send(instance, null, data, nonce, userKey, method);
    return new instance.eth.Contract(obj.abi, addr);
}

async function deploy_proxy() {
    let logic = await deploy(web3, "logic", logic_path);
    let proxy = await deploy(web3, "proxy", ProxyPath, [logic._address, user.address])
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
    nonce += 1
    await send(web3, service._address, service.methods.escrow(proxy._address, logic), nonce, userKey);
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
    let accounts = new Array(200);
    for (let i = 0; i < accounts.length; i++) {
        accounts[i] = web3.eth.accounts.privateKeyToAccount(web3.utils.keccak256("accounts" + i.toString()))
    }

    return accounts;
}

delay().then(async () => {
    if (proxy_addr !== undefined) {
        return get_contract_handle(cloak, logic_path, proxy_addr)
    }
    let proxy = await escrow();
    return get_contract_handle(cloak, logic_path, proxy._address);
}).then(async (it) => {
    let logic = await get_logic(it._address)
    // let accounts = create_account()
    erc20_onchain = await deploy(web3, "erc20", erc20_path);
    nft_onchain = await deploy(web3, "nft", nft_path);
    console.log("user: ", user.address)
    console.log(nft_onchain._address)
    let nonce = await cloak.eth.getTransactionCount(user.address)
    erc20_offchain = await deploy_cloak(cloak, "erc20", erc20_path, nonce);
    nft_offchain = await deploy_cloak(cloak, "nft", nft_path, nonce + 1);
    nonce = await cloak.eth.getTransactionCount(user.address)
    let data = nft_offchain.methods.approve(it._address, 0);
    await sendSignedTransaction(nft_offchain, userKey, data, nonce)
    await delay(1000);

    // test createAuction
    // let web3Tx = new Array(baseline);
    // nonce = await cloak.eth.getTransactionCount(user.address)
    // let owenr = await nft_offchain.methods.ownerOf(0).call();
    // let getApproved = await nft_offchain.methods.getApproved(0).call();
    // console.log(owenr)
    // console.log(getApproved, "to ", it._address)
    // for (let i = 0; i < baseline; i++) {
    //     data = it.methods.createAuction(nft_offchain._address, i, erc20_offchain._address, 0, 0, 1);
    //     await sendSignedTransaction(it, userKey, data, nonce)
    //     web3Tx[i] = data;
    // }

    // await delay(10000)
    // for (let i = 0; i < web3Tx.length; i++) {
    //     data = nft_onchain.methods.approve(logic._address, 0);
    //     await sendToWeb3(nft_onchain._address, data, userKey);
    //     data = it.methods.createAuction(nft_onchain._address, 0, erc20_onchain._address, 0, 0, 1);
    //     await sendToWeb3(logic._address, data, userKey)
    // }

    // test bid
    data = it.methods.createAuction(nft_offchain._address, 0, erc20_offchain._address, 0, 0, 1);
    sendSignedTransaction(it, userKey, data, nonce + 1)
    await delay(1000);
    data = it.methods.createAuction(nft_onchain._address, 0, erc20_onchain._address, 0, 0, 1);
    // await sendToWeb3(logic._address, data, userKey)
    // await delay(1000);
    data = erc20_offchain.methods.approve(it._address, 501000);
    sendSignedTransaction(erc20_offchain, userKey, data, nonce + 2)
    await delay(1000);
    nonce = await cloak.eth.getTransactionCount(user.address)
    for (let i = 0; i < baseline; i++) {
        data = it.methods.bid(0, i);
        sendSignedTransaction(it, userKey, data, nonce + i)
    }
    // await delay(10000)
    // data = erc20_onchain.methods.approve(logic._address, 501000);
    // sendToWeb3(erc20_onchain._address, data, userKey)
    // await delay(1000);
    // for (let i = 0; i < baseline; i++) {
    //     data = it.methods.bid(0, i);
    //     await sendToWeb3(logic._address, data, userKey)
    // }
})


// async function auction() {
//     // allow engine to transfer the book
//     await book.approve(engine.address, 0, {from: accounts[1]});

//     // create auction
//     await engine.createAuction(book.address, 0, token.address, 0, 0, 1, {from: accounts[1]});  // 1 second auction

//     // before bidding we need to allow the engine to transfer the tokens
//     await token.approve(engine.address, 1000, {from: accounts[0]});

//     // place the bid
//     await engine.bid(0, 1000, {from: accounts[0]});

//     //await sleep(1000)  // sleep 1 second until auction is finished
//     // close auction
//     await engine.closeAuction(0, {from: accounts[1]});

//     let isFinished = await engine.isFinished(0);
//     assert.equal(isFinished, true);

//     let winner = await engine.getWinner(0);
//     assert.equal(winner, accounts[0]);

//     // precondition: before claiming, accounts[0] has no assets
//     // all books belong to accounts[1]
//     let assetCountAccount0 = await book.balanceOf(accounts[0]);
//     assert.equal(assetCountAccount0.toNumber(), 0);
//     let assetCountAccount1 = await book.balanceOf(accounts[1]);
//     assert.equal(assetCountAccount1.toNumber(), 3);

//     // auction winner claims the asset
//     await engine.claimAsset(0, {from: accounts[0]});

//     // poscondition: book that participated in the auction must
//     // be transfered to the auction winner
//     assetCountAccount0 = await book.balanceOf(accounts[0]);
//     assert.equal(assetCountAccount0.toNumber(), 1);
//     assetCountAccount1 = await book.balanceOf(accounts[1]);
//     assert.equal(assetCountAccount1.toNumber(), 2);

//     let bookOwner = await book.ownerOf(0);
//     assert.equal(bookOwner, accounts[0]);

//     // balances preconditions
//     let initialBalance = 1000 * (10**6);
//     let bidAmount = 1000
//     let tokenBalanceAccount0 = await token.balanceOf(accounts[0]);
//     assert.equal(tokenBalanceAccount0.toNumber(), initialBalance - bidAmount);
//     let tokenBalanceEngine = await token.balanceOf(engine.address);
//     assert.equal(tokenBalanceEngine.toNumber(), bidAmount);
//     let tokenBalanceAccount1 = await token.balanceOf(accounts[1]);
//     assert.equal(tokenBalanceAccount1.toNumber(), 0);

//     // auction creator claims the tokens
//     await engine.claimTokens(0, {from: accounts[1]});

//     // balances posconditions
//     tokenBalanceAccount0 = await token.balanceOf(accounts[0]);
//     assert.equal(tokenBalanceAccount0.toNumber(), initialBalance - bidAmount);
//     tokenBalanceEngine = await token.balanceOf(engine.address);
//     assert.equal(tokenBalanceEngine.toNumber(), 0);
//     tokenBalanceAccount1 = await token.balanceOf(accounts[1]);
//     assert.equal(tokenBalanceAccount1.toNumber(), bidAmount);
// }