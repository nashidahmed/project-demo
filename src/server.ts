import dotenv from "dotenv";
import express, { Application } from "express";
import cors from "cors";

// Load environment variables
dotenv.config();

export const createServer = (
  port: number,
  routes?: (app: Application) => void
): Application => {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // Attach custom routes
  if (routes && typeof routes === "function") {
    routes(app);
  }

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });

  return app;
};
