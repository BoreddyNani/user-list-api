
const request = require('supertest');
const { app, prisma } = require('./index');

beforeEach(async () => {
  await prisma.jobApplication.deleteMany();
  await prisma.user1.deleteMany(); // clean slate per test
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /auth/register', () => {
  it('returns 201 and user object on valid input', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'test1@gmail.com',
      name: 'Tarun',
      password: 'nani143'
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe('test1@gmail.com');
    expect(res.body).not.toHaveProperty('password'); // never expose hash
  });

  it('returns 409 on duplicate email', async () => {
    await request(app).post('/auth/register')
      .send({ email: 'test1@gmail.com', name: 'Test User', password: 'nani143' });
    const res = await request(app).post('/auth/register')
      .send({ email: 'test1@gmail.com', name: 'Test User', password: 'different' });
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/auth/register')
      .send({ email: 'test1@gmail.com', name: 'Test User', password: 'nani143' });
  });

  it('returns 200 and JWT on valid credentials', async () => {
    const res = await request(app).post('/auth/login')
      .send({ email: 'test1@gmail.com', password: 'nani143' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app).post('/auth/login')
      .send({ email: 'test1@gmail.com', password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });
});