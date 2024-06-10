const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const sha = require('sha256');
const multer = require('multer');

const app = express();
const url = 'mongodb+srv://hwan:1234@atlascluster.7koj07w.mongodb.net/?retryWrites=true&w=majority&appName=AtlasCluster';
let mydb;

// MongoDB 연결 설정 함수
async function connectDB() {
    try {
        const client = await MongoClient.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });
        mydb = client.db('myboard');
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
    }
}

// storage 설정
let storage = multer.diskStorage({
    destination: function (req, file, done) {
        done(null, './public/image');
    },
    filename: function (req, file, done) {
        done(null, file.originalname);
    }
});

async function startServer() {
    await connectDB();

    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());
    app.use(session({
        secret: 'dkufe8938493j4e08349u',
        resave: false,
        saveUninitialized: true
    }));
    app.use(express.static('public'));
    app.set('view engine', 'ejs');

    app.get('/', (req, res) => {
        res.render('index.ejs', { user: req.session.user });
    });

    app.get('/login', (req, res) => {
        if (req.session.user) {
            res.render('index.ejs', { user: req.session.user });
        } else {
            res.render('login');
        }
    });

    app.post('/login', (req, res) => {
        mydb.collection("account").findOne({ userid: req.body.userid })
            .then((result) => {
                if (result && result.userpw === sha(req.body.userpw)) {
                    req.session.user = req.body;
                    res.render("index.ejs", { user: req.session.user });
                } else {
                    res.render("login.ejs");
                }
            });
    });

    app.get("/logout", (req, res) => {
        req.session.destroy();
        res.render('index.ejs', { user: null });
    });

    app.get('/list', async (req, res) => {
        try {
            const result = await mydb.collection('post').find().toArray();
            res.render('list', { posts: result });
        } catch (err) {
            console.error('Error fetching posts', err);
            res.status(500).send('Error fetching posts');
        }
    });

    app.post("/delete", async (req, res) => {
        try {
            const postId = req.body._id;
            if (!ObjectId.isValid(postId)) {
                throw new Error('Invalid ObjectId');
            }
            const result = await mydb.collection('post').deleteOne({ _id: new ObjectId(postId) });
            console.log('삭제완료', result);
            res.send('삭제완료');
        } catch (err) {
            console.error('Error deleting post', err);
            res.status(500).send('Error deleting post');
        }
    });

    app.get('/session', (req, res) => {
        if (isNaN(req.session.milk)) {
            req.session.milk = 0;
        }
        req.session.milk += 1000;
        res.send("session : " + req.session.milk + "원");
    });

    app.get('/enter', (req, res) => {
        res.render('enter.ejs');
    });

    app.post('/save', async (req, res) => {
        try {
            const date = new Date(req.body.someDate + "T00:00:00Z");
            const result = await mydb.collection('post').insertOne({
                title: req.body.title,
                content: req.body.content,
                date: date,
                path: imagepath // 이미지 경로를 포함
            });
            console.log(result);
            console.log('데이터 추가 성공');
            res.send('데이터 추가 성공');
        } catch (err) {
            console.error('Error inserting data', err);
            res.status(500).send('Error inserting data');
        }
        res.redirect("/list");
    });

    app.get("/signup", (req, res) => {
        res.render("signup.ejs");
    });

    app.post("/signup", (req, res) => {
        mydb.collection("account").insertOne({
            userid: req.body.userid,
            userpw: sha(req.body.userpw),
            usergroup: req.body.usergroup,
            useremail: req.body.useremail,
        }).then(() => {
            console.log("회원가입 성공");
        });
        res.redirect("/");
    });

    app.get('/content/:id', async (req, res) => {
        try {
            const postId = req.params.id;
            if (!ObjectId.isValid(postId)) {
                throw new Error('Invalid ObjectId');
            }
            const result = await mydb.collection("post").findOne({ _id: new ObjectId(postId) });
            console.log(result);
            res.render('content', { post: result });
        } catch (err) {
            console.error('Error fetching post', err.message);
            res.status(400).send('Error fetching post: ' + err.message);
        }
    });
    
    
    app.get('/edit/:id', async (req, res) => {
        try {
            const postId = req.params.id;
            if (!ObjectId.isValid(postId)) {
                throw new Error('Invalid ObjectId');
            }
            const result = await mydb.collection("post").findOne({ _id: new ObjectId(postId) });
            res.render("edit.ejs", { post: result });
        } catch (err) {
            console.error('Error fetching post for editing', err.message);
            res.status(400).send('Error fetching post for editing: ' + err.message);
        }
    });
    
    
    app.post("/edit", async (req, res) => {
    try {
        const postId = req.body.id;
        if (!ObjectId.isValid(postId)) {
            throw new Error('Invalid ObjectId');
        }
        const updatedDate = new Date(req.body.someDate + "T00:00:00Z");
        await mydb.collection("post").updateOne(
            { _id: new ObjectId(postId) },
            { $set: { title: req.body.title, content: req.body.content, date: updatedDate, path: imagepath } } // 이미지 경로 업데이트
        );
        console.log("수정완료");
        res.redirect('/list');
    } catch (err) {
        console.error('Error updating post', err.message);
        res.status(400).send('Error updating post: ' + err.message);
    }
});

    app.use(express.static("public"));

    let upload = multer({ storage: storage });

    let imagepath = '';

    app.post('/photo', upload.single('picture'), function (req, res) {
    try {
        console.log(req.file.path);
        imagepath = req.file.path.replace('public\\', ''); // 경로 조정
        res.send({ path: imagepath });
    } catch (err) {
        console.error('Error uploading photo', err);
        res.status(500).send('Error uploading photo');
    }
});

    app.get('/search', function(req, res){
        console.log(req.query);
        mydb
        .collection("post")
        .find({title:req.query.value}).toArray()
        .then((result) =>{
            console.log(result);
        })
    })

    app.listen(8080, () => {
        console.log("포트 8080으로 서버 대기중 ... ");
    });
}

startServer();
