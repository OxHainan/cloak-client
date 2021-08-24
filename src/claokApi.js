function sendPrivacyTransaction() {
    return {
        name: "sendPrivacyTransaction",
        call: "cloak_sendRawPrivacyTransaction",
        params: 1,
    }
}

function sendMultiPartyTransaction() {
    return {
        name: "sendMultiPartyTransaction",
        call: "cloak_sendRawMultiPartyTransaction",
        params: 1,
    }
}

function getMultiPartyTransaction() {
    return {
        name: "getMultiPartyTransaction",
        call: "cloak_get_mpt",
        params: 1,
    }
}

function loadCloakModule(web3) {
    web3.extend({
        property: "cloak",
        methods: [
            sendPrivacyTransaction(),
            sendMultiPartyTransaction(),
            getMultiPartyTransaction(),
        ]
    })
}

exports.loadCloakModule = loadCloakModule
