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

    deploy: async function(web3, contract, params, privateKey) {
        return new Promise(async function(resolve) {
            let it = new web3.eth.Contract(contract.abi);
            let data = await it.deploy({
                data: contract.bin,
                arguments: params
            });

            let tx = await methods.send(web3, data, null, privateKey);
            resolve(tx.contractAddress);
        });
    },

    send: async function(web3, data, to, privateKey) {
        try {
            let params = {
                data: data.encodeABI(),
                to: to,
                // value: 0,
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