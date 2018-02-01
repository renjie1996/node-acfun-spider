const { spawn } = require('child_process');

function runCommand(cmd, args) {
  return new Promise((rsv, rjt) => {
    const child = spawn( cmd, args );
    let response = '';
    child.stdout.on('data', buffer => { response += buffer.toString() });
    child.stdout.on('end', () => { rsv( response ) });
    child.stdout.on('error', e => { rjt(e) });
  })
};

function logMessage(res, other) {
  return new Promise((rsv, rjt) => {
    console.log(other);
    console.log(res);
    rsv()
  });
}

module.exports = {
  runCommand,
  logMessage,
}