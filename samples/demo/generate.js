import fs from 'fs';

function write(data) {
    fs.writeFile('data/data.txt', `${JSON.stringify(data)}\n`, { 'flag': 'a' }, function (err) {
        if (err) { throw err; }
    })
}

export default {
    write
}