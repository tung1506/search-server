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

  // Chuẩn hóa dữ liệu
  sampleData = normalizeData(sampleData);

  for (let key of Object.keys(sampleData)) {
      properties[key] = { 
        type: "text", 
        analyzer: "custom_whitespace_analyzer" 
      }

    properties[key].similarity = "custom_bm25";
  }

  return { properties };
}

function normalizeData(data) {
  // Các key cần gộp vào hashtag
  const keysToMerge = [
    "tenchude", 
    "tendemuc", 
    "tenchuong", 
    "tendieu", 
    "scientific_name", 
    "vietnamese_name", 
    "other_names", 
    "division", 
    "division_description", 
    "_class", 
    "_class_description", 
    "order", 
    "order_description", 
    "family", 
    "family_description", 
    "genus", 
    "genus_description",
    "song",
    "artists",
    "animalName",
    "categories",
    "blogName",
    "tags",
    "newsName",
    "newsDescription",
    "category",
    "blogDescription",
    "keywords",
    "poemName",
    "Author"
  ];
  
  let hashtagValue = "";

  // Gộp giá trị của các trường cần thiết vào hashtag
  for (let key of keysToMerge) {
    if (data[key]) {
      // Nếu giá trị là mảng, nối các phần tử lại thành chuỗi
      if (Array.isArray(data[key])) {
        const joinedValues = data[key]
          .filter((item) => item) // Loại bỏ giá trị null/undefined trong mảng
          .map((item) => item.trim()) // Loại bỏ khoảng trắng thừa ở mỗi phần tử
          .join(", ");
        hashtagValue += (hashtagValue ? ", " : "") + joinedValues;
      }
      // Nếu giá trị là chuỗi, thêm vào trực tiếp
      else if (typeof data[key] === "string") {
        hashtagValue += (hashtagValue ? ", " : "") + data[key].trim();
      }
    }
  }

  // Thêm trường hashtag mà không xóa các trường cũ
  if (hashtagValue) {
    data["hashtag"] = hashtagValue.toLowerCase(); // Chuyển hashtag thành chữ thường
  }

  // Chuẩn hóa giá trị của tất cả các trường (loại bỏ khoảng trắng thừa)
  for (let key of Object.keys(data)) {
    if (typeof data[key] === "string") {
      data[key] = data[key].trim();
    }
  }

  return data;
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

    // Load dữ liệu gốc từ file JSON
    const rawData = await loadJSON(filePath);

    if (rawData.length > 0) {
      // Normalize toàn bộ dữ liệu và thêm trường hashtag
      const normalizedData = rawData.map((item) => normalizeData(item));

      // Sử dụng dữ liệu mẫu để tạo dynamic index
      const sampleData = normalizedData[0];
      await createDynamicIndex(indexName, sampleData);

      // Chuẩn bị body để index bằng bulk API
      const docs = [];
      for (const item of normalizedData) {
        docs.push({
          index: {
            _index: indexName,
          },
        });
        docs.push(item); // Dữ liệu đã chuẩn hóa
      }

      try {
        const response = await esclient.bulk({ body: docs });
        console.log(`Successfully indexed ${response.items.length} items to ${indexName}`);
      } catch (err) {
        console.error(`Error indexing data to ${indexName}:`, err);
      }
    } else {
      console.warn(`File ${jsonFile} is empty or invalid.`);
      continue;
    }
  }
}


export default {
  populateDatabase,
};
