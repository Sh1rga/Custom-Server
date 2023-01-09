'use strict';

const express = require( 'express' );
const http = require( 'http' );
const socketIO = require( 'socket.io' );

const app = express();
const server = http.Server( app );
const io = socketIO( server );
app.set( 'views', __dirname + '/resources' );
app.set( 'view engine', 'ejs' );
const PORT = process.env.PORT || 6336;

var stopServerMessage = "";

io.on(
    'connection',
    ( socket ) =>
    {
        socket.emit( 'serverIsDown', stopServerMessage)
    } );
    
//Server setup
app.use( express.static( __dirname + '/public' ) );

app.use( function( req, res, next ){
  res.status( 404 );
  res.render( '404', { path: req.path } );
});

server.listen(PORT,() => {
    console.log( 'Server on port %d', PORT );
    console.log( '---Stop---' );
} );
