const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");

const inputFiles = ["file1.txt", "file2.txt"];
const outputFile = path.join(__dirname, "merged.txt");
const fileEvents = new EventEmitter();
const fileContents = new Array(inputFiles.length);

let completedReads = 0;

// This listener runs only after both asynchronous read callbacks succeed.
fileEvents.once("files:ready", (firstContent, secondContent) => {
  const separator = firstContent.endsWith("\n") ? "" : "\n";
  const mergedContent = `${firstContent}${separator}${secondContent}`;

  // writeFile is asynchronous (non-blocking) as well.
  fs.writeFile(outputFile, mergedContent, "utf8", (error) => {
    if (error) {
      console.error("Could not write the merged file:", error.message);
      process.exitCode = 1;
      return;
    }

    console.log(`Merged content written to: ${outputFile}`);
  });
});

inputFiles.forEach((fileName, index) => {
  const filePath = path.join(__dirname, fileName);

  // readFile uses a callback, so Node can continue without blocking here.
  fs.readFile(filePath, "utf8", (error, content) => {
    if (error) {
      console.error(`Could not read ${fileName}:`, error.message);
      process.exitCode = 1;
      return;
    }

    fileContents[index] = content;
    completedReads += 1;

    if (completedReads === inputFiles.length) {
      fileEvents.emit("files:ready", ...fileContents);
    }
  });
});
