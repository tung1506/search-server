import { songsIndex as __index, esclient } from "../elastic.js";
import songs from './songs.json' assert { type: 'json' };

const createESAction = (index) => ({
  index: {
    _index: index,
  }
});

async function populateDatabase() {
  const docs = [];

  for (const song of songs) {
    docs.push(createESAction(__index)); // Create a new action for each song
    docs.push({
      song: song.song,
      artists: song.artists,
      link: song.link,
      lyrics: song.lyrics
    });
  }

  try {
    const response = await esclient.bulk({ body: docs });
    console.log(`Successfully indexed ${response.items.length} songs`);
  } catch (err) {
    console.error("An error occurred while populating the database:");
    console.error(err);
  }
}

export default {
  populateDatabase,
};
