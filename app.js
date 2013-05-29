var util = require('util');

var http = require('http');
var path = require('path');
var express = require('express');
var app = module.exports = express();
var engine = require('ejs-locals');
var cookie = require('cookie');
// good source http://kenny.deeprosoft.com/socket-io-%D0%B8-express-%D1%81%D0%B2%D1%8F%D0%B7%D1%8B%D0%B2%D0%B0%D0%B5%D0%BC-%D0%B2%D1%81%D0%B5-%D0%B2%D0%BC%D0%B5%D1%81%D1%82%D0%B5/
// github source https://github.com/DanielBaulig/sioe-demo/blob/master/app.js
var connect = require('express/node_modules/connect');
var MemoryStore = express.session.MemoryStore;
var store = new MemoryStore();

app.configure(function() {
	app.engine('ejs', engine);

	app.set('port', process.env.PORT || 3000);
	app.set('views', path.join(__dirname, '/views'));
	app.set('view engine', 'ejs');

	app.sessionStore = store;
	app.use(function (req, res, next) {
		res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
		res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
		res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With, Cookie, Set-Cookie');
		
		if ('OPTIONS' == req.method)
			return res.send(200);
		else	
			next();
	});
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.static(path.join(__dirname, '/public')));
	app.use(express.cookieParser());
	app.use(express.session({
		store: app.sessionStore, 
		secret: 'secret', 
		key: 'express.sid',
		cookie: {
			path: '/',
			httpOnly: true,
			maxAge: null
		}
	}));
	app.use(app.router);
	app.use(express.errorHandler({
		dumpExceptions: true, showStack: true
	}));
});

function auth (req, res, next) {
	if (!req.session.username) {
		res.redirect('/login');
	} else {
		next();
	}
}

app.get('/', auth, function (req, res) {
	res.redirect('/chat');
});

app.get('/chat', auth, function (req, res) {
	res.render('chat', { title: 'Web Sockets Demo'});
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

var io = require('socket.io').listen(server).set('authorization', function (data, accept) {	
	if (!data.headers.cookie)
		return accept('No cookie transmitted', false);
		
	data.cookie = cookie.parse(data.headers.cookie);
	data.sessionID = data.cookie['express.sid'];
	data.sessionStore = app.sessionStore;
	
	if (data.sessionID) {
		var exp = /\:(\w+\-*\w+\_*)./gi;
		var sessionID = exp.exec(data.sessionID)[1];
	}
	
	if (!sessionID)
		return data('Couldn\'t parse session ID', false);
	
	app.sessionStore.get(sessionID, function (err, session) {		
		if (err || !session) 
			return accept('Error', false);
			
		data.session = new express.session.Session(data, session);
		
		return accept(null, true);
	});
});
// switch off detailed log for production
io.set('log level', 1); 

io.sockets.on('connection', function(socket) {	
	var hs = socket.handshake.session;
	console.log(util.inspect(hs));
	
	// for the simplicity use first 5 symbols of user as ID
	var ID = hs.username ? hs.username : (socket.id).toString().substr(0, 5);
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
	
	socket.on('set_session', function(data) {
		console.log('set_session called with param: ' + data);
		hs.reload(function() {
			hs.value = data;
			hs.touch().save();
		});
	});
	
	socket.on('disconnect', function() {
		var time = (new Date()).toLocaleTimeString();
		io.sockets.json.send({'event': 'userSplit', 'name': ID, 'time': time});
	});
});