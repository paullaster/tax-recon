// transform-to-credit-memo.ts
// This script reads a stream of filtered invoices and transforms them into a new JSON format
// suitable for credit memos, writing the output to a new file, all while streaming efficiently.

import { createReadStream, createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import JSONStream from 'jsonstream'; // Import jsonstream for efficient streaming JSON parsing

// Define file paths for input and output.
const INPUT_JSON_FILE = 'may-filtered-invoices.json';
const OUTPUT_JSON_FILE = 'may-credit-memo-from-filtered-may-invoice.json';

// Define the structure of an input Invoice line item
interface InputInvoiceLine {
  NamePLU: string;
  MeasureUnit: string;
  HSCode: string;
  HSName: string;
  DiscAddP: string;
  Quantity: number;
  Price: number;
  OptionVATClass: string; // This will be enforced to "A"
  VATGrRate: number;     // This will be enforced to 16.0
}

// Define the structure of the input Invoice (from filtered-invoices.json)
interface InputInvoice {
  header: {
    CompanyName: string;
    ClientPINnum: string;
    HeadQuarters: string;
    Address: string;
    PostalCodeAndCity: string;
    ExemptionNum: string;
    postingDate: string;
    TraderSystemInvNum: string; // This is the original TraderSystemInvNum from the input
    CUNumber: string; // This will become RelatedInvoiceNum
  };
  lines: InputInvoiceLine[]; // Use the specific line interface
}

// Define the desired structure of the output Credit Memo
interface CreditMemoOutput {
  CompanyName: string;
  ClientPINnum: string;
  HeadQuarters: string;
  Address: string;
  PostalCodeAndCity: string;
  ExemptionNum: string;
  postingDate: string;
  TraderSystemInvNum: string;
  RelatedInvoiceNum: string; // New field, mapped from CUNumber
  lines: InputInvoiceLine[]; // Lines array remains the same, but values are enforced
}

/**
 * Main function to orchestrate the invoice transformation process.
 * It streams the input JSON, transforms each invoice object, and writes
 * the transformed objects to a new JSON file.
 */
async function transformInvoicesToCreditMemos(): Promise<void> {
  console.log(`Starting transformation from ${INPUT_JSON_FILE} to ${OUTPUT_JSON_FILE}`);

  // Initialize a counter for the new TraderSystemInvNum.
  // It starts at 1190 as per your requirement.
  let creditMemoCounter = 2019;
  let processedInvoiceCount = 0; // Added for debugging

  // Create a readable stream for the input JSON file.
  const readStream = createReadStream(INPUT_JSON_FILE, { encoding: 'utf8' });

  // Create a writable stream for the output JSON file.
  const writeStream = createWriteStream(OUTPUT_JSON_FILE, { encoding: 'utf8' });

  // --- ENSURING VALID JSON OUTPUT: STEP 1 ---
  // Start the output JSON array. This is crucial for valid JSON output.
  writeStream.write('[\n');
  console.log('DEBUG: Started writing output JSON array opening bracket.');

  // A flag to manage adding commas between JSON objects in the output array.
  let firstObjectWritten = false;

  // Initialize the jsonstream parser to parse each top-level object in the array.
  const jsonParser = JSONStream.parse('*');

  // Pipe the readable stream through the jsonParser.
  readStream
    .pipe(jsonParser)
    .on('data', (invoice: InputInvoice) => {
      processedInvoiceCount++; // Increment count for each processed invoice

      // Generate the new TraderSystemInvNum with the specified prefix and incrementing variable.
      const newTraderSystemInvNum = `PSCRN/25/${creditMemoCounter.toString()}`;
      creditMemoCounter++; // Increment the counter for the next item.

      // Create a deep copy of the lines array to avoid modifying the original invoice object
      // if it were to be reused or if the stream implementation had side effects.
      // Also, apply the VAT class and rate enforcement here.
      const transformedLines = invoice.lines.map(line => ({
        ...line, // Copy all existing properties of the line item
        OptionVATClass: "A", // Enforce OptionVATClass to "A"
        VATGrRate: 16.0,      // Enforce VATGrRate to 16.0
      }));

      // Transform the invoice object into the desired credit memo format.
      const creditMemo: CreditMemoOutput = {
        CompanyName: invoice.header.CompanyName,
        ClientPINnum: invoice.header.ClientPINnum,
        HeadQuarters: invoice.header.HeadQuarters,
        Address: invoice.header.Address,
        PostalCodeAndCity: invoice.header.PostalCodeAndCity,
        ExemptionNum: invoice.header.ExemptionNum,
        postingDate: invoice.header.postingDate,
        TraderSystemInvNum: newTraderSystemInvNum, // Use the newly generated number
        RelatedInvoiceNum: invoice.header.CUNumber, // Map CUNumber to RelatedInvoiceNum
        lines: transformedLines, // Use the transformed lines array
      };

      // --- ENSURING VALID JSON OUTPUT: STEP 2 ---
      // If it's not the first object, add a comma and newline for proper JSON array formatting.
      if (firstObjectWritten) {
        writeStream.write(',\n');
      }
      // Write the transformed credit memo object to the output stream.
      // `JSON.stringify(creditMemo, null, 2)` pretty-prints the JSON with 2-space indentation,
      // ensuring valid JSON object format.
      writeStream.write(JSON.stringify(creditMemo, null, 2));
      firstObjectWritten = true; // Mark that at least one object has been written.
    })
    .on('error', (err) => {
      // Handle any errors that occur during reading from the input stream or parsing.
      console.error('Error during input stream processing or JSON parsing:', err);
      // It's important to end the stream on error to prevent hanging processes.
      writeStream.end();
      console.log('DEBUG: Output write stream ended due to an error.');
    });

  // Add a listener for errors on the raw read stream (e.g., file not found).
  readStream.on('error', (err) => {
    console.error('Error reading input JSON file:', err);
    writeStream.end(); // Close the write stream if the read stream fails.
    console.log('DEBUG: Input read stream error. Output write stream ended.');
  });

  // Add a listener for errors on the write stream (e.g., disk full).
  writeStream.on('error', (err) => {
    console.error('Error writing output JSON file:', err);
  });

  try {
    // Use `finished` to create a Promise that resolves when the `jsonParser` stream
    // has finished processing all data (either successfully or with an error).
    // Awaiting this ensures the script waits for the entire transformation to complete.
    await finished(jsonParser);
    console.log(`DEBUG: JSON parsing stream finished. Total invoices processed: ${processedInvoiceCount}`);
  } catch (err) {
    // Catch any errors that caused the `finished` promise to reject.
    console.error('Stream processing terminated unexpectedly with an error:', err);
  } finally {
    // --- ENSURING VALID JSON OUTPUT: STEP 3 ---
    // This block always executes, regardless of success or error,
    // ensuring the JSON array is properly closed.
    writeStream.write('\n]\n');
    console.log('DEBUG: Wrote output JSON array closing bracket.');

    // Signal that no more data will be written to the output stream.
    writeStream.end();
    console.log('DEBUG: Signaled end of output write stream.');

    // --- ENSURING VALID JSON OUTPUT: STEP 4 ---
    // Await the `writeStream` to ensure all buffered data is written to disk
    // before the script exits, preventing data loss and incomplete files.
    await finished(writeStream);
    console.log('DEBUG: Output write stream fully flushed to disk.');
    console.log(`Transformation complete. Transformed data written to ${OUTPUT_JSON_FILE}`);
  }
}

// Execute the main transformation function and catch any top-level unhandled errors.
transformInvoicesToCreditMemos().catch(console.error);
