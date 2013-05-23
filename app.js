var http = require('http');
var path = require('path');
var express = require('express');
var app = module.exports = express();

app.configure(function() {
	app.set('port', process.env.PORT || 3000);

	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(path.join(__dirname, '/public')));
	app.use(express.cookieParser());
	app.use(app.router);
	app.use(express.errorHandler({
		dumpExceptions: true, showStack: true
	}));
});

var server = http.createServer(app).listen(app.get('port'), function() {
	console.log('Express server is listening on port: ' + app.get('port'));
});

var io = require('socket.io').listen(server);
// switch off detailed log for production
io.set('log level', 1);
io.sockets.on('connection', function(socket) {
	// for the simplicity use first 5 symbols of user as ID
	var ID = (socket.id).toString().substr(0, 5);
	var time = (new Date()).toLocaleTimeString();
	// send client message about successful connection
	socket.json.send({'event': 'userJoined', 'name': ID, 'time': time});
	// send the other users notification that new client connected
	socket.broadcast.json.send({'event': 'userJoined', 'name': ID, 'time': time});
	// add handler to incoming messages
	socket.on('message', function(msg) {
		var time = (new Date()).toLocaleTimeString();
		socket.json.send({'event': 'messageSent', 'name': ID, 'text': msg, 'time': time});
		socket.broadcast.json.send({'event': 'messageReceived', 'name': ID, 'text': msg, 'time': time});
	});
	socket.on('disconnect', function() {
		var time = (new Date()).toLocaleTimeString();
		io.sockets.json.send({'event': 'userSplit', 'name': ID, 'time': time});
	});
});