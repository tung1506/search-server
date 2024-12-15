import { esclient } from "../elastic.js";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

// Hàm load file JSON
async function loadJSON(filePath) {
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data);
}

// Lấy danh sách các file JSON
const jsonDirectory = "./src/data/";
async function getJSONFiles() {
  const files = await fs.readdir(jsonDirectory);
  return files.filter((file) => file.endsWith(".json"));
}

// Hàm để tự động sinh mapping từ dữ liệu mẫu
function generateDynamicMapping(sampleData) {
  const properties = {};

  for (let key of Object.keys(sampleData)) {
    if (key === "hashtag") {
      // Trường chính 'hashtag'
      properties[key] = { 
        type: "text", 
        analyzer: "custom_whitespace_analyzer"
      };
      
      // Thêm trường phụ 'suggest' cho 'hashtag' sử dụng custom_trigram_analyzer
      properties[key].fields = {
        suggest: {
          type: "text",
          analyzer: "custom_trigram_analyzer"
        }
      }
    } else {
      properties[key] = { 
        type: "text", 
        analyzer: "custom_whitespace_analyzer" 
      };
    }

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
              filter: {
                shingle: {
                  type: "shingle",
                  min_shingle_size: 2,
                  max_shingle_size: 3
                }
              },
              char_filter: {
                remove_special_chars: {
                  type: "pattern_replace",
                  pattern: "[\\p{Punct}]",
                  replacement: " ",
                },
              },
              analyzer: {
                custom_whitespace_analyzer: {
                  type: "custom",
                  char_filter: ["remove_special_chars"],
                  tokenizer: "standard",
                  filter: [
                    "lowercase",
                    "asciifolding",
                    "word_delimiter"
                  ],
                },
                custom_trigram_analyzer: {
                  type: "custom",
                  char_filter: ["remove_special_chars"],
                  tokenizer: "standard",
                  filter: [
                    "lowercase",
                    "word_delimiter",
                    "shingle"
                  ],
                }
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
}

export default {
  populateDatabase,
};
