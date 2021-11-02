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

function getCloakService() {
    return {
        name: "getCloakService",
        call: "cloak_get_cloak_service",
        params: 0
    }
}

function loadCloakModule(web3) {
    web3.extend({
        property: "cloak",
        methods: [
            sendPrivacyTransaction(),
            sendMultiPartyTransaction(),
            getMultiPartyTransaction(),
            getCloakService(),
        ]
    })
}

exports.loadCloakModule = loadCloakModule
