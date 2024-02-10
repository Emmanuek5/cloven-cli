#!/usr/bin/env node
const args = process.argv.slice(2);
const path = require("path");
const fs = require("fs");
if (!fs.existsSync(path.join(__dirname, "config.json"))) {
  const defaultConfig = {
    api_key: "",
    panel_url: "https://manage.clovenbots.com/",
    sftp_password: "",
  };
  fs.writeFileSync(
    path.join(__dirname, "config.json"),
    JSON.stringify(defaultConfig)
  );
}
const config = require("./config.json");

const configReader = require("./utils/configReader");
const Client = require("./client");
const archiver = require("archiver");
const colors = require("colors");
const cliProgress = require("cli-progress");
const SftpClient = require("ssh2-sftp-client");
const readline = require("readline");
const spinners = require("cli-spinners");
const {
  createProgressBar,
  createSpinner,
  uploadToServer,
  deCompressFileOnServer,
  deleteFilesFromServer,
  formatBytes,
  formatCpuAbsolute,
  formatMegabytes,
} = require("./utils/functions");
const { exec } = require("child_process");
const { ServerBuilder } = require("nodeactyl");
const logger = {
  info: (message) => {
    console.log(green(message));
  },
  error: (message) => {
    console.log(red(message));
  },
  warn: (message) => {
    console.log(yellow(message));
  },
};

if (config.api_key === "YOUR_API_KEY" || !config.api_key) {
  logger.error("To use the Cloven CLI, you need to set your API key.");
  logger.error(
    "To Get your API key, visit: https://manage.clovenbots.com/account/api"
  );
  logger.error("Then run: cloven login <YOUR_API_KEY>");
  process.exit(1);
}

const client = new Client({
  api_key: config.api_key,
  panel_url: config.panel_url,
});

function getPassword() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Enter your SFTP password: ", (password) => {
      rl.close();
      resolve(password);
    });
  });
}

async function getRestart() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Do you want to restart the server? (y/n): ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
// Aliases for colorized console output
const green = colors.green;
const red = colors.red;
const yellow = colors.yellow;

if (args[0] === "login") {
  config.api_key = args[1];
  fs.writeFileSync(path.join(__dirname, "config.json"), JSON.stringify(config));
  console.log(green("API key set successfully"));
  process.exit(1);
}

if (args[0] === "set_api_key") {
  config.api_key = args[1];
  fs.writeFileSync(path.join(__dirname, "config.json"), JSON.stringify(config));
  console.log(green("API key set successfully"));
  process.exit(1);
}
if (args[0] === "create_config") {
  const config = `SERVER_ID = YOUR_SERVER_ID`;
  fs.writeFileSync(path.join(process.cwd(), ".cloven_config"), config);
  console.log(green("Created .cloven_config file"));
  process.exit(1);
}

if (args[0] === "init") {
  let spinner = createSpinner(
    "Initializing a new cloven nodejs environment..."
  );
  try {
    //initialize a new nodejs environment but include the .cloven_config file
    const cloven_file = path.join(process.cwd(), ".cloven_config");
    if (!fs.existsSync(cloven_file)) {
      fs.writeFileSync(
        path.join(process.cwd(), ".cloven_config"),
        fs.readFileSync(path.join(__dirname, "default.cloven_config"), "utf8")
      );
    }
    logger.info("Initializing nodejs environment...");
    exec("npm init -y", (error, stdout, stderr) => {
      if (error) {
        logger.error(`error: ${error.message}`);
        return;
      }
      if (stderr) {
        logger.error(`stderr: ${stderr}`);
        return;
      }
    });
    let message = "";
    message += colors.white(
      "Go to https://manage.clovenbots.com/ and create a new server"
    );
    message += "\n";
    message += colors.white(
      "Then copy the server ID and paste it in the .cloven_config file"
    );
    message += "\n";
    message += colors.white("Done. Run: npm start");
    logger.info(colors.blue(message));
    fs.writeFileSync(path.join(process.cwd(), "index.js"), "");
    spinner.succeed("Initialized a new cloven nodejs environment");
  } catch (error) {
    spinner.fail("Failed to initialize a new cloven nodejs environment");
    console.log(error);
  }
  return;
}

if (args[0] === "upload") {
  const cloven_file = path.join(process.cwd(), ".cloven_config");
  if (!fs.existsSync(cloven_file)) {
    console.log(red("No .cloven_config file found"));
    console.log("Run: create_config to create a default one");
    process.exit(1);
  }
  const server_Config = configReader(fs.readFileSync(cloven_file, "utf8"));

  if (!server_Config.SERVER_ID) {
    console.log(red("SERVER_ID not found in .cloven_config file"));
    process.exit(1);
  }
  if (config.api_key === "YOUR_API_KEY" || !config.api_key) {
    console.log(red("You need to set up your api key."));
    console.log("Run: set_api_key <api_key>");
    process.exit(1);
  }

  client
    .getServerDetails(server_Config.SERVER_ID)
    .then(async (server) => {
      const sftp_details = {
        address: server.sftp_details.ip,
        port: server.sftp_details.port,
        username: "",
      };
      const user_details = await client.client.getAccountDetails();
      sftp_details.username = user_details.username + "." + server.identifier;
      const sftp = new SftpClient();
      try {
        await sftp.connect({
          host: sftp_details.address,
          port: sftp_details.port,
          username: sftp_details.username,
          password: config.sftp_password,
        });
      } catch (connectError) {
        if (connectError.message.includes("authentication")) {
          const password = await getPassword();
          await sftp
            .connect({
              host: sftp_details.address,
              port: sftp_details.port,
              username: sftp_details.username,
              password,
            })
            .catch((error) => {
              logger.error(`SFTP Connect Error: ${error.message}`);
              return;
            });
          config.sftp_password = password;
          fs.writeFileSync(
            path.join(__dirname, "config.json"),
            JSON.stringify(config)
          );
        } else {
          logger.error(`SFTP Connect Error: ${connectError.message}`);
          return;
        }
      }

      try {
        // Create a zip file excluding .node_modules directory
        const zipFileName = "archive.zip";
        if (fs.existsSync(zipFileName)) {
          fs.unlinkSync(zipFileName);
        }
        const output = fs.createWriteStream(zipFileName);
        const archive = archiver("zip");
        output.on("close", async () => {
          logger.info("Project has been compressed, uploading...");

          // Specify the remote path where you want to upload the file
          const remoteFilePath = "/" + zipFileName;
          const uploadingSpinner = createSpinner(
            "Uploading files to server..."
          );
          try {
            await uploadToServer(zipFileName, remoteFilePath, sftp);
            uploadingSpinner.succeed("Files uploaded successfully.");

            const decompressSpinner = createSpinner(
              "Decompressing files on server..."
            );
            await client.deCompressFileOnServer(server.identifier, zipFileName);
            decompressSpinner.succeed("Files decompressed on server.");

            const deleteSpinner = createSpinner(
              "Deleting temporary files on server..."
            );
            await client.deleteFilesFromServer(server.identifier, [
              zipFileName,
            ]);
            deleteSpinner.succeed("Temporary files deleted on server.");

            const restart = await getRestart();
            if (restart) {
              const restartSpinner = createSpinner("Restarting server...");
              await client.restartServer(server.identifier);
              restartSpinner.succeed("Server restarted successfully.");
              logger.info("Server has been restarted.");
            }
          } catch (error) {
            uploadingSpinner.fail(`File upload failed. ${red(error.message)}`);
            logger.error(`File upload failed. ${error.message}`);
          } finally {
            // Disconnect the SFTP client
            await sftp.end();
          }

          return;
        });

        archive.pipe(output);

        // Add all files in the current directory to the archive excluding .node_modules
        const ignore = [
          "node_modules/**",
          "node_modules",
          ".cloven_config",
          zipFileName,
          ...(Array.isArray(server_Config.SKIP_FILES)
            ? server_Config.SKIP_FILES
            : server_Config.SKIP_FILES.split(",").map((file) => file.trim())),
        ];
        archive.glob("**/*", { ignore });
        const progressBar = createProgressBar(1);
        progressBar.start(1, 0);

        archive.on("progress", (progress) => {
          if (progress.eta < 0) {
            progressBar.update(progress.entries.processed, {
              eta: "Calculating...",
            });
          } else {
            progressBar.update(progress.entries.processed);
          }
        });

        await archive.finalize();
        progressBar.stop();
      } catch (error) {
        console.log(red(error));
      }
    })
    .catch((err) => {
      console.log(red(err));
    });

  return;
}

if (args[0] === "usage") {
  let cloven_file = path.join(process.cwd(), ".cloven_config");
  let server_id = "";

  if (args[1]) {
    server_id = args[1];
  }

  if (!args[1] && !server_id) {
    if (!fs.existsSync(cloven_file)) {
      logger.error("Please create a .cloven_config file");
      process.exit(1);
    }

    const server_Config = configReader(fs.readFileSync(cloven_file, "utf8"));
    server_id = server_Config.SERVER_ID;
  }

  if (server_id == "YOUR_SERVER_ID" || server_id == "" || !server_id) {
    logger.error("Please provide a valid server id");
    process.exit(1);
  }

  const spinner = createSpinner("Fetching server usage...");

  try {
    let available_resources = client
      .getServerDetails(server_id)
      .then((details) => {
        available_resources = details.limits;
        const serverUsage = client.getServerUsages(server_id).then((usage) => {
          spinner.succeed("Server usage fetched successfully.");
          let serverUsage = usage;

          const status =
            serverUsage.current_state === "running"
              ? "Status: running"
              : "Status: " + serverUsage.current_state;
          const cpu = `CPU: ${formatCpuAbsolute(
            serverUsage.resources.cpu_absolute,
            available_resources.cpu
          )}%`;
          const ram = `RAM: ${formatBytes(
            serverUsage.resources.memory_bytes
          )} / ${formatMegabytes(available_resources.memory)}`;
          const disk = `Disk: ${formatBytes(
            serverUsage.resources.disk_bytes
          )} / ${formatMegabytes(available_resources.disk)}`;
          const network = `Network -> In: ${formatBytes(
            serverUsage.resources.network_rx_bytes
          )} Out: ${formatBytes(serverUsage.resources.network_tx_bytes)}`;

          let message = "--------------------------------";
          message += "\n";
          message += status;
          message += "\n";
          message += cpu;
          message += "\n";
          message += ram;
          message += "\n";
          message += disk;
          message += "\n";
          message += network;
          message += "\n";
          message += "--------------------------------";
          logger.info(message);
        });
      });
  } catch (err) {
    spinner.fail("Failed to fetch server usage.");
    console.log(err);
  }

  return;
}

if (args[0] === "restart") {
  let server_id = "";
  if (args[1]) {
    server_id = args[1];
  }
  if (!args[1] && !server_id) {
    let cloven_file = path.join(process.cwd(), ".cloven_config");
    if (!fs.existsSync(cloven_file)) {
      logger.error(
        "Please create a .cloven_config file or provide a server id in the arguments"
      );
      process.exit(1);
    } else {
      const server_Config = configReader(fs.readFileSync(cloven_file, "utf8"));
      server_id = server_Config.SERVER_ID;
    }
  }
  if (server_id == "YOUR_SERVER_ID" || server_id == "" || !server_id) {
    logger.error("Please provide a valid server id");
    process.exit(1);
  }

  const spinner = createSpinner("Restarting server...");
  client
    .restartServer(server_id)
    .then((result) => {
      //get the server info
      client.getServerDetails(server_id).then((details) => {
        spinner.succeed(
          "Server: '" + colors.blue(details.name) + "' restarted successfully."
        );
      });
    })
    .catch((err) => {
      logger.error(err);
      spinner.fail("Failed to restart server.");
    });
  return;
}

if (args[0] == "stop") {
  let server_id = "";
  if (args[1]) {
    server_id = args[1];
  }
  if (!args[1] && !server_id) {
    let cloven_file = path.join(process.cwd(), ".cloven_config");
    if (!fs.existsSync(cloven_file)) {
      logger.error(
        "Please create a .cloven_config file or provide a server id in the arguments"
      );
      process.exit(1);
    } else {
      const server_Config = configReader(fs.readFileSync(cloven_file, "utf8"));
      server_id = server_Config.SERVER_ID;
    }
  }
  if (server_id == "YOUR_SERVER_ID" || server_id == "" || !server_id) {
    logger.error("Please provide a valid server id");
    process.exit(1);
  }

  let spinner = createSpinner("Stopping server...");
  client
    .stopServer(server_id)
    .then((result) => {
      //get the server info
      client.getServerDetails(server_id).then((details) => {
        spinner.succeed(
          "Server: '" + colors.blue(details.name) + "' stopped successfully."
        );
      });
    })
    .catch((err) => {
      logger.error(err);
      spinner.fail("Failed to stop server.");
    });
  return;
}

if (args[0] == "start") {
  let server_id = "";
  if (args[1]) {
    server_id = args[1];
  }
  if (!args[1] && !server_id) {
    let cloven_file = path.join(process.cwd(), ".cloven_config");
    if (!fs.existsSync(cloven_file)) {
      logger.error(
        "Please create a .cloven_config file or provide a server id in the arguments"
      );
      process.exit(1);
    } else {
      const server_Config = configReader(fs.readFileSync(cloven_file, "utf8"));
      server_id = server_Config.SERVER_ID;
    }
  }
  if (server_id == "YOUR_SERVER_ID" || server_id == "" || !server_id) {
    logger.error("Please provide a valid server id");
    process.exit(1);
  }

  let spinner = createSpinner("Starting server...");
  client.startServer(server_id).then((result) => {
    //get the server info
    client.getServerDetails(server_id).then((details) => {
      spinner.succeed(
        "Server: '" + colors.blue(details.name) + "' started successfully."
      );
    });
  });
  return;
}

if (args[0] == "status") {
  let server_id = "";
  if (args[1]) {
    server_id = args[1];
  }
  if (!args[1] && !server_id) {
    let cloven_file = path.join(process.cwd(), ".cloven_config");
    if (!fs.existsSync(cloven_file)) {
      logger.error(
        "Please create a .cloven_config file or provide a server id in the arguments"
      );
      process.exit(1);
    } else {
      const server_Config = configReader(fs.readFileSync(cloven_file, "utf8"));
      server_id = server_Config.SERVER_ID;
    }
  }
  if (server_id == "YOUR_SERVER_ID" || server_id == "" || !server_id) {
    logger.error("Please provide a valid server id");
    process.exit(1);
  }
  let spinner = createSpinner("Fetching server status...");
  client.getServerStatus(server_id).then((result) => {
    client.getServerDetails(server_id).then((details) => {
      let status =
        result === "running"
          ? colors.cyan(colors.bold("Online"))
          : result === "starting"
          ? colors.yellow("Starting")
          : colors.red("Offline");
      spinner.succeed(
        "Server: '" + colors.blue(details.name) + "' Status: `" + status + "`"
      );
    });
  });
  return;
}

if (args[0] === "help") {
  let commands = [
    {
      name: "start",
      args: ["server_id"],
      description: "Start an existing server",
    },
    {
      name: "stop",
      args: ["server_id"],
      description: "Stop an existing server",
    },
    {
      name: "usage",
      args: ["server_id"],
      description: "Get the Server usage of an existing server",
    },
    {
      name: "status",
      args: ["server_id"],
      description: "Get the status of an existing server",
    },
    {
      name: "upload",
      description: "Uploads the current directory to the server",
    },
    {
      name: "login",
      args: ["api_key"],
      description: "Login to the cli tool",
    },
    {
      name: "help",
      description: "Get help",
    },
  ];
  let message = "";
  message += "Cloven CLI Tool\n";
  message += "Panel: https://manage.clovenbots.com/ \n";
  message += "Discord: https://discord.gg/nqMX9XWh \n";
  message += "Usage: cloven <command> [options]\n";
  message += "Available commands:\n";
  commands.forEach((command) => {
    message += "  " + command.name + "\n";
    if (command.args) {
      message += "    Arguments: " + command.args.join(", ") + "\n";
    }
    message += "    " + command.description + "\n";
  });
  console.log(message);

  process.exit(1);
}

console.log(red("Invalid Command. Run: cloven help for more info"));
