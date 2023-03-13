'use strict';
var flag_enable = false;

const express = require( 'express' );
const http = require( 'http' );
const socketIO = require( 'socket.io' );
const fs = require( 'fs-extra' );
const cron = require('node-cron');
const cryptico = require('cryptico');
require('date-utils');

const app = express();
const server = http.Server( app );
const io = socketIO( server );
app.set( 'views', __dirname + '/resources' );
app.set( 'view engine', 'ejs' );
const PORT = process.env.PORT || 6336;

var version = 0;
var counter = 0;
var time = "null";
var dataUser = "./database/user/";
var dataRoom = "./database/room/";
var dataFlag = "./database/flag/";
var dataBanned = "./public/banned/";
var dataStatus = "./public/status.json";
var len = 6;
var str = "0123456789";
var strLen = str.length;
var server_encrypt = "";
var server_decrypt = "";

var enc_bits = 3072;
var enc_seed = new Uint32Array(1);

io.on(
    'connection',
    ( socket ) =>
    {
        console.log('connection count:',socket.client.conn.server.clientsCount);

        socket.on(
            'start', //Start
            ( strMessage ) =>
            {
                //Counter
                counter += 1;
                
                try {
                
                var crypt = strMessage;
                socket.emit( 'start' )
                
                //Get Time
                var wt = new Date();
                var time = wt.toFormat("HH24MISS");
                var htime = wt.toFormat("HH24");

                //Create roomID and userID
                var roomIDdetect = true;
                while( roomIDdetect == true ) {
                    var g_result = "";
                    var roomID = "";
                    for (var i = 0; i < len; i++) {
                    g_result += str[Math.floor(Math.random() * strLen)];
                    }
                    if( fs.existsSync( dataRoom + htime + '/' + roomID + '.json' ) ){
                        roomIDdetect = true;
                    }else{
                        roomIDdetect = false;
                    }
                }    
                
                var userIDdetect = true;
                while( userIDdetect == true ) {
                    var j_result = "";
                    var userID
                    for (var i = 0; i < len; i++) {
                    j_result += str[Math.floor(Math.random() * strLen)];
                    }
                    if( fs.existsSync( dataUser + htime + '/' + userID + '.json' ) ){
                        userIDdetect = true;
                    }else{
                        userIDdetect = false;
                    }
                }    
                
                roomID = time + g_result;
                userID = time + j_result;
                
                //Create room json file
                const room = {
                    join: false,
                    first_encrypt: crypt,
                    first: "",
                    second_encrypt: "",
                    second: "",
                    flag: false
                }
                const roomJson = JSON.stringify(room)
                fs.writeFileSync(dataRoom + htime + '/' + roomID + '.json', roomJson)
                
                //Create user json file
                const user = {
                    id: roomID,
                    first: true
                }
                const userJson = JSON.stringify(user)
                fs.writeFileSync(dataUser + htime + '/' + userID + '.json', userJson)
                
                //Send to client
                var msgcrypt = cryptico.encrypt(roomID, crypt);
                socket.emit( 'get-roomid', msgcrypt.cipher)
                var msgcrypt2 = cryptico.encrypt(userID, crypt);
                socket.emit( 'get-userid', msgcrypt2.cipher)
                } catch {
                    socket.emit( 'start-error' )
                }
                
            } );
            
            socket.on(
            'join',
            ( strMessage ) =>
            {   
                try {
                strMessage = cryptico.decrypt(strMessage, server_decrypt).plaintext;

                var findroom = false;
                try {
                var rtime = strMessage.substr( 0, 2 );
                var roomID = strMessage.substr( 0, 12 );
                var crypt = strMessage.substr( 12 );
                
                //Read room json
                try {
                    var rjson = JSON.parse(fs.readFileSync(dataRoom + rtime + '/' + roomID + '.json', 'utf8'));
                    findroom = true;
                } catch {
                    socket.emit( 'join-notfound' )
                    findroom = false;
                }
                var joined = rjson.join;
                var first_crypt = rjson.first_encrypt;
                
                //Get Time
                var wt = new Date();
                var time = wt.toFormat("HH24MISS");
                var htime = wt.toFormat("HH24");
                
                //Create userID
                var userIDdetect = true;
                while( userIDdetect == true ) {
                    var j_result = "";
                    for (var i = 0; i < len; i++) {
                    j_result += str[Math.floor(Math.random() * strLen)];
                    }
                    if( fs.existsSync( dataUser + htime + '/' + userID + '.json' ) ){
                        userIDdetect = true;
                    }else{
                        userIDdetect = false;
                    }
                }
                
                var userID = time + j_result;
                
                //Check if the user is available to participate
                if (joined == false){
                    //Rewrite room json
                    rjson.join = true;
                    rjson.second_encrypt = crypt;
                    const roomJson = JSON.stringify(rjson)
                    fs.writeFileSync(dataRoom + rtime + '/' + roomID + '.json', roomJson)
                    
                    //Create user json file
                    const user = {
                        id: roomID,
                        first: false
                    }
                    const userJson = JSON.stringify(user)
                    fs.writeFileSync(dataUser + htime + '/' + userID + '.json', userJson)
                    
                    //Send to client
                    var msgcrypt = cryptico.encrypt(userID, crypt);
                    socket.emit( 'get-userid', msgcrypt.cipher)
                    socket.emit( 'join', first_crypt )
                }else{
                    socket.emit( 'joined' )
                }
                
                } catch {
                    if (findroom == true) {
                        socket.emit( 'join-error' )
                    }
                }
                } catch { socket.emit( 'join-error' ) }
                
            } );
            
            socket.on(
            'load',
            ( strMessage ) =>
            {
                try {
                strMessage = cryptico.decrypt(strMessage, server_decrypt).plaintext;
                try {
                    var ujson = "";
                    var utime = strMessage.substr( 0, 2 );
                    var roomID = 0;
                    var rtime = 0;
                    var rjson = "";
                    var fUser = false;
                    var flag = false;
                    
                    //Get json file
                    try {
                    ujson = JSON.parse(fs.readFileSync(dataUser + utime + '/' + strMessage + '.json', 'utf8'));
                    roomID = ujson.id;
                    rtime = roomID.substr( 0, 2 );
                    fUser = ujson.first;
                    rjson = JSON.parse(fs.readFileSync(dataRoom + rtime + '/' + roomID +'.json', 'utf8'));
                    flag = rjson.flag;
                    } catch {
                        socket.emit( 'roomNotFound' )
                    }
                    
                    //Send a message
                    if (flag == false) {
                    if (fUser == false) {
                        socket.emit( 'load', rjson.first )
                    }else{
                        socket.emit( 'load', rjson.second )
                    }
                    }else{
                        socket.emit( 'roomFlagged' )
                    }
                        
                } catch {
                    socket.emit( 'load-error' )
                }
                
                } catch { socket.emit( 'load-error' ) }
            } );
            
            socket.on(
            'first-load', //This is a program for the person who started the room to check if there are any participants in the room
            ( strMessage ) =>
            {
                try {
                strMessage = cryptico.decrypt(strMessage, server_decrypt).plaintext;
                var utime = strMessage.substr( 0, 2 );
                var userID = strMessage.substr( 0, 12 );
                //Get json file
                var ujson = JSON.parse(fs.readFileSync(dataUser + utime + '/' + userID + '.json', 'utf8'));
                var roomID = ujson.id;
                var rtime = roomID.substr( 0, 2 );
                var rjson = JSON.parse(fs.readFileSync(dataRoom + rtime + '/' + roomID + '.json', 'utf8'));
                var joined = rjson.join;
                var crypt = rjson.second_encrypt;
                
                //Send to client
                if (joined == true){
                    socket.emit( 'first-load', "1" + crypt)
                }else{
                    socket.emit( 'first-load', "0")
                }
                
                } catch { }
            } );
            
            socket.on(
            'send',
            ( strMessage ) =>
            {
                try {
                strMessage = cryptico.decrypt(strMessage, server_decrypt).plaintext;
                try {
                var utime = strMessage.substr( 0, 2 );
                var userID = strMessage.substr( 0, 12 );
                var getMessage = strMessage.substr( 12 );
                //Get json file
                var ujson = JSON.parse(fs.readFileSync(dataUser + utime + '/' + userID + '.json', 'utf8'));
                var fUser = ujson.first;
                var roomID = ujson.id;
                var rtime = roomID.substr( 0, 2 );
                var rjson = JSON.parse(fs.readFileSync(dataRoom + rtime + '/' + roomID + '.json', 'utf8'));
                
                //Writing messages
                if (fUser == true) {
                    rjson.first = getMessage;
                }else{
                    rjson.second = getMessage;
                }
                const roomJson = JSON.stringify(rjson)
                fs.writeFileSync(dataRoom + rtime + '/' + roomID + '.json', roomJson)
                
                //Send to client
                socket.emit( 'send-success' )
                } catch {
                    socket.emit( 'send-error' )
                }
                } catch { socket.emit( 'send-error' ) }
                
            } );
            
            socket.on(
            'delete',
            ( strMessage ) =>
            {
                try {
                strMessage = cryptico.decrypt(strMessage, server_decrypt).plaintext;
                try {
                    //Checking Files
                    var utime = strMessage.substr( 0, 2 );
                    var ujson = JSON.parse(fs.readFileSync(dataUser + utime + '/' + strMessage + '.json', 'utf8'));
                    var roomID = ujson.id;
                    var rtime = ujson.id.substr( 0, 2 );
                    var rfr = dataRoom + rtime + '/' + roomID + '.json';
                    var rfu = dataUser + utime + '/' + strMessage + '.json';
                    
                    //Delete Files
                    fs.rmSync(rfr, { recursive: true, force: true });
                    fs.rmSync(rfu, { recursive: true, force: true });
                    
                    //Send to client
                    socket.emit( 'delete-success' )
                } catch {
                    socket.emit( 'delete-error' )
                }
                
                } catch { socket.emit( 'delete-error' ) }
            } );
            
            socket.on(
            'flag',
            ( strMessage ) =>
            {
                socket.emit( 'flag-error' )
            } );
                socket.emit( 'flag-enable', false )
                
            socket.on(
            'banCheck',
            ( strMessage ) =>
            {
                try {
                var bannedjson = JSON.parse(fs.readFileSync(dataBanned + strMessage + ".json", 'utf8'));
                var isBanned = bannedjson.banned;
                socket.emit( 'banCheck', isBanned )
                }catch{
                    socket.emit( 'banCheck', false )
                }
            } );
            
            socket.on(
            'version',
            ( strMessage ) =>
            {
                    socket.emit( 'version', version ) 
            } );
            
            
            socket.on(
            'cryptload',
            ( strMessage ) =>
            {
                    socket.emit( 'cryptload', server_encrypt )
            } );
            
    } );
    
//Delete files in 12-hour cycles
cron.schedule('0 0 0 * * *',  () => { time = "12"; deleteData(); newCrypt(); });
cron.schedule('0 0 1 * * *',  () => { time = "13"; deleteData(); });
cron.schedule('0 0 2 * * *',  () => { time = "14"; deleteData(); });
cron.schedule('0 0 3 * * *',  () => { time = "15"; deleteData(); });
cron.schedule('0 0 4 * * *',  () => { time = "16"; deleteData(); });
cron.schedule('0 0 5 * * *',  () => { time = "17"; deleteData(); });
cron.schedule('0 0 6 * * *',  () => { time = "18"; deleteData(); });
cron.schedule('0 0 7 * * *',  () => { time = "19"; deleteData(); });
cron.schedule('0 0 8 * * *',  () => { time = "20"; deleteData(); });
cron.schedule('0 0 9 * * *',  () => { time = "21"; deleteData(); });
cron.schedule('0 0 10 * * *', () => { time = "22"; deleteData(); });
cron.schedule('0 0 11 * * *', () => { time = "23"; deleteData(); });
cron.schedule('0 0 12 * * *', () => { time = "00"; deleteData(); newCrypt(); });
cron.schedule('0 0 13 * * *', () => { time = "01"; deleteData(); });
cron.schedule('0 0 14 * * *', () => { time = "02"; deleteData(); });
cron.schedule('0 0 15 * * *', () => { time = "03"; deleteData(); });
cron.schedule('0 0 16 * * *', () => { time = "04"; deleteData(); });
cron.schedule('0 0 17 * * *', () => { time = "05"; deleteData(); });
cron.schedule('0 0 18 * * *', () => { time = "06"; deleteData(); });
cron.schedule('0 0 19 * * *', () => { time = "07"; deleteData(); });
cron.schedule('0 0 20 * * *', () => { time = "08"; deleteData(); });
cron.schedule('0 0 21 * * *', () => { time = "09"; deleteData(); });
cron.schedule('0 0 22 * * *', () => { time = "10"; deleteData(); });
cron.schedule('0 0 23 * * *', () => { time = "11"; deleteData(); });

function verCheck() {
var verjson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
version = verjson.version;
io.sockets.emit("version", version ) 
}

function newCrypt() {
try {
console.log( 'Generating server private key. (It may take some time)' );
enc_seed = new Uint32Array(1);
crypto.getRandomValues(enc_seed);

var cryptjson = JSON.parse(fs.readFileSync('./database/server.json', 'utf8'));

var private_key = cryptico.generateRSAKey(String(enc_seed[0]), enc_bits);
var public_key = cryptico.publicKeyString(private_key);
server_decrypt = private_key;
server_encrypt = public_key;

cryptjson.private = server_decrypt
cryptjson.public = server_encrypt

const newJson = JSON.stringify(cryptjson)
fs.writeFileSync('./database/server.json', newJson)
io.sockets.emit("cryptload", public_key)
console.log( 'Server Public Key: ' + public_key );
} catch { newCrypt(); }
}

function deleteData() {
    //Counter
    console.log( 'Counter: ' + counter );
    try {
        //Delete Files
        var rf = dataRoom + time;
        fs.rmSync(rf, { recursive: true, force: true });
        fs.mkdir(rf);
        rf = dataUser + time;
        fs.rmSync(rf, { recursive: true, force: true });
        fs.mkdir(rf);
        rf = dataFlag + time;
        fs.rmSync(rf, { recursive: true, force: true });
        fs.mkdir(rf);
        //Log
        console.log("Delete " + time);
    } catch {
        console.log("Delete err " + time);
    }
}

//Server setup
app.use( express.static( __dirname + '/public' ) );

app.use( function( req, res, next ){
  res.status( 404 );
  res.render( '404', { path: req.path } );
  res.header('Access-Control-Allow-Origin', '*');
});

server.listen(PORT,() => {
    verCheck();
    newCrypt();
    console.log( 'Server on port %d', PORT );
    console.log( ' Version: ' + version );
    console.log( ' This software is licensed under the terms of the Mozilla Public License 2.0.' );
    const status = {
        online: true,
        ver: version
    }
    const statusJson = JSON.stringify(status)
    fs.writeFileSync(dataStatus, statusJson)
} );

process.on("exit", exitCode => {
   const status = {
        online: false,
        ver: version
    }
    const statusJson = JSON.stringify(status)
    fs.writeFileSync(dataStatus, statusJson)
    console.log( 'Server has been shut down.');
});
process.on("SIGINT", ()=>process.exit(0));