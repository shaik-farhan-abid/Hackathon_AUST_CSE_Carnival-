const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const User = require('./models/user.js');

const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'secret123',
    resave: false,
    saveUninitialized: false
}));

// Static files
app.use('/assets', express.static(path.join(__dirname, '../assets')));
app.use('/HTML', express.static(path.join(__dirname, '../HTML')));

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/eventify', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log(err));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// Signup
app.post('/signup', async (req, res) => {
    try {
        const { email, firstname, lastname, username, password, confirm, phone } = req.body;
        if (password !== confirm) return res.send('Passwords do not match');

        const existing = await User.findOne({ $or: [{ email }, { username }] });
        if (existing) return res.send('Email or username already exists');

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({ email, firstname, lastname, username, password: hashedPassword, phone });
        await newUser.save();

        res.redirect('/HTML/login.html');
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});

// Login
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.send('User not found');

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.send('Incorrect password');

        // Save only userId in session
        req.session.userId = user._id;

        res.redirect('/HTML/participantDash.html');
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});



// API: Get current user info
app.get('/api/user', async (req, res) => {
    if (!req.session.userId) return res.status(401).send('Not logged in');

    const user = await User.findById(req.session.userId).select("-password");
    res.json(user);
});

// API: Update user info
app.post('/api/update-user', async (req, res) => {
    if (!req.session.userId) return res.status(401).send('Not logged in');

    const { firstname, lastname, username, phone, password } = req.body;

    const updateData = { firstname, lastname, username, phone };

    if (password && password.trim() !== "") {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateData.password = hashedPassword;
    }

    await User.findByIdAndUpdate(req.session.userId, updateData);

    res.json({ success: true });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).send("Logout failed");
        res.json({ success: true });
    });
});


const Admin = require("./models/admin.js");

// Prebuilt admins (only insert once)
async function createDefaultAdmins() {
  const existingAdmins = await Admin.find();
  if (existingAdmins.length > 0) return; // already inserted

//  const bcrypt = require("bcryptjs");
    const a1 = await bcrypt.hash("1", 10);
    const a2 = await bcrypt.hash("2", 10);
    const a3 = await bcrypt.hash("3", 10);

  await Admin.insertMany([
    { email: "1@gmail.com", password: a1, myevents: [] },
    { email: "2@gmail.com", password: a2, myevents: [] },
    { email: "3@gmail.com", password: a3, myevents: [] }
  ]);

  console.log("✅ Default admins created");
}

createDefaultAdmins();


app.post('/loginAdmin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const admin = await Admin.findOne({ email });
        if (!admin) return res.send('Admin not found');

        const match = await bcrypt.compare(password, admin.password);
        if (!match) return res.send('Incorrect password');

        req.session.adminId = admin._id; // store admin session
        res.redirect('/HTML/adminDash.html'); // create this page for admins
    } catch (err) {
        res.send('Error: ' + err.message);
    }
});


// Add event (admin only)
app.post("/api/admin/add-event", async (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ success: false, msg: "Not logged in" });

  try {
    const { title, description, date, form_link, rules, platform, reg_fee, status } = req.body;

    const admin = await Admin.findById(req.session.adminId);
    if (!admin) return res.status(404).json({ success: false, msg: "Admin not found" });

    const newEvent = { title, description, date, form_link, rules, platform, reg_fee, status };

    admin.myevents.unshift(newEvent); // add to top
    await admin.save();

    res.json({ success: true, event: newEvent });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// Fetch all events for logged-in admin
app.get("/api/admin/events", async (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ success: false, msg: "Not logged in" });

  try {
    const admin = await Admin.findById(req.session.adminId);
    if (!admin) return res.status(404).json({ success: false, msg: "Admin not found" });

    res.json({ success: true, events: admin.myevents });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});


// Fetch ALL events (across admins)
app.get("/api/events", async (req, res) => {
  try {
    const admins = await Admin.find();
    let allEvents = [];

    admins.forEach(admin => {
      allEvents = allEvents.concat(admin.myevents.map(ev => ({
        ...ev.toObject(),
        adminEmail: admin.email // so we know who created it
      })));
    });

    res.json({ success: true, events: allEvents });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// Fetch archived events only
app.get("/api/events/archived", async (req, res) => {
  try {
    const admins = await Admin.find();
    let archivedEvents = [];

    admins.forEach(admin => {
      archivedEvents = archivedEvents.concat(
        admin.myevents.filter(ev => ev.status === "Archive").map(ev => ({
          ...ev.toObject(),
          adminEmail: admin.email
        }))
      );
    });

    res.json({ success: true, events: archivedEvents });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});


// Update admin password only
app.post("/api/admin/update-password", async (req, res) => {
  if (!req.session.adminId) return res.status(401).json({ success: false, msg: "Not logged in" });

  const { password } = req.body;
  if (!password || password.trim() === "") return res.status(400).json({ success: false, msg: "Password cannot be empty" });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await Admin.findByIdAndUpdate(req.session.adminId, { password: hashedPassword });

    res.json({ success: true, msg: "Password updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});






app.listen(port, () => console.log(`✅ Server running at http://localhost:${port}`));