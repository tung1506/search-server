import express, { urlencoded, json } from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const port = process.env.NODE_PORT || 3000;

/**
 * @function start
 * @returns {void}
 * @description Starts the HTTP Express server.
 */
function start() {
  app.use(cors());
  app.use(urlencoded({ extended: false }));
  app.use(json());

  app.use((_req, res) =>
    res.status(404).json({ success: false, error: "Route not found" })
  );

  app.listen(port, () => console.log(`Server ready on port ${port}`));
}

export default {
  start,
};
