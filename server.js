const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files (HTML, images, assets)
app.use(express.static(__dirname));

// MongoDB Connection with fallback
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
let isMongoConnected = false;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000,
  })
    .then(() => {
      isMongoConnected = true;
      console.log(' Connected to MongoDB Atlas!');
    })
    .catch(err => {
      isMongoConnected = false;
      console.warn(' MongoDB Atlas connection error; using in-memory store:', err.message);
    });
} else {
  console.log(' No MONGO_URI provided; using in-memory store for local/preview mode.');
}

mongoose.connection.on('connected', () => { isMongoConnected = true; });
mongoose.connection.on('disconnected', () => { isMongoConnected = false; });

// ─── MONGOOSE SCHEMAS ───

const ClassSchema = new mongoose.Schema({
  classType: String,
  section: String,
  year: String,
  semester: String,
  specialization: String,
  subjects: [String],
  subjectPreferences: [{
    name: String,
    preference: Number
  }]
});

const TeacherSchema = new mongoose.Schema({
  code: String,
  name: String,
  email: String,
  designation: String,
  classes: [ClassSchema],
  days: [String],
  workingHours: Number,
  submittedAt: Date
});

const Teacher = mongoose.model('Teacher', TeacherSchema);

// HOD Schema
const HODSchema = new mongoose.Schema({
  email: String,
  password: String,
  name: String,
  createdAt: { type: Date, default: Date.now }
});

const HOD = mongoose.model('HOD', HODSchema);

// (Optional Stub) Syllabus Schema to prevent frontend 404s
const SyllabusSchema = new mongoose.Schema({}, { strict: false });
const Syllabus = mongoose.model('Syllabus', SyllabusSchema, 'syllabuses');

// ─── HARDCODED DEFAULT CREDENTIALS ───
const DEFAULT_HOD_EMAIL = 'hod@huniv.edu';
const DEFAULT_HOD_PASS = 'hod123';

// ─── IN-MEMORY DATA STORE (FOR PREVIEW & OFFLINE DB MODE) ───
const memoryStore = {
  teachers: [
    {
      code: 'T101',
      name: 'Dr. Robert Smith',
      email: 'faculty@huniv.edu',
      designation: 'Professor',
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      workingHours: 20,
      classes: [
        {
          classType: 'Theory',
          section: 'A',
          year: '3',
          semester: '5',
          specialization: 'CSE',
          subjects: ['Web Technologies', 'Operating Systems'],
          subjectPreferences: [
            { name: 'Web Technologies', preference: 1 },
            { name: 'Operating Systems', preference: 2 }
          ]
        }
      ],
      submittedAt: new Date()
    }
  ],
  syllabuses: [
    {
      code: 'CS101',
      subjectName: 'Computer Programming',
      year: '1',
      semester: '1',
      specialization: 'CSE',
      credits: 4
    },
    {
      code: 'CS201',
      subjectName: 'Data Structures and Algorithms',
      year: '2',
      semester: '3',
      specialization: 'CSE',
      credits: 4
    },
    {
      code: 'CS301',
      subjectName: 'Web Technologies',
      year: '3',
      semester: '5',
      specialization: 'CSE',
      credits: 4
    },
    {
      code: 'CS302',
      subjectName: 'Operating Systems',
      year: '3',
      semester: '5',
      specialization: 'CSE',
      credits: 4
    }
  ]
};

// ─── API ROUTES ───

// POST: HOD Login
app.post('/api/hod/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    // Check against default credentials (can be extended to query database)
    if (email === DEFAULT_HOD_EMAIL && password === DEFAULT_HOD_PASS) {
      return res.status(200).json({
        email: DEFAULT_HOD_EMAIL,
        name: 'Head Of Department'
      });
    }

    // Optional: Check if HOD exists in database for additional HOD accounts
    if (isMongoConnected) {
      const hod = await HOD.findOne({ email, password });
      if (hod) {
        return res.status(200).json({
          email: hod.email,
          name: hod.name
        });
      }
    }

    // Invalid credentials
    res.status(401).json({ error: 'Invalid HOD credentials.' });
  } catch (error) {
    console.error('Error during HOD login:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST: Save or Update Faculty Preferences
app.post('/api/teachers', async (req, res) => {
  try {
    const payload = req.body;
    payload.submittedAt = payload.submittedAt || new Date();

    if (isMongoConnected) {
      const query = payload.email ? { email: payload.email } : { code: payload.code };
      const teacher = await Teacher.findOneAndUpdate(
        query,
        payload,
        { new: true, upsert: true }
      );
      return res.status(200).json(teacher);
    }

    // In-memory fallback
    const key = payload.email || payload.code;
    const existingIndex = memoryStore.teachers.findIndex(
      t => (payload.email && t.email === payload.email) || (payload.code && t.code === payload.code)
    );

    if (existingIndex >= 0) {
      memoryStore.teachers[existingIndex] = { ...memoryStore.teachers[existingIndex], ...payload };
      return res.status(200).json(memoryStore.teachers[existingIndex]);
    } else {
      memoryStore.teachers.push(payload);
      return res.status(200).json(payload);
    }
  } catch (error) {
    console.error('Error saving teacher:', error);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// GET: Retrieve all teachers & their preferences (For Coordinator Dashboard)
app.get('/api/teachers', async (req, res) => {
  try {
    if (isMongoConnected) {
      const teachers = await Teacher.find();
      return res.status(200).json(teachers);
    }
    res.status(200).json(memoryStore.teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// DELETE: Clear all teachers (Requested by HOD/Coordinator 'Clear All' buttons)
app.delete('/api/teachers', async (req, res) => {
  try {
    if (isMongoConnected) {
      await Teacher.deleteMany({});
    }
    memoryStore.teachers = [];
    res.status(200).json({ message: 'All teachers cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear teachers' });
  }
});

// DELETE: Remove a specific teacher by code
app.delete('/api/teachers/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (isMongoConnected) {
      await Teacher.deleteOne({ code });
    }
    memoryStore.teachers = memoryStore.teachers.filter(t => t.code !== code);
    res.status(200).json({ message: `Teacher ${code} deleted` });
  } catch (error) {
    console.error('Error deleting teacher:', error);
    res.status(500).json({ error: 'Failed to delete teacher' });
  }
});

// GET: Retrieve Syllabus (For Subject Catalog)
app.get('/api/syllabus', async (req, res) => {
  try {
    if (isMongoConnected) {
      const subjects = await Syllabus.find().lean();
      console.log(`[GET /api/syllabus] Found ${subjects.length} subjects`);
      return res.status(200).json(subjects);
    }
    res.status(200).json(memoryStore.syllabuses);
  } catch (error) {
    console.error('[GET /api/syllabus] Error:', error);
    res.status(500).json({ error: 'Failed to fetch syllabus' });
  }
});

// GET: Debug endpoint to verify data exists
app.get('/api/syllabus/debug/count', async (req, res) => {
  try {
    if (isMongoConnected) {
      const count = await Syllabus.countDocuments();
      const sample = await Syllabus.findOne().lean();
      return res.status(200).json({ 
        totalCount: count, 
        sampleKeys: sample ? Object.keys(sample) : [],
        sampleDoc: sample 
      });
    }
    res.status(200).json({
      totalCount: memoryStore.syllabuses.length,
      sampleKeys: memoryStore.syllabuses[0] ? Object.keys(memoryStore.syllabuses[0]) : [],
      sampleDoc: memoryStore.syllabuses[0] || null
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Raw MongoDB query test (bypass Mongoose)
app.get('/api/test/raw-query', async (req, res) => {
  try {
    if (isMongoConnected) {
      const db = mongoose.connection.getClient().db('timetableDB');
      const syllabuses = await db.collection('syllabuses').find({}).limit(5).toArray();
      return res.status(200).json({
        method: 'Raw MongoDB Query',
        count: syllabuses.length,
        documents: syllabuses,
        timestamp: new Date()
      });
    }
    res.status(200).json({
      method: 'In-Memory Query',
      count: memoryStore.syllabuses.length,
      documents: memoryStore.syllabuses,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[RAW QUERY] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Comprehensive diagnostic endpoint
app.get('/api/diagnostic', async (req, res) => {
  try {
    const mongoStatus = mongoose.connection.readyState;
    const mongoStatusText = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoStatus] || 'unknown';
    const dbName = mongoose.connection.name || 'in-memory-preview';
    
    let collectionNames = ['teachers', 'syllabuses'];
    if (isMongoConnected) {
      try {
        const db = mongoose.connection.getClient().db(mongoose.connection.name);
        const collections = await db.listCollections().toArray();
        collectionNames = collections.map(c => c.name);
      } catch (e) {
        console.error('Error listing collections:', e);
      }
    }
    
    const countSyllabus = isMongoConnected ? await Syllabus.countDocuments() : memoryStore.syllabuses.length;
    const countTeacher = isMongoConnected ? await Teacher.countDocuments() : memoryStore.teachers.length;
    
    res.status(200).json({
      mongoConnection: mongoStatusText,
      databaseName: dbName,
      collectionNames: collectionNames,
      collections: {
        syllabus: {
          count: countSyllabus,
          sample: memoryStore.syllabuses[0] || null
        },
        teacher: {
          count: countTeacher,
          sample: memoryStore.teachers[0] || null
        }
      },
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[DIAGNOSTIC] Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// POST: Add or Update Syllabus
app.post('/api/syllabus', async (req, res) => {
  try {
    const payload = req.body;
    const code = payload.code || payload._id;
    
    if (isMongoConnected) {
      const syllabus = await Syllabus.findOneAndUpdate(
        { code },
        payload,
        { new: true, upsert: true }
      );
      return res.status(200).json(syllabus);
    }

    const idx = memoryStore.syllabuses.findIndex(s => s.code === code);
    if (idx >= 0) {
      memoryStore.syllabuses[idx] = { ...memoryStore.syllabuses[idx], ...payload };
      return res.status(200).json(memoryStore.syllabuses[idx]);
    } else {
      memoryStore.syllabuses.push(payload);
      return res.status(200).json(payload);
    }
  } catch (error) {
    console.error('Error saving syllabus:', error);
    res.status(500).json({ error: 'Failed to save syllabus' });
  }
});

// DELETE: Remove a specific syllabus by code
app.delete('/api/syllabus/:code', async (req, res) => {
  try {
    const { code } = req.params;
    if (isMongoConnected) {
      await Syllabus.deleteOne({ code });
    }
    memoryStore.syllabuses = memoryStore.syllabuses.filter(s => s.code !== code);
    res.status(200).json({ message: `Syllabus ${code} deleted` });
  } catch (error) {
    console.error('Error deleting syllabus:', error);
    res.status(500).json({ error: 'Failed to delete syllabus' });
  }
});

// DELETE: Clear all syllabus
app.delete('/api/syllabus', async (req, res) => {
  try {
    if (isMongoConnected) {
      await Syllabus.deleteMany({});
    }
    memoryStore.syllabuses = [];
    res.status(200).json({ message: 'All syllabus cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear syllabus' });
  }
});

// Fallback to index.html for root or unknown GETs (Single-Page / Static support)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Only bind HTTP listener when not running inside Vercel serverless functions
if (!process.env.VERCEL) {
  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Timetable Automation server running on http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
