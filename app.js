var util = require('util');

var http = require('http');
var path = require('path');
var express = require('express');
var app = module.exports = express();
var engine = require('ejs-locals');
var cookie = require('express/node_modules/cookie');
var MemoryStore = express.session.MemoryStore;
var sessionStore = new MemoryStore();
// good source http://kenny.deeprosoft.com/socket-io-%D0%B8-express-%D1%81%D0%B2%D1%8F%D0%B7%D1%8B%D0%B2%D0%B0%D0%B5%D0%BC-%D0%B2%D1%81%D0%B5-%D0%B2%D0%BC%D0%B5%D1%81%D1%82%D0%B5/

app.configure(function() {
	app.engine('ejs', engine);

	app.set('port', process.env.PORT || 3000);
	app.set('views', path.join(__dirname, '/views'));
	app.set('view engine', 'ejs');

	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(path.join(__dirname, '/public')));
	app.use(express.cookieParser());
	app.use(express.session({secret: "qwerty1234567890", key: 'express.sid', store: sessionStore}));
	app.use(app.router);
	app.use(express.errorHandler({
		dumpExceptions: true, showStack: true
	}));
});

function auth (req, res, next) {
	if (!req.session.username)
		res.redirect('/login');
	
	next();
}

app.get('/', auth, function (req, res) {
	console.log(req.session.username);
	res.render('chat', { title: 'Chat' });
});

app.get('/chat', auth, function (req, res) {
	res.render('chat', { title: 'Chat' });
});

app.get('/login', function (req, res) {
	res.render('login', { title: 'Create User' });
});

app.post('/login', function (req, res) {
	req.session.username = req.body.username;
	res.redirect('/chat');
});

var server = http.createServer(app).listen(app.get('port'), function() {
	console.log('Express server is listening on port: ' + app.get('port'));
});

var io = require('socket.io').listen(server);
// switch off detailed log for production
io.set('log level', 1);
// enable to get session from express
io.set('authorization', function (data, accept) {
	if (data.headers.cookie) {
		data.cookie = cookie.parse(data.headers.cookie);
		data.sessionID = data.cookie['express.sid'];
		sessionStore.get(data.sessionID, function (err, session) {
			if (err || !session) {
				accept('Error', false);
			} else {
				data.session = session;
				accept(null, true);
			}
		});
	} else {
		return accept('No cookie transmitted.', false);
	}
});
io.sockets.on('connection', function(socket) {
	// for the simplicity use first 5 symbols of user as ID
	console.log(socket.id + ' connected');	
	
	var ID = (socket.id).toString().substr(0, 5);
	var time = (new Date()).toLocaleTimeString();
	// send client message about successful connection
	socket.json.send({'event': 'userJoined', 'name': ID, 'time': time});
	// send the other users notification that new client connected
	socket.broadcast.json.send({'event': 'userJoined', 'name': ID, 'time': time});
	// add handler to incoming messages
	socket.on('message', function(msg) {
		console.log(socket.id + ' sent message');
		console.log('Session ID: ' + socket.handshake.sessionID);
	
		var time = (new Date()).toLocaleTimeString();
		socket.json.send({'event': 'messageSent', 'name': ID, 'text': msg, 'time': time});
		socket.broadcast.json.send({'event': 'messageReceived', 'name': ID, 'text': msg, 'time': time});
	});
	socket.on('disconnect', function() {
		var time = (new Date()).toLocaleTimeString();
		io.sockets.json.send({'event': 'userSplit', 'name': ID, 'time': time});
	});
});