// efficient-invoice-filter.ts
// This script efficiently filters a large JSON file of invoices based on a list of CU numbers
// provided in a TypeScript file, using Node.js streams and the 'jsonstream' library.

import { createReadStream, createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { finished } from 'node:stream/promises';
// Corrected import for jsonstream in Node.js ESM context for CommonJS module
import JSONStream from 'jsonstream'; // This imports the default export of jsonstream

// Define file paths for input, CU numbers, and output.
// Ensure these file names match the ones you've uploaded.
const CU_NUMBERS_FILE = 'cu-numbers.ts';
const INPUT_JSON_FILE = 'may-extracted-invoices-fromej-file.json';
const OUTPUT_JSON_FILE = 'may-filtered-invoices.json';

// Define the structure of an Invoice for type safety (optional but good practice)
interface Invoice {
  header: {
    CompanyName: string;
    ClientPINnum: string;
    HeadQuarters: string;
    Address: string;
    PostalCodeAndCity: string;
    ExemptionNum: string;
    postingDate: string;
    TraderSystemInvNum: string;
    CUNumber: string; // This is the key property for filtering
  };
  lines: Array<any>; // You might want to define a more specific interface for lines
}

/**
 * Asynchronously reads the `cu-numbers.ts` file and extracts the `cuArray` into a Set.
 * Using a Set allows for highly efficient (average O(1) time complexity) lookups.
 * @returns A Promise that resolves to a Set of CU numbers (strings).
 */
async function getCuNumbers(): Promise<Set<string>> {
  try {
    // Read the entire content of the TypeScript file.
    // Since this file contains only the array definition, reading it fully is efficient.
    const content = await readFile(CU_NUMBERS_FILE, 'utf8');
    // DEBUG: Log the first part of the file content to verify it's being read correctly.
    console.log('DEBUG: Content of cu-numbers.ts (first 200 chars):\n', content.substring(0, 200) + '...');

    // Use a regular expression to find the 'export const cuArray: string[] = [...]' declaration
    // and capture the content within the square brackets.
    // The regex is designed to be flexible with whitespace and array type declaration.
    const match = content.match(/export\s+const\s+cuArray:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/);

    // DEBUG: Log the result of the regex match.
    console.log('DEBUG: Regex match result:', match);

    // If the array declaration is not found or the captured content is empty,
    // log an error and return an empty Set to prevent further processing with invalid data.
    if (!match || !match[1]) {
      console.error(`Error: Could not find 'export const cuArray: string[] = [...]' declaration in ${CU_NUMBERS_FILE}.`);
      return new Set();
    }

    // Process the captured string content:
    // 1. Split the string by commas to get individual string entries.
    // 2. Trim any leading/trailing whitespace from each entry.
    // 3. Remove all double quotes from each entry.
    // 4. Filter out any empty strings that might result from extra commas or malformed data.
    const cuNumbers = match[1]
      .split(',')
      .map(s => s.trim().replace(/"/g, ''))
      .filter(s => s.length > 0);

    // Return a new Set constructed from the processed CU numbers.
    // Sets provide very fast `has()` operations, which is crucial for large lists.
    return new Set(cuNumbers);
  } catch (error) {
    // Catch and log any errors that occur during file reading or parsing.
    console.error(`Error reading or parsing ${CU_NUMBERS_FILE}:`, error);
    return new Set(); // Return an empty Set on error to allow the main function to proceed gracefully.
  }
}

/**
 * Main function to orchestrate the invoice filtering process.
 * It reads CU numbers, streams the input JSON, filters invoices, and writes
 * the matching invoices to a new JSON file.
 */
async function filterInvoices(): Promise<void> {
  // First, load the set of CU numbers that will be used for filtering.
  const cuNumbersSet = new Set(Array.from((await getCuNumbers())).map((i) => i.replace("'", "")).map((i) => i.replace("'", "")));
  console.log(`Loaded ${cuNumbersSet.size} CU numbers for filtering.`);

  // Provide a warning if no CU numbers were loaded, as this might indicate an issue
  // and will result in an empty output file.
  if (cuNumbersSet.size === 0) {
    console.warn('Warning: No CU numbers found or an error occurred while reading cu-numbers.ts. The output file will likely be empty.');
  }

  // Create a readable stream for the large input JSON file.
  // 'utf8' encoding is specified for text files.
  const readStream = createReadStream(INPUT_JSON_FILE, { encoding: 'utf8' });

  // Create a writable stream for the output JSON file.
  // This file will store the filtered invoices.
  const writeStream = createWriteStream(OUTPUT_JSON_FILE, { encoding: 'utf8' });

  // Start the output JSON array. This is crucial for valid JSON output.
  writeStream.write('[\n');

  // A flag to manage adding commas between JSON objects in the output array.
  // The first object should not have a leading comma.
  let firstInvoiceWritten = false;

  // Initialize the jsonstream parser.
  // `JSONStream.parse('*')` tells the parser to emit each top-level element
  // when it encounters a JSON array. For a JSON file that is `[{}, {}, ...]`,
  // it will emit each `{}` object as a 'data' event.
  const jsonParser = JSONStream.parse('*');

  // Pipe the readable stream through the jsonParser.
  // This sets up the data flow: file chunks -> jsonParser -> 'data' events.
  readStream
    .pipe(jsonParser)
    .on('data', (invoice: Invoice) => {
      // This 'data' event fires for each parsed invoice object.
      // Check if the CUNumber in the current invoice's header is present in our set.
      // console.log("number fron ej invoice: ", invoice.header.CUNumber);
      // console.log("cu numbers set: ", cuNumbersSet);
      if (cuNumbersSet.has(invoice.header.CUNumber)) {
        // If a match is found, prepare to write it to the output file.
        // If it's not the first invoice, add a comma and newline for proper JSON array formatting.
        if (firstInvoiceWritten) {
          writeStream.write(',\n');
        }
        // Write the matching invoice object to the output stream.
        // `JSON.stringify(invoice, null, 2)` pretty-prints the JSON with 2-space indentation.
        writeStream.write(JSON.stringify(invoice, null, 2));
        firstInvoiceWritten = true; // Mark that at least one invoice has been written.
      }
    })
    .on('error', (err) => {
      // Handle any errors that occur during reading from the input stream or parsing.
      console.error('Error during input stream processing or JSON parsing:', err);
      writeStream.end(); // Ensure the output stream is closed on error.
    });

  // Add a listener for errors on the raw read stream (e.g., file not found).
  readStream.on('error', (err) => {
    console.error('Error reading input JSON file:', err);
    writeStream.end(); // Close the write stream if the read stream fails.
  });

  // Add a listener for errors on the write stream (e.g., disk full).
  writeStream.on('error', (err) => {
    console.error('Error writing output JSON file:', err);
  });

  try {
    // Use `finished` to create a Promise that resolves when the `jsonParser` stream
    // has finished processing all data (either successfully or with an error).
    // Awaiting this ensures the script waits for the entire filtering process to complete.
    await finished(jsonParser);
  } catch (err) {
    // Catch any errors that caused the `finished` promise to reject.
    console.error('Stream processing terminated unexpectedly with an error:', err);
  } finally {
    // This block always executes, regardless of success or error.
    // Close the output JSON array. This is essential for a valid JSON file.
    writeStream.write('\n]\n');
    // Signal that no more data will be written to the output stream.
    writeStream.end();
    // Await the `writeStream` to ensure all buffered data is written to disk
    // before the script exits, preventing data loss.
    await finished(writeStream);
    console.log(`Filtering complete. Matching invoices written to ${OUTPUT_JSON_FILE}`);
  }
}

// Execute the main filtering function and catch any top-level unhandled errors.
filterInvoices().catch(console.error);