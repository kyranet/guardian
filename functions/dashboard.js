// Native Imports
const url = require('url');
const path = require('path');

// Used for Permission Resolving only...
const Discord = require("discord.js");

// Express Session
const express = require('express');
const app = express();

// Express Plugins
const passport = require('passport');
const session = require('express-session');
const Strategy = require('passport-discord').Strategy;
const helmet = require('helmet');

// Used to parse Markdown from things like ExtendedHelp
const md = require("marked");

exports.init = (client) => {

	let dataDir = path.resolve(`${client.clientBaseDir}${path.sep}bwd${path.sep}dashboard`);
	let templateDir = path.resolve(`${dataDir}${path.sep}templates`);

  passport.serializeUser((user, done) => {
  	done(null, user);
  });
  passport.deserializeUser((obj, done) => {
  	done(null, obj);
  });
  
  passport.use(new Strategy({
  	clientID: '291992289411203082',
  	clientSecret: 'Qr0vVX1YAc1rer5efLDZywxbAo6ShKxm',
  	callbackURL: `https://guardian.evie.codes/callback`,
  	scope: ['identify', 'guilds']
  },
  (accessToken, refreshToken, profile, done) => {
  	process.nextTick(() => done(null, profile));
  }));
  
  app.use(session({
  	secret: 'ishallprotect',
  	resave: false,
  	saveUninitialized: false,
  }));
  
  app.engine('html', require('ejs').renderFile);
  app.set('view engine', 'html');
  
  app.locals.domain = 'guardian.evie.codes';
  
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(helmet());
  
  app.use('/semantic', express.static(path.resolve(`${dataDir}${path.sep}semantic`)));
  app.use('/res', express.static(path.resolve(`${dataDir}${path.sep}res`)));

	function checkAuth(req, res, next) {
		if(req.isAuthenticated()) return next();
		req.session.backURL = req.url;
		res.redirect('/login');
	}
	
	function checkAdmin(req, res, next) {
		if(req.isAuthenticated() && req.user.id === client.config.ownerID) return next();
		req.session.backURL = req.originalURL;
		res.redirect('/');
	}
	
	app.get('/', (req, res) => {
		if(req.isAuthenticated()) {
			res.render(path.resolve(`${templateDir}${path.sep}index.ejs`), { bot : client, auth: true, user: req.user });
		} else {
			res.render(path.resolve(`${templateDir}${path.sep}index.ejs`), { bot : client, auth: false, user: null });
		}
	});

	app.get('/login', 
		(req, res, next) => { 
			if(req.session.backURL) {
				 req.session.backURL = req.session.backURL;
			} else if(req.headers.referer) {
				const parsed = url.parse(req.headers.referer);
				if(parsed.hostname === app.locals.domain) {
					req.session.backURL = parsed.path;
				}
			} else {
				req.session.backURL = '/';
			}
			next(); 
		},
		passport.authenticate('discord'));

	app.get('/callback', passport.authenticate('discord', { failureRedirect: `/autherror` }), (req, res) => {
		if(req.session.backURL) {
			res.redirect(req.session.backURL);
			req.session.backURL = null;
		} else {
			res.redirect('/');
		}
	});

	app.get('/admin', checkAdmin, (req, res) => {
		res.render(path.resolve(`${templateDir}${path.sep}admin.ejs`), { bot : client, user: req.user, auth: true });
	});
	
	app.get('/dashboard', checkAuth, (req, res) => {
		const perms = Discord.EvaluatedPermissions;
		res.render(path.resolve(`${templateDir}${path.sep}dashboard.ejs`), { perms: perms, bot : client, user: req.user, auth: true });
	});
	
	app.get('/manage/:id', checkAuth, async (req, res) => {
		const guild = client.guilds.get(req.params.id);
		const isManaged = !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has("MANAGE_GUILD") : false;
		if(req.user.id === client.config.ownerID) {
			console.log(`Admin bypass for managing server: ${guild.id} from IP ${req.ip}`);
		} else if(!isManaged) { 
			res.redirect('/');
		}
		await guild.fetchMembers();
		res.render(path.resolve(`${templateDir}${path.sep}manage.ejs`), { bot : client, guild:guild, user: req.user, auth: true });
	});

	app.get('/docs', (req, res) => {
		if(req.isAuthenticated()) {
			res.render(path.resolve(`${templateDir}${path.sep}docs.ejs`), { bot : client, auth: true, user: req.user, md:md });
		} else {
			res.render(path.resolve(`${templateDir}${path.sep}docs.ejs`), { bot : client, auth: false, user: null, md:md });
		}
	});
	
	app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
	});
	
	client.site = app.listen(client.config.serverPort);
};
