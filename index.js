require('dotenv').config();
const express = require('express');
const { z } = require('zod');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});
const app = express();
const port = 3000;
// CRITICAL: Middleware to parse incoming JSON payloads
app.use(express.json());

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

app.delete("/users/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = users.findIndex(u => u.id === id);
  
  if (idx === -1) {
    return res.status(404).json({ error: "Not found" });
  }
  
  users.splice(idx, 1);
  res.status(204).send();
});

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