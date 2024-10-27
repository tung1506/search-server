import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
dotenv.config();

const elasticUrl = process.env.ELASTIC_URL || "http://localhost:9200";
const esclient = new Client({ node: elasticUrl });
const songsIndex = "songs"; // Index for songs

// Exporting esclient and songsIndex
export { esclient, songsIndex, checkConnection, setSongsMapping, createIndex };

// Functions for creating index, setting mapping, and checking connection
async function createIndex(index) {
  try {
    const exists = await esclient.indices.exists({ index });
    if (!exists.body) {
      await esclient.indices.create({ index });
      console.log(`Created index ${index}`);
    } else {
      console.log(`Index ${index} already exists.`);
    }
  } catch (err) {
    console.error(`An error occurred while creating the index ${index}:`);
    console.error(err);
  }
}

async function setSongsMapping() {
  try {
    const schema = {
      properties: {
        lyrics: { type: "text" },
        title: { type: "text" },
      },
    };

    await esclient.indices.putMapping({
      index: songsIndex,
      body: schema,
    });

    console.log("Songs mapping created successfully");
  } catch (err) {
    console.error("An error occurred while setting the songs mapping:");
    console.error(err);
  }
}

async function checkConnection() {
  console.log("Checking connection to Elasticsearch...");
  try {
    await esclient.cluster.health({});
    console.log("Successfully connected to Elasticsearch");
    return true;
  } catch (err) {
    console.error("Failed to connect to Elasticsearch:");
    console.error(err);
    return false;
  }
}

// Main function to initialize the database connection
(async function main() {
  const isConnected = await checkConnection();
  if (isConnected) {
    await createIndex(songsIndex);
    await setSongsMapping();
  }
})();
