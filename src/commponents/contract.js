const utils = require('web3-utils');
const publicKey = require('./publickey')
const methods = {
    getPubBalance: async function(instance, addr) {
        return new Promise(async function(resolve) {
            let res = await instance.methods.pubBalances(addr).call()
            resolve(res)
        });
    },

    getPks: async function(cloakService, addr) {
        return new Promise(async function(resolve) {
            let res = await cloakService.methods.pks(addr).call()
            resolve(res)
        });
    },

    getPriBalance: async function(instance, addr, privateKey) {
        return new Promise(async function(resolve) {
            let res = new Array(3);
            for (let i = 0; i<res.length; i++) {
                res[i] = await instance.pubContract.methods.priBalances(addr, i).call()
            }
            resolve(res)
        });
    },

    isRegisterPki: async function (cloakService, addr) {
        return new Promise(async function(resolve) {
            let res = await cloakService.methods.pks(addr).call()
            resolve(res == null)
        });
    },

    getAvailableBalance: async function (cloakService, addr) {
        return new Promise(async function (resolve) {
            let res = await cloakService.methods.available(addr).call()
            resolve(res)
        })
    },

    register_pki: async function(cloakService, acc) {
        return new Promise(async function(resolve) {
            let pubKey = publicKey.Create(acc.privateKey);
            let data = await cloakService.methods.announcePk(pubKey);
            resolve(data)
        });
    },

    sendTransaction: async function(web3, params, privateKey) {
            let hex = await web3.eth.accounts.signTransaction(params, privateKey);
            let receipt = await web3.eth.sendSignedTransaction(hex.rawTransaction);
            return receipt;
    },

    cloakDeploy: async function (web3, contract, params, privateKey) {
        return new Promise(async function (resolve) {
            let it = new web3.eth.Contract(contract.abi);
            let data = await it.deploy({
                data: contract.bin,
                arguments: params
            });
            
            let tx = await methods.send(web3, data, null, privateKey);
            resolve(tx.contractAddress);
        });
    },

    deploy: async function(web3, cloakService, contract, params, account) {
        return new Promise(async function(resolve) {
            let it = new web3.eth.Contract(contract.abi);
            let data = await it.deploy({
                data: contract.bin,
                arguments: params
            });

            const [isDeployed, addr] = await methods.isDeployed(web3, cloakService._address, account.address, data.encodeABI());
            if (isDeployed) {
                resolve(addr);
                return;
            }

            let obj = await cloakService.methods.deploy(data.encodeABI());
            let tx = await methods.send(web3, obj, cloakService._address, account.privateKey);
            let receipt = await web3.eth.getTransactionReceipt(tx.hash);
            let newAddr = receipt.logs[0].topics[1].substring(26);
            resolve(web3.utils.toChecksumAddress(newAddr))
        });
    },

    computeAddress: function (deployer, sender, bytecode) {
        const salt = utils.keccak256(utils.encodePacked(deployer, sender));
        const data = utils.encodePacked("0xff", deployer, salt, utils.keccak256(bytecode));
        return utils.toChecksumAddress(utils.keccak256(data).substring(26));
    },

    isDeployed: async function (web3, cloakServiceAddr, sender, bytecode) {
        const addr = methods.computeAddress(cloakServiceAddr, sender, bytecode);
        const res = await web3.eth.getCode(addr);
        return [res !== '0x', addr];
    },

    send: async function(web3, data, to, privateKey, value = 0) {
        try {
            let params = {
                data: data == null ? null : data.encodeABI(),
                to: to,
                value: value,
                gasPrice: utils.toHex(0),
                gasLimit: utils.toHex(40e5)
            }

            let receipt = await methods.sendTransaction(web3, params, privateKey)
            if (to == null) 
                return receipt

            let txMsg = await web3.eth.getTransaction(receipt.transactionHash);
            return txMsg;
        } catch (error) {
            throw error.message
        }
    },

}

module.exports = methods;