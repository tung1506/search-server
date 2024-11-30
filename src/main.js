import { checkConnection, esclient, songsIndex as _index } from "./elastic.js";
import server from './server/index.js'; 
import data from "./data/index.js";
import dotenv from "dotenv";
dotenv.config();


(async function main() {

  const isElasticReady = await checkConnection();

  if (isElasticReady) {

    const elasticIndex = await esclient.indices.exists({index: _index});

    if (!elasticIndex) {
      await data.populateDatabase()
    }

    server.start();

  }

})();