const express = require('express')
const app = express()
const http = require('http').Server(app)
const io = require('socket.io')(http)

const mongoose = require('mongoose')
mongoose.Promise = global.Promise

const session = require('express-session')
const sharedSession = require('express-socket.io-session')

const Room = require('./models/room')
const Message = require('./models/message')

app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))
app.set('view engine', 'ejs')

const expressSession = session({
    secret: 'socketio',
    cookie: {
        maxAge: 10*60*1000
    },
    resave: false,
    saveUninitialized: true
})
app.use(expressSession)
io.use(sharedSession(expressSession, { autoSave: true }))


app.get('/', (req, res) => {
    res.render('home')
})
app.post('/', (req, res) => {
    req.session.user = {
        name: req.body.name,
        //id: req.sessionID
    }
    
    res.redirect('/room')
})

app.get('/room', (req, res) => {
    //res.send(req.session)
    if(!req.session.user){
        res.redirect('/')
    }else{
        res.render('room', {
            name: req.session.name
        })
    }
})

io.on('connection', socket => {
    //salas iniciais
    Room.find({}, (err, rooms) => {
        socket.emit('roomList', rooms)
    })
    //add nova sala
    socket.on('addRoom', roomName => {
        const room = new Room({
            name: roomName
        })
        room
            .save()
            .then(() => {
                io.emit('newRoom', room)
            })
    })
    //join na sala
    socket.on('join', roomId => {
        socket.join(roomId)
        Message
            .find({ room: roomId})
            .then( msgs => {
                //console.log(msgs)
                socket.emit('msgsList', msgs)
        })
    })
    socket.on('sendMsg', msg => {
        const message = new Message({
            author: socket.handshake.session.user.name,
            when: new Date(),
            msgType: 'text',
            message: msg.msg,
            room: msg.room
        })
        message
            .save()
            .then(()=> {
                io.to(msg.room).emit('newMsg', message)
            })

        // console.log(msg)
        // console.log(socket.handshake.session)
    })
})

mongoose
    .connect('mongodb://localhost/chat-socketio', { useNewUrlParser: true,  useUnifiedTopology: true })
    .then(() => {
        http.listen(3000, () => console.log('chat running...'))
    })