function loadSendPrivacyPolicy() {
    return {
        name: "sendPrivacyPolicy",
        call: "cloak_sendPrivacyPolicy",
        params: 1,
    }
}

function loadSendMpt() {
    return {
        name: "sendMpt",
        call: "cloak_sendMultiPartyTransaction",
        params: 1,
    }
}

function loadSendSignedMpt() {
    return {
        name: "sendSignedMpt",
        call: "cloak_sendRawMultiPartyTransaction",
        params: 1,
    }
}

function sendRawPrivacyTransaction() {
    return {
        name: "sendRawPrivacyTransaction",
        call: "cloak_sendRawPrivacyTransaction",
        params: 1,
    }
}

function sendRawMultiPartyTransaction() {
    return {
        name: "sendRawMultiPartyTransaction",
        call: "cloak_sendRawMultiPartyTransaction",
        params: 1,
    }
}
function loadCloakModule(web3) {
    web3.extend({
        property: "cloak",
        methods: [
            loadSendPrivacyPolicy(),
            loadSendMpt(),
            loadSendSignedMpt(),
            sendRawPrivacyTransaction(),
            sendRawMultiPartyTransaction()
        ]
    })
}

exports.loadCloakModule = loadCloakModule
