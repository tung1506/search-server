import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
dotenv.config();

const elasticUrl = process.env.ELASTIC_URL || "http://localhost:9200";
const esclient = new Client({ node: elasticUrl });
const songsIndex = "songs";

export { esclient, songsIndex, checkConnection };

async function checkConnection() {
  console.log("Checking connection to Elasticsearch...");
  try {
    await esclient.cluster.health({});
    console.log("Successfully connected to Elasticsearch");
    return true;
  } catch (err) {
    console.error("Failed to connect to Elasticsearch:", err);
    return false;
  }
}
