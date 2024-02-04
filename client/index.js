const Nodeactyl = require("nodeactyl");
class Client extends Nodeactyl.NodeactylClient {
  /**
   * constructor - A constructor for initializing the API key and client.
   *
   * @param {} config - The configuration object containing api_key and panel_url.
   * @return {void}
   */
  constructor(config) {
    super(config.panel_url, config.api_key);
    this.api_key = config.api_key;
    this.config = config;

    this.client = this;
  }

  deCompressFileOnServer(server_id, zipFileName, root = "/") {
    const config = this.config;
    fetch(
      config.panel_url +
        "api/client" +
        "/servers/" +
        server_id +
        "/files/decompress",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.api_key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          root: root,
          file: zipFileName,
        }),
      }
    );
  }

  /**
   * Decompresses a file on the server according to the provided configuration.
   *
   * @param {config} config - the configuration for file decompression
   * @return {void}
   */

  deleteFilesFromServer(server_id, files, root = "/") {
    const config = this.config;
    fetch(
      config.panel_url +
        "api/client" +
        "/servers/" +
        server_id +
        "/files/delete",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.api_key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          root: root,
          files,
        }),
      }
    );
  }
}

module.exports = Client;
