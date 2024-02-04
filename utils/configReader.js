function configReader(config) {
  const configObj = {};

  // Split the configuration file into lines
  const lines = config.split("\n");

  // Iterate through each line and parse key-value pairs
  lines.forEach((line) => {
    // Use regex to match lines with the pattern "KEY = VALUE"
    const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)\s*$/);

    // If a match is found, add the key-value pair to the config object
    if (match) {
      const key = match[1];
      const value = match[2];
      configObj[key] = value;
    }
  });

  return configObj;
}

module.exports = configReader;
