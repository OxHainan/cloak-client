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

function loadCloakModule(web3) {
    web3.extend({
        property: "cloak",
        methods: [
            loadSendPrivacyPolicy(),
            loadSendMpt(),
            loadSendSignedMpt(),
        ]
    })
}

exports.loadCloakModule = loadCloakModule
