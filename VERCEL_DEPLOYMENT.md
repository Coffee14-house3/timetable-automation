# Deployment Guide for Vercel

This repository is already configured to deploy seamlessly to **Vercel** with support for both static HTML pages and serverless Express `/api/*` endpoints.

---

## Prerequisites
1. A [Vercel account](https://vercel.com).
2. A [GitHub](https://github.com) account (or GitLab / Bitbucket).
3. (Optional) A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) database connection string. If omitted, the app will run with an in-memory database store.

---

## Method 1: Deploy via Vercel Web Dashboard (Recommended)

### Step 1: Export or Push the Code to GitHub
1. In Google AI Studio, click the top-right settings menu (`...` or Settings) and select **"Export to GitHub"** (or download as a ZIP and push to a new GitHub repository).

### Step 2: Import Project into Vercel
1. Log in to [vercel.com](https://vercel.com).
2. Click **"Add New..."** > **"Project"**.
3. Select your exported GitHub repository and click **"Import"**.

### Step 3: Configure Project Settings
- **Framework Preset**: Leave as **Other** (or automatic).
- **Root Directory**: `./` (default).
- **Build and Output Settings**: Defaults are already configured (`npm run build` / standard root static files).

### Step 4: Environment Variables
Under **Environment Variables**, add:
- `MONGO_URI`: Your MongoDB Atlas connection URI (e.g. `mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/timetableDB?retryWrites=true&w=majority`).
- `GEMINI_API_KEY`: (Optional) If using Gemini AI features.

### Step 5: Deploy
Click **"Deploy"**. Vercel will build and launch your application in less than a minute!

---

## Method 2: Deploy using Vercel CLI

If you have Node.js and the Vercel CLI installed locally:

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Login to your Vercel account
vercel login

# 3. Deploy to preview
vercel

# 4. Deploy to production
vercel --prod
```

When prompted:
- Set up and deploy? **Yes**
- Which scope? **Select your account or team**
- Link to existing project? **No**
- Project name: **timetable-automation** (or your preferred name)
- In which directory is your code located? `./`
- Auto-detect project settings: **Yes**

---

## Architecture Details for Vercel
- **Static Pages**: `index.html`, `hod.html`, `teacher.html`, `coordinator.html`, `syllabus.html`, etc. are served directly as static assets.
- **Serverless API**: Requests to `/api/*` are routed through `/api/index.js` (defined in `vercel.json`), which wraps `server.js` with serverless connection caching for MongoDB Atlas.
