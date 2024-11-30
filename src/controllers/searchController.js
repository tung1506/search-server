import { esclient, songsIndex } from "../elastic.js";

// Search songs using query parameter
export const searchSongs = async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Query parameter 'q' is required." });
  }

  const searchBody = {
    query: {
      multi_match: {
        query,
        fields: [
          "meta^2.3",
          "song^2.5",
          "artists^2.2",
          "lyrics^1.2",
          "link^1",
        ],
        type: "best_fields",
        operator: "or",
        fuzziness: "AUTO",
      },
    },
    size: 10,
    _source: ["song", "artists", "link", "lyrics"],
  };

  try {
    const result = await esclient.search({
      index: songsIndex,
      body: searchBody,
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
  
  
