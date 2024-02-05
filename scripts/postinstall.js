#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function isPackageInstalledGlobally(packageName) {
  try {
    // Check if the package is installed globally
    execSync(`npm list -g ${packageName}`);
    return true;
  } catch (error) {
    return false;
  }
}

function installPackageGlobally(packageName) {
  try {
    // Install the package globally
    execSync(`npm install -g ${packageName}`);
    console.log(`Package '${packageName}' installed globally.`);
  } catch (error) {
    console.error(`Error installing '${packageName}' globally:`, error.message);
  }
}

function main() {
  // Replace "your-package-name" with the actual name of your package
  const packageName = "your-package-name";

  if (!isPackageInstalledGlobally(packageName)) {
    console.log(
      `Package '${packageName}' is not installed globally. Installing globally...`
    );
    installPackageGlobally(packageName);
  } else {
    console.log(`Package '${packageName}' is already installed globally.`);
  }
}

main();
