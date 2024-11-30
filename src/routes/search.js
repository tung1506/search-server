import express from "express";
import { getSongs, searchSongs } from "../controllers/searchController.js";

const router = express.Router();

router.get("/search", searchSongs);
router.get("/", getSongs);

export default router;
