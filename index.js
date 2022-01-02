const express = require('express')
const app = express()
const cors = require('cors');
const admin = require("firebase-admin");
const { MongoClient } = require('mongodb');
require("dotenv").config();
const port = process.env.PORT || 5000

// doctors-portal-admin-firebase.json
// connect firebase with admin sdk//the next line come from firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

app.use(cors())
// for the access userData body data
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.poyqe.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


// firebase token
async function verifyToken(req, res, next) {
    if (req.headers.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        // console.log('decode',token)
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        } catch {

        }
    }
    next();
}



async function run() {
    try {
        await client.connect()
        const database = client.db('doctors_portal');
        const appointmentCollection = database.collection('appointments');
        const usersCollection = database.collection('users');

        // get cursor data
        app.get('/appointments', async (req, res) => {
            const email = req.query.email;
        //    there is a error in this line this line push a error and it set bad date
            const date = new Date(req.query.date).toLocaleDateString();
            // filter by email and date
            const query = { email: email, date: date }
            const cursor = appointmentCollection.find(query);
            const appointments = await cursor.toArray();
            console.log(appointments)
            console.log(date,req.query.date)
            res.json(appointments);
        })
        // insert a appointment//1st verify the token and then send server req to add the appointment
        app.post('/appointments', verifyToken, async (req, res) => {
            const appointment = req.body;
            // console.log(appointment)
            const result = await appointmentCollection.insertOne(appointment);
            // console.log(result);
            res.json(result)
        });

        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ isAdmin: isAdmin })
        })


        //post data to user and insert data to mongodb
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            // console.log(user,result);
            res.json(result)
        })
        app.put('/users', async (req, res) => {
            const user = req.body;
            // console.log(user)
            const filer = { email: user.email };
            const option = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filer, updateDoc, option);
            res.json(result)
        })
        // make new Admin
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await usersCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    // console.log('put',req.decodedEmail)
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            } else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }

        })

    } finally {
        // await client.close()
    }
}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello doctors portal!')
})

app.listen(port, () => {
    console.log(`this feaking app listening http://localhost:${port}`)
})

// app.get('/users')
// app.post('/users')
// app.get('/users/:id')
// app.put('/users/:id');
// app.delete('/users/:id')
// users: get
// users: post