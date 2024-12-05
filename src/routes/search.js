import express from "express";
import { getSongs, search } from "../controllers/searchController.js";

const router = express.Router();

router.get("/search", search);
router.get("/", getSongs);

export default router;
