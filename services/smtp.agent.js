"use strict";


const { SMTPServer } = require('smtp-server');

const parser = require("mailparser").simpleParser


/**
 * Addons service
 */
module.exports = {
	name: "smtp",
	version: 1,

	mixins: [
        
	],

	/**
	 * Service dependencies
	 */
	dependencies: [],

	/**
	 * Service settings
	 */
	settings: {
	},

	/**
	 * Actions
	 */
	actions: {


	},

	/**
	 * Events
	 */
	events: {

	},

	/**
	 * Methods
	 */
	methods: {
		createServer() {
			const broker = this.broker;
			this.server = new SMTPServer({
				// disable STARTTLS to allow authentication in clear text mode
				// log to console
				logger: false,
				secure: false,

				// not required but nice-to-have
				banner: 'Welcome to My Awesome SMTP Server',

				// disable STARTTLS to allow authentication in clear text mode
				disabledCommands: ['AUTH'],

				// By default only PLAIN and LOGIN are enabled
				//authMethods: ['PLAIN', 'LOGIN', 'CRAM-MD5'],

				// Accept messages up to 10 MB
				size: 1 * 1024 * 1024,

				// allow overriding connection properties. Only makes sense behind proxy
				useXClient: false,

				hidePIPELINING: false,

				// use logging of proxied client data. Only makes sense behind proxy
				useXForward: false,

				// Setup authentication
				// Allow only users with username 'testuser' and password 'testpass'
				onAuth: (auth, session, callback) => {

					broker.emit('noc.smtp', { auth, session })
				},

				// Validate MAIL FROM envelope address. Example allows all addresses that do not start with 'deny'
				// If this method is not set, all addresses are allowed
				onMailFrom(from, session, callback) {
					broker.emit('noc.smtp', { from, session })
					callback();
				},

				// Validate RCPT TO envelope address. Example allows all addresses that do not start with 'deny'
				// If this method is not set, all addresses are allowed
				onRcptTo(to, session, callback) {

					broker.emit('noc.smtp', { to, session })

					callback();
				},

				// Handle message stream
				onData(stream, session, callback) {
					stream.on('end', () => {
						let err;
						if (stream.sizeExceeded) {
							err = new Error('Error: message exceeds fixed maximum message size 10 MB');
							err.responseCode = 552;
							return callback(err);
						}
						callback(null, 'Message queued as abcdef'); // accept the message once the stream is ended
					});
					parser(stream, {}, (err, parsed) => {
						if (err)
							console.log("Error:", err)

						console.log(session)
					});
				}
			});
			this.server.on('error', err => {
				console.log('server Error occurred');
				console.log(err);
			});
			this.server.listen(25);
		},
		cleaseServer() {
			if (this.server) this.server.close()

		}
	},

	/**
	 * Service created lifecycle event handler
	 */
	created() { },

	/**
	 * Service started lifecycle event handler
	 */
	started() {
		this.createServer()
	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {
		this.cleaseServer()
	}
};