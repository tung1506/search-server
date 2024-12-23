import { esclient, songsIndex } from "../elastic.js";

// Search songs using query parameter
export const search = async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  const searchBody = {
    query: {
      multi_match: {
        query,
        "fields": [
          "hashtag^1.4",
          "tendemuc^1.4",
          "tenchuong^1.4",
          "tendieu^1.5",
          "vietnamese_name^1.2",
          "_all"
        ]
      },
    },
    size: 10
  };

  try {
    const result = await esclient.search({
      body: searchBody
    });

    return res.status(200).json(result.hits.hits);
  } catch (err) {
    console.error("Error searching songs:", err);
    return res.status(500).json({ error: "An error occurred while searching." });
  }
};

// Optional: Get all songs (if needed)
export const getSongs = async (req, res) => {
    try {
      const { currentPage = 1 } = req.query;
      const pageSize = 15;
      const from = (currentPage - 1) * pageSize;
  
      const result = await esclient.search({
        index: songsIndex,
        body: {
          query: { match_all: {} },
          from,
          size: pageSize,
          _source: ["song", "artists", "link", "lyrics"],
        },
      });
  
      const hits = result.hits.hits.map((hit) => ({
        id: hit._id,
        ...hit._source,
      }));
  
      const totalHits = result.hits.total.value;
  
      return res.status(200).json({
        currentPage: parseInt(currentPage, 10),
        totalPages: Math.ceil(totalHits / pageSize),
        totalSongs: totalHits,
        pageSize,
        songs: hits,
      });
    } catch (err) {
      console.error("Error fetching songs:", err);
      return res.status(500).json({ error: "An error occurred while fetching songs." });
    }
  };
  
  
