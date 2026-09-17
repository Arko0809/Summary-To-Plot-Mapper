# Multi-Brand AI Experience Platform

This repository contains two separate apps:

- `client/` — Next.js frontend for the brand experience pages and chat UI
- `agent/` — Express + TypeScript backend that powers search and plot-to-scene workflows

## Project structure

```bash
.
├── client/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env.example
├── agent/
│   ├── src/
│   ├── package.json
│   └── .env.example
├── README.md
└── .gitignore
```

## 1) Install dependencies

```bash
cd client && npm install
cd ../agent && npm install
```

## 2) Setup environment variables

Create your local environment files based on the examples:

```bash
cd client && cp .env.example .env.local
cd ../agent && cp .env.example .env
```

### Client env

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
```

### Agent env

```env
PORT=5000
ALLOWED_ORIGIN=http://localhost:3000
MODEL_PROVIDER=gemini
GOOGLE_API_KEY=your-google-key
MONGODB_URI=your-mongodb-connection-string
MONGODB_DB_NAME=company_knowledge_base
```

## 3) Run locally

Start the API first:

```bash
cd agent
npm run dev
```

Then start the frontend:

```bash
cd ../client
npm run dev
```

Open:

- Frontend: http://localhost:3000
- Backend: http://localhost:5000

## 4) Production build

Frontend build:

```bash
cd client
npm run build
npm run start
```

Backend build:

```bash
cd agent
npm run build
npm run start
```

## 5) Deploying to GitHub

1. Initialize git if needed:

```bash
git init
```

2. Add files:

```bash
git add .
```

3. Commit:

```bash
git commit -m "Initial project setup"
```

4. Create a GitHub repository and push:

```bash
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## 6) Deploying to production

### Option A: Deploy frontend on Vercel

1. Push the project to GitHub.
2. Go to https://vercel.com
3. Import the `client` folder as a Next.js app.
4. Set environment variables:
   - `NEXT_PUBLIC_API_URL` = production backend URL
   - `NEXT_PUBLIC_BACKEND_URL` = production backend URL
5. Deploy.

### Option B: Deploy backend on Render / Railway / Fly.io

1. Push the `agent` folder or a repo containing it.
2. Set the app startup command as:

```bash
npm install && npm run build && npm run start
```

3. Add environment variables:
   - `PORT`
   - `ALLOWED_ORIGIN` = your frontend domain, like `https://your-app.vercel.app`
   - `MODEL_PROVIDER`
   - `GOOGLE_API_KEY` or `GROQ_API_KEY` or `OPENAI_API_KEY`
   - `MONGODB_URI`
4. Deploy.

## Notes

- Do not commit `.env` files.
- The frontend and backend are separate deploy targets, so they should be deployed independently.
- If your frontend is hosted on Vercel and backend on Render, set the backend URL in frontend env variables to the Render public URL.
