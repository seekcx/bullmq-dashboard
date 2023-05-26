const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue: QueueMQ, Worker, QueueScheduler } = require('bullmq');
const session = require('express-session');
const bodyParser = require('body-parser');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { ensureLoggedIn } = require('connect-ensure-login');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(
    new LocalStrategy(function (username, password, cb) {
        if (
            username === (process.env.BOARD_USERNAME || 'root') 
            && password === (process.env.BOARD_PASSWORD || 'secret') ) {
            return cb(null, { user: 'bull-board' });
        }
        return cb(null, false);
    })
);

// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser((user, cb) => {
    cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});

const redisOptions = {
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || '127.0.0.1',
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    tls: false,
};

const run = async () => {
    const names = process.env.QUEUE_NAMES.split(',');

    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/');

    createBullBoard({
        queues: names.map(
            (name) => new BullMQAdapter(
                new QueueMQ(name, { connection: redisOptions })
            )
        ),
        serverAdapter,
    });

    const app = express();
    // Configure view engine to render EJS templates.
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');

    app.use(session({ secret: 'keyboard cat', saveUninitialized: true, resave: true }));
    app.use(bodyParser.urlencoded({ extended: false }));

    // Initialize Passport and restore authentication state, if any, from the session.
    app.use(passport.initialize({}));
    app.use(passport.session({}));

    app.get('/login', (req, res) => {
        res.render('login', { invalid: req.query.invalid === 'true' });
    });

    app.post(
        '/login',
        passport.authenticate('local', { failureRedirect: '/login?invalid=true' }),
        (req, res) => {
            res.redirect('/');
        }
    );

    app.use('/', ensureLoggedIn({ redirectTo: '/login' }), serverAdapter.getRouter());

    const port = process.env.BOARD_PORT || 3000
    app.listen(port, () => {
        console.log(`Running on ${port}...`);
        console.log(`For the UI, open http://localhost:${port}`);
    });
};

// eslint-disable-next-line no-console
run().catch((e) => console.error(e));