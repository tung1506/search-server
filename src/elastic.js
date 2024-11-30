import { Client } from "@elastic/elasticsearch";
import dotenv from "dotenv";
dotenv.config();

const elasticUrl = process.env.ELASTIC_URL || "http://localhost:9200";
const esclient = new Client({ node: elasticUrl });
const songsIndex = "songs";

export { esclient, songsIndex, checkConnection, createSongsIndex };

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

async function createSongsIndex() {
  const settings = {
    settings: {
      analysis: {
        analyzer: {
          custom_lowercase_analyzer: {
            type: "custom",
            tokenizer: "standard",
            filter: ["lowercase", "punctuation_remover", "my_stemmer"],
          },
          artist_analyzer: {
            type: "custom",
            tokenizer: "comma_and_tokenizer",
            filter: [
              "lowercase",
              "punctuation_remover",
              "my_stemmer",
              "remove_whitespace",
              "asciifolding",
            ],
          },
        },
        tokenizer: {
          comma_and_tokenizer: {
            type: "pattern",
            pattern: "[,\\&]",
          },
        },
        filter: {
          punctuation_remover: {
            type: "pattern_replace",
            pattern: "[\\p{Punct}]",
            replacement: " ",
          },
          my_stemmer: {
            type: "stemmer",
            language: "english",
          },
          remove_whitespace: {
            type: "pattern_replace",
            pattern: "\\s+",
            replacement: "",
          },
        },
      },
      similarity: {
        custom_bm25: {
          type: "BM25",
          k1: 1.6,
          b: 0.5,
        },
      },
    },
    mappings: {
      properties: {
        song: {
          type: "text",
          analyzer: "custom_lowercase_analyzer",
          copy_to: "meta",
        },
        artists: {
          type: "text",
          analyzer: "artist_analyzer",
          copy_to: "meta",
        },
        lyrics: {
          type: "text",
          analyzer: "custom_lowercase_analyzer",
          similarity: "custom_bm25",
        },
        link: { type: "text", analyzer: "custom_lowercase_analyzer" },
        meta: { type: "text", analyzer: "custom_lowercase_analyzer" },
      },
    },
  };

  try {
    const exists = await esclient.indices.exists({ index: songsIndex });
    if (exists.body) {
      await esclient.indices.delete({ index: songsIndex });
      console.log(`Deleted existing index ${songsIndex}`);
    }

    await esclient.indices.create({
      index: songsIndex,
      body: settings,
    });

    console.log(`Created new index ${songsIndex} with mappings and settings`);
  } catch (err) {
    console.error("Error creating index:", err);
  }
}

(async function main() {
  const isConnected = await checkConnection();
  const isIndexExisted = await esclient.indices.exists({index: songsIndex});
  if (isConnected && !isIndexExisted) {
    await createSongsIndex(songsIndex);
  }
})();
