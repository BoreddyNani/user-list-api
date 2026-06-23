require('dotenv').config();
const { getCache, setCache, deleteCache } = require('./cache');
const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const {S3Client}= require('@aws-sdk/client-s3')
const{Upload } =require( '@aws-sdk/lib-storage');
const { upload, uploadToS3 } = require('./upload.js');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { GoogleGenAI } = require('@google/genai');
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});
const cors = require('cors');
const app = express();
const port = 3000;
const { createClient } = require('redis');
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://red-d8su9d36sc1c73dtq980:6379'
});
const stripe= require('stripe')(process.env.STRIPE_SECRET_KEY)

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect().then(() => console.log('Connected to Redis!'));
// CRITICAL: Middleware to parse incoming JSON payloads
app.use(express.json());

app.use(cors({
  origin: '*', // Allows all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'], // Allowed HTTP methods
  allowedHeaders: ['Content-Type', 'Authorization']
}));


let users = [];
let nextId = 1;

const userSchema = z.object({
  name: z.string(),
  age: z.number().int().positive() // Added .int() and .positive() for better validation
});



const authRegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6)
});

const authLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const ApplicationSchema = z.object({
  company: z.string().min(1, "Company name is required"),
  role: z.string().min(1, "Role is required"),
  status: z.enum(['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'WITHDRAWN']),
  notes: z.string().optional()
});

const ResumeSchema = z.object({
  jobDescription: z.string().min(1, "Job description is required"),
  currentResume: z.string().min(1, "Current resume is required")
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.get('/users', (req, res) => {
  res.json(users);
});

app.get('/job', async (req, res) => {
  try {
    const jobApplications = await prisma.jobAplication.findMany();
    res.json(jobApplications);
  } catch (err) {
    console.error('Failed to fetch job applications:', err);
    res.status(500).json({ error: 'Failed to fetch job applications', details: err.message });
  }
});



app.post('/users', (req, res, next) => {
  try {
    // Validate incoming data
    const data = userSchema.parse(req.body);
    
    // Create the new user with a server-generated ID
    const newUser = { id: nextId++, ...data };
    users.push(newUser);
    
    res.status(201).json(newUser);
  } catch (err) {
    next(err); 
  }
});
app.post("/auth/register", async (req, res, next) => {
  try {
    const { email, name, password } = authRegisterSchema.parse(req.body);

    

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user1.create({
      data: { email, name, password: hashed }
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d"
    });
    res.status(201).json({ token });
  } catch (err) {
    next(err);
  }
});

app.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = authLoginSchema.parse(req.body);
    const user = await prisma.user1.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "secret", {
      expiresIn: "7d"
    });
    res.json({ token });
  } catch (err) {
    next(err);
  }
});

const authenticate = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const payload = jwt.verify(auth.split(" ")[1], process.env.JWT_SECRET || "secret");
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

app.get('/auth/me', authenticate, async (req, res) => {
  try {
    
    const user = await prisma.user1.findUnique({
      where: { id: req.user.userId } 
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Mint a brand new token with the current isPro status
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        name: user.name,
        isPro: user.isPro // This will now be TRUE after Stripe webhook fires!
      }, 
      process.env.JWT_SECRET, // Make sure this matches your login secret
      { expiresIn: '24h' }
    );

    // 3. Send it back to React
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user profile' });
  }
});
app.delete("/users/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = users.findIndex(u => u.id === id);
  
  if (idx === -1) {
    return res.status(404).json({ error: "Not found" });
  }
  
  users.splice(idx, 1);
  res.status(204).send();
});

// All 4 endpoints — add to your Express server
app.get("/applications", authenticate, async (req, res) => {
  const cacheKey = `applications:${req.user.userId}`;
  const cached = await getCache(cacheKey);
  if (cached) {
    console.log("CACHE HIT");
    return res.json(cached);
  }
  console.log("CACHE MISS");
  const apps = await prisma.jobApplication.findMany({
    where: { userId: req.user.userId },
    orderBy: { appliedAt: "desc" }
  });
  await setCache(cacheKey, apps);
  res.json(apps);
});

app.post("/applications", authenticate, async (req, res) => {
  const data = ApplicationSchema.parse(req.body);
  const app = await prisma.jobApplication.create({
    data: { ...data, 
      user: { connect: { id: req.user.userId } }
    }
  });
  await deleteCache(`applications:${req.user.userId}`);
  res.status(201).json(app);
});

app.patch("/applications/:id", authenticate, async (req, res) => {
  const appId = parseInt(req.params.id);
  const existingApp = await prisma.jobApplication.findUnique({ where: { id: appId } });
  if (!existingApp || existingApp.userId !== req.user.userId) {
    return res.status(403).json({ error: "Unauthorized or not found" });
  }
  const updatedApp = await prisma.jobApplication.update({
    where: { id: appId },
    data: req.body
  });

  res.json(updatedApp);
});

app.delete("/applications/:id", authenticate, async (req, res) => {
  const appId = parseInt(req.params.id);
  const existingApp = await prisma.jobApplication.findUnique({ where: { id: appId } });
  if (!existingApp || existingApp.userId !== req.user.userId) {
    return res.status(403).json({ error: "Unauthorized or not found" });
  }
  await prisma.jobApplication.delete({
    where: { id: appId }
  });

  res.status(204).send();
});

app.post("/applications/:id/resume", authenticate, upload.single("resume"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });
      const url = await uploadToS3(req.file, req.user.userId, req.params.id);
      const updated = await prisma.jobApplication.update({
        where: { id: parseInt(req.params.id), userId: req.user.userId },
        data: { resumeUrl: url }
      });
      res.json({ resumeUrl: url });
    } catch (err) { next(err); }
  }
);
//aicall
app.post('/ai/resume-tips', authenticate , async(req, res, next) => {
  try {
    
    const { jobDescription, currentResume } = ResumeSchema.parse(req.body);
    const prompt = `You are an expert resume reviewer. Job Description: ${jobDescription} Current Resume: ${currentResume} Provide exactly 5 specific, actionable resume improvement suggestions. Each suggestion must: - Reference a specific skill or requirement from the job description - Suggest concrete wording to add or change in the resume - Be under 40 words Format as a numbered list 1-5. No preamble, no conclusion.`;
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });
    
    
    res.json({ tips: response.text }); 

  } catch (err) {
    if (err.name === 'ZodError') {
      console.log("Zod Validation Failed:", err);
      return res.status(400).json({ 
        message: "Validation failed", 
        details: err.flatten()
      });
    }
    next(err);
  }
});

app.post("/create-checkout-session", authenticate, async (req, res) => {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: "Job Tracker Pro" },
        unit_amount: 900,          // $9.00 in cents
        recurring: { interval: "month" }
      },
      quantity: 1
    }],
    success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
    cancel_url:  `${process.env.FRONTEND_URL}/dashboard?cancelled=true`,
    metadata: { userId: String(req.user.userId) }  // carry user ID through
  });
  res.json({ url: session.url });
});

app.post("/webhook",
  express.raw({ type: "application/json" }),   // raw body required for sig verify
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId  = parseInt(session.metadata.userId);
      await prisma.user.update({
        where: { id: userId },
        data:  { isPro: true }
      });
      console.log(`User ${userId} upgraded to Pro`);
    }
    res.json({ received: true });
  }
);



// Global error handler
app.use((err, req, res, next) => {
  // Using instanceof is the recommended way to check for Zod errors
  if (err instanceof z.ZodError) {
    return res.status(400).json({ error: err.errors });
  }
  
  console.error(err); // Log the error for server-side debugging
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});