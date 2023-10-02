"use strict";

const { Context } = require("moleculer");

const { SMTPServer } = require('smtp-server');
const parser = require("mailparser").simpleParser

/**
 * Session Object:
 * - id: A random string identifier generated when the client connects.
 * - remoteAddress: The IP address of the connected client.
 * - clientHostname: The reverse-resolved hostname for remoteAddress.
 * - openingCommand: The opening SMTP command (HELO/EHLO/LHLO).
 * - hostNameAppearsAs: The hostname the client provided with HELO/EHLO call.
 * - envelope: Includes envelope data.
 * - mailFrom: Includes an address object or is set to false.
 * - rcptTo: Includes an array of address objects.
 * - user: Includes the user value returned with the authentication handler.
 * - transaction: The number of the current transaction. (1 for the first message, 2 for the 2nd message, etc.)
 * - transmissionType: Indicates the current protocol type for the received header (SMTP, ESMTP, ESMTPA, etc.).
 *
 * Address Object:
 * - address: The address provided with the MAIL FROM or RCPT TO command.
 * - args: An object with additional arguments (all key names are uppercase).
 */

/**
 * Server Options:
 * - secure: If true, the connection will use TLS. Default is false. TLS can also be initiated with the STARTTLS command.
 * - name: Optional hostname of the server used for client identification (defaults to os.hostname()).
 * - banner: Optional greeting message appended to the default ESMTP response.
 * - size: Optional maximum allowed message size in bytes.
 * - hideSize: If true, does not expose the max allowed size to the client but retains size-related values.
 * - authMethods: Optional array of allowed authentication methods. Defaults to ['PLAIN', 'LOGIN'].
 * - authOptional: Allow authentication but do not require it.
 * - disabledCommands: Optional array of disabled commands. For example, ['AUTH'] to disable authentication.
 * - hideSTARTTLS: If true, allow using STARTTLS but do not advertise or require it.
 * - hidePIPELINING: If true, does not show PIPELINING in the feature list.
 * - hide8BITMIME: If true, does not show 8BITMIME in features list.
 * - hideSMTPUTF8: If true, does not show SMTPUTF8 in features list.
 * - allowInsecureAuth: If true, allows authentication even if the connection is not secured first.
 * - disableReverseLookup: If true, does not attempt to reverse resolve client hostname.
 * - sniOptions: TLS options for SNI where servername is the key.
 * - logger: A bunyan compatible logger instance or true to log to the console.
 * - maxClients: Sets the maximum number of concurrently connected clients. Defaults to Infinity.
 * - useProxy: If true, expects to be behind a proxy that emits a PROXY header (version 1 only).
 * - useXClient: If true, enables usage of XCLIENT extension to override connection properties.
 * - useXForward: If true, enables usage of XFORWARD extension.
 * - lmtp: If true, use LMTP protocol instead of SMTP.
 * - socketTimeout: Milliseconds of inactivity before disconnecting the client. Defaults to 1 minute.
 * - closeTimeout: Milliseconds to wait before disconnecting pending connections after server.close() is called. Defaults to 30 seconds.
 * - onAuth: Callback to handle authentications.
 * - onConnect: Callback to handle the client connection.
 * - onSecure: Optional callback to validate TLS information.
 * - onMailFrom: Callback to validate MAIL FROM commands.
 * - onRcptTo: Callback to validate RCPT TO commands.
 * - onData: Callback to handle incoming messages.
 * - onClose: Callback that informs about closed client connections.
 */

/**
 * OAuth2 (XOAUTH2) Authentication:
 *
 * To enable XOAUTH2 support, add "XOAUTH2" to the authMethods array option.
 *
 * Example for XOAUTH2:
 *
 * const server = new SMTPServer({
 *   authMethods: ["XOAUTH2"], // XOAUTH2 is not enabled by default
 *   onAuth(auth, session, callback) {
 *     if (auth.method !== "XOAUTH2") {
 *       return callback(new Error("Expecting XOAUTH2"));
 *     }
 *     if (auth.username !== "abc" || auth.accessToken !== "def") {
 *       return callback(null, {
 *         data: {
 *           status: "401",
 *           schemes: "bearer mac",
 *           scope: "my_smtp_access_scope_name",
 *         },
 *       });
 *     }
 *     callback(null, { user: 123 }); // where 123 is the user id or similar property
 *   },
 * });
 *
 * CRAM-MD5 Authentication:
 *
 * To enable CRAM-MD5 support, add "CRAM-MD5" to the authMethods array option.
 *
 * Example for CRAM-MD5:
 *
 * const server = new SMTPServer({
 *   authMethods: ["CRAM-MD5"], // CRAM-MD5 is not enabled by default
 *   onAuth(auth, session, callback) {
 *     if (auth.method !== "CRAM-MD5") {
 *       return callback(new Error("Expecting CRAM-MD5"));
 *     }
 *     
 *     // CRAM-MD5 does not provide a password but a challenge response
 *     // that can be validated against the actual password of the user
 *     if (auth.username !== "abc" || !auth.validatePassword("def")) {
 *       return callback(new Error("Invalid username or password"));
 *     }
 *     
 *     callback(null, { user: 123 }); // where 123 is the user id or similar property
 *   },
 * });
 */



/**
 * SMTP service agent
 */
module.exports = {
	name: "emails.smtp",
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
		// SMTP server settings
		port: 25,
		host: "localhost",
		secure: true,
		banner: "Welcome to My SMTP Server",
		disabledCommands: ["STARTTLS"], // Disable STARTTLS for clear text authentication
		authMethods: ["PLAIN", "LOGIN"], // Enable authentication methods
		size: 10 * 1024 * 1024, // Maximum message size in bytes (10 MB)
		authOptional: true, // Allow authentication but do not require it
		hideSTARTTLS: false, // If true, allow using STARTTLS but do not advertise or require it.
		hidePIPELINING: false, // If true, does not show PIPELINING in the feature list.
		hide8BITMIME: false, // If true, does not show 8BITMIME in features list.
		hideSMTPUTF8: false, // If true, does not show SMTPUTF8 in features list.
		allowInsecureAuth: false, // If true, allows authentication even if the connection is not secured first.
		disableReverseLookup: false, // If true, does not attempt to reverse resolve client hostname.
		sniOptions: undefined, // TLS options for SNI where servername is the key.
		logger: undefined, // A bunyan compatible logger instance or true to log to the console.
		maxClients: Infinity, // Sets the maximum number of concurrently connected clients. Defaults to Infinity.
		useProxy: false, // If true, expects to be behind a proxy that emits a PROXY header (version 1 only).
		useXClient: false, // If true, enables usage of XCLIENT extension to override connection properties.
		useXForward: false, // If true, enables usage of XFORWARD extension.
		lmtp: false, // If true, use LMTP protocol instead of SMTP.
		socketTimeout: 60000, // Milliseconds of inactivity before disconnecting the client. Defaults to 1 minute.
		closeTimeout: 30000, // Milliseconds to wait before disconnecting pending connections after server.close() is called. Defaults to 30 seconds.
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

		/**
		 * Start the SMTP server and listen for incoming connections
		 * 
		 * 
		 * @returns {Promise} Promise resolving when the server is started
		 */
		createSMTPServer() {
			this.logger.info("createSMTPServer: ", this.settings);
			const server = new SMTPServer({
				secure: this.settings.secure,
				banner: this.settings.banner,
				disabledCommands: this.settings.disabledCommands,
				authMethods: this.settings.authMethods,
				size: this.settings.size,
				authOptional: this.settings.authOptional,
				hideSTARTTLS: this.settings.hideSTARTTLS,
				hidePIPELINING: this.settings.hidePIPELINING,
				hide8BITMIME: this.settings.hide8BITMIME,
				hideSMTPUTF8: this.settings.hideSMTPUTF8,
				allowInsecureAuth: this.settings.allowInsecureAuth,
				disableReverseLookup: this.settings.disableReverseLookup,
				sniOptions: this.settings.sniOptions,
				logger: this.settings.logger,
				maxClients: this.settings.maxClients,
				useProxy: this.settings.useProxy,
				useXClient: this.settings.useXClient,
				useXForward: this.settings.useXForward,
				lmtp: this.settings.lmtp,
				socketTimeout: this.settings.socketTimeout,
				closeTimeout: this.settings.closeTimeout,
				// function callbacks
				onConnect: (session, callback) => {
					this.handleConnect(session)
						.then(() => callback())
						.catch((error) => callback(error));
				},
				onAuth: (auth, session, callback) => {
					this.validateAuthentication(auth, session)
						.then(() => callback(null, { user: session.user }))
						.catch((error) => callback(error));
				},
				onMailFrom: (address, session, callback) => {
					this.handleMailFrom(address, session)
						.then(() => callback())
						.catch((error) => callback(error));
				},
				onRcptTo: (address, session, callback) => {
					this.handleRcptTo(address, session)
						.then(() => callback())
						.catch((error) => callback(error));
				},
				onData: (stream, session, callback) => {
					this.handleData(stream, session)
						.then(() => callback())
						.catch((error) => callback(error));
				},
				onClose: (session) => {
					this.handleQuit(session);
				}
			});

			this.server = server;

			server.on("error", (error) => {
				this.logger.error("SMTP server error:", error);
			});

			return new Promise((resolve, reject) => {
				server.listen(this.settings.port, this.settings.host, (error) => {
					if (error)
						return reject(error)
					this.logger.info(`SMTP server listening on ${this.settings.host}:${this.settings.port}`);
					resolve();
				});
			});
		},

		/**
		 * Stop the SMTP server
		 * 
		 * @returns {Promise} Promise resolving when the server is stopped
		 */
		stopSMTPServer() {
			return new Promise((resolve, reject) => {
				this.server.close((error) => {
					if (error)
						return reject(error);
					this.logger.info("SMTP server stopped");
					resolve();
				});
			});
		},

		/**
		 * Handle the CONNECT command
		 * 
		 * @param {Object} session Session object
		 * 
		 * @returns {Boolean} True if the command was successful
		 */
		async handleConnect(session) {
			// Store the session object
			session.user = {};
			session.envelope = {};
			session.message = {};

			// create new context for the session
			const ctx = Context.create(this.broker, null, session);
			session.ctx = ctx;

			return true;
		},

		/**
		 * Validate an OAuth2 token
		 * 
		 * @param {String} accessToken OAuth2 access token
		 * 
		 * @returns {Boolean} True if the token is valid
		 */
		async validateOAuth2Token(accessToken) {
			throw new Error('OAuth2 authentication is not supported');
		},

		/**
		 * Check if a recipient quota is exceeded
		 * 
		 * @param {String} address Recipient address
		 * @param {Object} session Session object
		 * 
		 * @returns {Boolean} True if the quota is not exceeded
		 */
		async isQuotaExceeded(address, session) {
			this.logger.info("isQuotaExceeded: ", session);
			return session.ctx.call("v1.emails.mailboxs.isQuotaExceeded", {
				address
			});
		},

		/**
		 * Store a message in the emails.store service
		 * 
		 * @param {Object} session Session object
		 * @param {Object} message Message object
		 * 
		 * @returns {Promise} Promise resolving when the message is stored
		 */
		async storeMessage(session, message) {
			this.logger.info("storeMessage: ", session);

			// Store the message in the emails.store service
			return session.ctx.call("v1.emails.store.create", {
				state: "inbound",
				subject: message.subject,
				from: message.from.text,
				to: message.to.text,
				cc: message.cc.text,
				html: message.html,
				text: message.text,
				attachments: message.attachments
			});

		},

		/**
		 * Send a message to the message queue
		 * 
		 * @param {Object} session Session object
		 * @param {Object} message Message object
		 * 
		 * @returns {Promise} Promise resolving when the message is sent
		 */
		async sendMessage(session, message) {
			this.logger.info("sendMessage: ", session);
		},

		/**
		 * Send a message to the message queue
		 * 
		 * @param {Object} session Session object
		 * @param {Object} message Message object
		 * 
		 * @returns {Promise} Promise resolving when the message is sent
		 */
		async sendDeliveryNotification(session, message) {
			this.logger.info("sendDeliveryNotification: ", session);
		},


		/**
		 * Validate the authentication credentials of a user
		 * 
		 * @param {Object} auth Authentication credentials
		 * @param {Object} session Session object
		 * 
		 * @returns {Boolean} True if the authentication was successful
		 */
		async validateAuthentication(auth, session) {
			// Check if authentication is disabled
			if (this.settings.disableAuth)
				return true;

			// check auth method is supported
			if (!this.settings.authMethods.includes(auth.method))
				throw new Error('Unsupported authentication method');

			//check if auth method is XOAUTH2 and validate the token
			if (auth.method === "XOAUTH2") {
				await this.validateOAuth2Token(auth.accessToken);
			}

			// Check if authentication is optional
			if (this.settings.authOptional) {
				// Check if authentication is required for the current session
				if (session.envelope.mailFrom.address !== "postmaster@localhost")
					return true;
			}

			// Check if authentication is required
			if (!auth.username || !auth.password)
				throw new Error('Authentication required');

			// Find the user by username

			const user = await this.findUser(auth.username);

			// Check if the user exists

		},

		/**
		 * Handle the MAIL FROM command and store the sender address in the session
		 * This method is called once for each message
		 * 
		 * @param {String} address Sender address
		 * @param {Object} session Session object
		 * 
		 * @returns {Boolean} True if the command was successful
		 */
		async handleMailFrom(address, session) {
			// Perform sender address validation
			await this.isValidSender(address);

			// Find the user by username
			const user = await this.findUser(address);

			// Check if the user exists
			if (!user)
				throw new Error('Invalid sender address');

			// Check if the user is allowed to send messages
			if (!user.canSend)
				throw new Error('Sender not allowed');



			// Store the sender address in the session
			session.from = address;

			// Store the user in the session
			session.user = user;



			return true;
		},

		/**
		 * Handle the RCPT TO command
		 * This method is called for each recipient address in the message
		 * 
		 * 
		 * @param {String} address Recipient address
		 * @param {Object} session Session object
		 * 
		 * @returns {Boolean} True if the command was successful
		 */
		async handleRcptTo(address, session) {

			this.logger.info(`handleRcptTo: ${address} session`, session)

			// Perform recipient address validation
			await this.isValidRecipient(address);

			//check if the recipient is in the same domain
			const domain = address.split("@")[1];
			if (domain !== session.user.domain) {
				const err = new Error('Invalid recipient address');
				err.responseCode = 550;
				throw err
			}

			// Check recipient quotas if applicable
			await this.isQuotaExceeded(address, session);

			return true;
		},

		/**
		 * Handle the DATA command and store the message data in the session
		 * This method is called once for each message
		 * 
		 * @param {ReadableStream} stream Message data stream
		 * @param {Object} session Session object
		 * 
		 * @returns {Boolean} True if the command was successful
		 */
		async handleData(stream, session) {
			// Parse the message data
			const message = await parser(stream);
			// Store the message data in the session
			session.message = message;
			// Store the message data in the database
			await this.storeMessage(session, message);

			return true;
		},

		/**
		 * Handle the QUIT command
		 * 
		 * @param {Object} session Session object
		 * 
		 * @returns {Boolean} True if the command was successful
		 */
		async handleQuit(session) {
		},

		/**
		 * Find a user by username
		 * 
		 * @param {String} username Username
		 * 
		 * @returns {Object} User object
		 */
		async findUser(username) {
			return this.broker.call("v1.emails.mailboxs.findUser", {
				username
			});
		},

		/**
		 * Check if a username and password is correct
		 * 
		 * @param {String} username Username
		 * @param {String} password Password
		 * 
		 * @returns {Boolean} True if the password is correct
		 */
		async checkPassword(username, password) {
			return this.broker.call("v1.emails.mailboxs.checkPassword", {
				username, password
			});
		},

		/**
		 * Check if a sender address is valid
		 * 
		 * @param {String} address Sender address
		 * 
		 * @returns {Boolean} True if the sender address is valid
		 */
		async isValidSender(address) {
			return true;
		},

		/**
		 * Check if a recipient address is valid
		 * 
		 * @param {String} address Recipient address
		 * 
		 * @returns {Boolean} True if the recipient address is valid
		 */
		async isValidRecipient(address) {
			return true;
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

	},

	/**
	 * Service stopped lifecycle event handler
	 */
	stopped() {

	}
};