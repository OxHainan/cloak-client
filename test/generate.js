var fs = require("fs");

exports.writeData = function (data) {
    fs.writeFile('data/data.txt', `${JSON.stringify(data)}\n`, { 'flag': 'a' }, function (err) {
        if (err) throw err;
    });
}