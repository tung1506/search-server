import { esclient } from "../elastic.js";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

// Hàm load file JSON
async function loadJSON(filePath) {
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data);
}

// Lấy danh sách các file JSON (trừ `songs.json`)
const jsonDirectory = "./src/data/";
async function getJSONFiles() {
  const files = await fs.readdir(jsonDirectory);
  return files.filter((file) => file.endsWith(".json") && file !== "songs.json");
}

// Hàm để tự động sinh mapping từ dữ liệu mẫu
function generateDynamicMapping(sampleData) {
  const properties = {};

  for (const key of Object.keys(sampleData)) {
    properties[key] = { type: "text", analyzer: "custom_whitespace_analyzer" };
    properties[key].similarity = "custom_bm25";
  }
  
  return { properties };
}


// Tạo index động dựa trên tên file và dữ liệu mẫu
async function createDynamicIndex(indexName, sampleData) {
  try {
    const exists = await esclient.indices.exists({ index: indexName });

    if (!exists) {
      const mappings = generateDynamicMapping(sampleData);

      await esclient.indices.create({
        index: indexName,
        body: {
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
                    "word_delimiter"
                  ],
                },
              },
            },
            similarity: {
              custom_bm25: {
                type: "BM25",
                k1: 1.1,
                b: 0.5,
              },
            },
          },
          mappings,
        },
      });

      console.log(`Created dynamic index: ${indexName}`);
    } else {
      console.log(`Index ${indexName} already exists`);
    }
  } catch (err) {
    console.error(`Error creating dynamic index: ${indexName}`, err);
  }
}


// Hàm để lấy index name từ tên file JSON
const getIndexNameFromFile = (filePath) => {
  const fileName = path.basename(filePath, ".json");
  return fileName.toLowerCase();
};

// Populate database từ tất cả file JSON
async function populateDatabase() {
  const jsonFiles = await getJSONFiles();

  for (const jsonFile of jsonFiles) {
    const indexName = getIndexNameFromFile(jsonFile);
    const filePath = path.join(jsonDirectory, jsonFile);

    if (!existsSync(filePath)) {
      console.warn(`File ${filePath} does not exist.`);
      continue;
    }

    const data = await loadJSON(filePath);

    if (data.length > 0) {
      const sampleData = data[0];
      await createDynamicIndex(indexName, sampleData);
    } else {
      console.warn(`File ${jsonFile} is empty or invalid.`);
      continue;
    }

    const docs = [];
    for (const item of data) {
      docs.push({
        index: {
          _index: indexName,
        },
      });
      docs.push(item);
    }

    try {
      const response = await esclient.bulk({ body: docs });
      console.log(`Successfully indexed ${response.items.length} items to ${indexName}`);
    } catch (err) {
      console.error(`Error indexing data to ${indexName}:`, err);
    }
  }

  // Đặc biệt xử lý file songs.json
  const songsFile = path.join(jsonDirectory, "songs.json");
  const songsIndex = "songs";

  if (existsSync(songsFile)) {
    const songs = await loadJSON(songsFile);

    const docs = [];
    for (const song of songs) {
      docs.push({
        index: {
          _index: songsIndex,
        },
      });
      docs.push({
        song: song.song,
        artists: song.artists,
        link: song.link,
        lyrics: song.lyrics,
      });
    }

    try {
      const response = await esclient.bulk({ body: docs });
      console.log(`Successfully indexed ${response.items.length} songs to ${songsIndex}`);
    } catch (err) {
      console.error("An error occurred while populating the songs database:", err);
    }
  } else {
    console.warn(`File ${songsFile} does not exist.`);
  }
}

export default {
  populateDatabase,
};
