const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const flash = require('connect-flash');
const cors = require('cors');
const sessionOptions = require('./config/session');
const User = require('./model/User');
const passport = require("passport");
const LocalStrategy = require("passport-local");
const userRoutes = require('./routes/user');
const postRoutes = require('./routes/post');
const authRoutes = require('./routes/auth');
const commentRoutes = require('./routes/comment');
const messageRoutes = require('./routes/message');
const extraRoutes = require('./routes/other');
const cloudinaryRoutes = require('./routes/cloudinary');
const notificationRoutes = require('./routes/notification');
const app = express();
require('dotenv').config();

app.use(express.urlencoded({ extended: true }));

app.use(bodyParser.json());
app.use(session(sessionOptions));
app.use(flash());
app.use(cors({
    origin: `${process.env.FrontEnd}`,
    methods: ['GET', 'POST','DELETE','PUT'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(express.urlencoded({ extended: true }));
app.use('/login', authRoutes);
app.use('/Messages', messageRoutes);
app.use('/user', userRoutes);
app.use('/comment', commentRoutes);
app.use('/post', postRoutes);
app.use('/cloudinary',cloudinaryRoutes);
app.use('/notifications', notificationRoutes);
app.use('/', extraRoutes);
module.exports = app;
