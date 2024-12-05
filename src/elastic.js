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
        char_filter: {
          remove_special_chars: {
            type: "pattern_replace",
            pattern: "[\\p{Punct}]", // Khớp với tất cả dấu câu, ký tự đặc biệt
            replacement: " ",       // Thay thế bằng khoảng trắng
          },
        },
        analyzer: {
          custom_whitespace_analyzer: {
            type: "custom",
            char_filter: ["remove_special_chars"], // Xử lý ký tự đặc biệt
            tokenizer: "standard",              // Tách từ theo khoảng trắng
            filter: [
              "lowercase",          // Chuyển thành chữ thường
              "asciifolding",       // Loại bỏ dấu (é -> e)
            ],
          },
        },
      },
      similarity: {
        custom_bm25: {
          type: "BM25",
          k1: 1.2,
          b: 0.75,
        },
      },
    },
    mappings: {
      properties: {
        song: {
          type: "text",
          analyzer: "custom_whitespace_analyzer",
          similarity: "custom_bm25",
          copy_to: "meta",
        },
        artists: {
          type: "text",
          analyzer: "custom_whitespace_analyzer",
          similarity: "custom_bm25",
          copy_to: "meta",
        },
        lyrics: {
          type: "text",
          analyzer: "custom_whitespace_analyzer",
          similarity: "custom_bm25",
        },
        link: { type: "text", analyzer: "custom_whitespace_analyzer", similarity: "custom_bm25" },
        meta: { type: "text", analyzer: "custom_whitespace_analyzer" },
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
