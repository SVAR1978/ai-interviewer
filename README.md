# AI Interviewer

This repository is organized following industry-standard patterns for professional development.

## Repository Structure

### 📂 Backend (`/backend`)
The backend is built with Node.js, Express, and TypeScript, following a clean architecture:

- **`src/config/`**: Contains environment variable management and database connection setup.
- **`src/controllers/`**: Handles the business logic for each route.
- **`src/models/`**: Defines MongoDB schemas using Mongoose.
- **`src/middleware/`**: Custom middleware for things like JWT authentication.
- **`src/routes/`**: Defines the API endpoints and connects them to respective controllers.
- **`src/app.ts`**: Configures the Express application, middleware, and base routes.
- **`src/index.ts`**: The main entry point that starts the server and connects to the database.

**Scripts:**
- `npm run dev`: Starts the development server using `ts-node-dev`.
- `npm run build`: Compiles the TypeScript code to JavaScript.
- `npm start`: Starts the compiled server.

### 📂 Frontend (`/frontend`)
The frontend is structured to keep source code and assets organized:

- **`src/assets/`**: All images, icons, and video files.
- **`src/css/`**: All CSS stylesheets.
- **`src/js/`**: All JavaScript logic (organized for feature-based development).
- **HTML Files**: Core page templates located in the root for direct access.

## Tech Stack
- **Backend**: Node.js, Express, TypeScript, MongoDB, Mongoose, JWT, Gemini API, AssemblyAI.
- **Frontend**: HTML5, CSS3, Vanilla JavaScript.

## How to Run

### Backend
1. `cd backend`
2. `npm install`
3. Create a `.env` file based on your environment needs.
4. `npm run dev`

### Frontend
1. Open the HTML files in your browser or use a live server for the best experience.
