const config = require("../config.json");
const colors = require("colors");
const cliProgress = require("cli-progress");
const readline = require("readline");
const spinners = require("cli-spinners");

const green = colors.green;
const red = colors.red;
const yellow = colors.yellow;

function createProgressBar(total, startValue = 0) {
  return new cliProgress.Bar(
    {
      format: `{bar} {percentage}% | ETA: {eta}s | {value}/{total}`,
      prefix: "Compressing:",
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
      clearOnComplete: true,
    },
    {
      total,
      startValue,
    }
  );
}
function createSpinner(text) {
  const spinner = spinners.dots;
  let currentFrame = 0;
  const interval = setInterval(() => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(
      colors.white(`{${spinner.frames[currentFrame]}} ${text}`)
    );
    currentFrame = (currentFrame + 1) % spinner.frames.length;
  }, spinner.interval);

  return {
    stop: (message = "", isSuccess = true) => {
      clearInterval(interval);
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      const status = isSuccess ? "✔" : "✖";
      console.log(`{${status}} ${colors.white(text)} | ${message}`);
    },
    succeed: (message = "") => {
      clearInterval(interval);
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      console.log(colors.green(`{✔} ${colors.white(text)} | ${message}`));
    },
    fail: (message = "") => {
      clearInterval(interval);
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      console.log(colors.red(`{✖} ${colors.white(text)} | ${message}`));
    },
    start: () => {
      // Dummy start method to maintain consistency
    },
  };
}

// Function to get the user's password from the console
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

function getRestart() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("Do you want to restart the server? (y/n): ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function uploadToServer(localFilePath, remoteFilePath, sftp) {
  try {
    const progressBar = createProgressBar(1);
    progressBar.start(1, 0);

    await sftp.fastPut(localFilePath, remoteFilePath, {
      step: (transferred, chunk, total) => {
        progressBar.update(transferred);
      },
    });

    progressBar.stop();
  } catch (error) {
    console.log(red(`SFTP Upload Error: ${error.message}`));
  }
}

/**
 * Decompresses a file on the server according to the provided configuration.
 *
 * @param {config} config - the configuration for file decompression
 * @return {void}
 */
function deCompressFileOnServer(config, server_id, zipFileName, root = "/") {
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

function deleteFilesFromServer(config, server_id, files, root = "/") {
  fetch(
    config.panel_url + "api/client" + "/servers/" + server_id + "/files/delete",
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

function formatCpuAbsolute(cpu, maxCpu) {
  //format something like 0.003 to percentage
  return `${((cpu / maxCpu) * 100).toFixed(3)}%`;
}

function formatMegabytes(megabytes) {
  if (megabytes < 1024) {
    return `${megabytes} MB`;
  } else {
    return `${(megabytes / 1024).toFixed(2)} GB`;
  }
}
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

module.exports = {
  createProgressBar,
  createSpinner,
  getPassword,
  uploadToServer,
  deCompressFileOnServer,
  deleteFilesFromServer,
  getRestart,
  formatCpuAbsolute,
  formatMegabytes,
  formatBytes,
};
