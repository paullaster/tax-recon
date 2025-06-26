import type { Invoice, InvoiceHeader, InvoiceLine } from '../../types/types.ts';

export class EJParser {
    private static INVOICE_DELIMITER_REGEX = /\* \* \* \* \* \* \* \* \* \* \* \* \* \* \* \*\s*/g;
    private static SECTION_DELIMITER = '- - - - - - - - - - - - - - - -';

    /**
     * Parses the content of an .ej file into an array of Invoice objects.
     * @param fileContent The raw string content of the .ej file.
     * @returns An array of parsed Invoice objects.
     */
    public parse(fileContent: string): Invoice[] {
        const invoices: Invoice[] = [];
        const blocks = fileContent.split(EJParser.INVOICE_DELIMITER_REGEX);

        for (const block of blocks) {
            if (!block.trim()) {
                continue; // Skip empty blocks resulting from split
            }
            const lines = block.split('\n');
            const invoice: Invoice = {
                header: this.parseHeader(lines),
                lines: this.parseLines(lines),
            };
            invoices.push(invoice);
        }

        return invoices;
    }

    /**
     * Parses the header information from an invoice block.
     * @param lines An array of strings representing the lines of a single invoice block.
     * @returns An InvoiceHeader object.
     */
    private parseHeader(lines: string[]): InvoiceHeader {
        const header: InvoiceHeader = {
            CompanyName: '',
            ClientPINnum: '',
            HeadQuarters: '',
            Address: '',
            PostalCodeAndCity: '',
            ExemptionNum: '',
            postingDate: '',
            TraderSystemInvNum: '',
            CUNumber: ''
        };

        let currentLineIndex = 0;
        let line = lines[currentLineIndex];

        // --- Extract Header fields ---
        while (line && !line.includes(EJParser.SECTION_DELIMITER)) {
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('Invoice Nr:')) {
                header.TraderSystemInvNum = trimmedLine.substring('Invoice Nr:'.length).trim();
            } else if (trimmedLine.startsWith('Buyer PIN:')) {
                header.ClientPINnum = trimmedLine.substring('Buyer PIN:'.length).trim();
            } else if (trimmedLine.startsWith('Buyer Company Name:')) {
                let companyNameParts = [trimmedLine.substring('Buyer Company Name:'.length).trim()];
                let nextLineIdx = currentLineIndex + 1;
                while (nextLineIdx < lines.length &&
                    !lines[nextLineIdx].trim().startsWith('Buyer HQ:') &&
                    !lines[nextLineIdx].trim().startsWith('Address:') &&
                    !lines[nextLineIdx].trim().includes(EJParser.SECTION_DELIMITER) &&
                    lines[nextLineIdx].trim().length > 0) { // Ensure it's not just a blank line
                    companyNameParts.push(lines[nextLineIdx].trim());
                    nextLineIdx++;
                }
                header.CompanyName = companyNameParts.join(' ');
            } else if (trimmedLine.startsWith('Buyer HQ:')) {
                header.HeadQuarters = trimmedLine.substring('Buyer HQ:'.length).trim();
            } else if (trimmedLine.startsWith('Address:')) {
                let addressParts = [trimmedLine.substring('Address:'.length).trim()];
                let nextLineIdx = currentLineIndex + 1;
                // Corrected: Removed the problematic 'Management Fee-' check
                while (nextLineIdx < lines.length &&
                    !lines[nextLineIdx].trim().includes(EJParser.SECTION_DELIMITER) && // Stop at section delimiter
                    lines[nextLineIdx].trim().length > 0) { // Stop at truly blank lines
                    addressParts.push(lines[nextLineIdx].trim());
                    nextLineIdx++;
                }
                header.Address = addressParts.join(' ');
            }

            currentLineIndex++;
            line = lines[currentLineIndex];
        }

        // --- Extract Control Unit Info for postingDate and CU Number ---
        // Efficiently find the Control Unit Info section
        const cuInfoStartIndex = lines.findIndex(l => l.trim() === 'Control Unit Info');
        if (cuInfoStartIndex !== -1) {
            for (let i = cuInfoStartIndex; i < lines.length; i++) {
                const cuLine = lines[i].trim();
                if (cuLine.startsWith('Date:') && cuLine.includes('Time:')) {
                    const dateTimeMatch = cuLine.match(/Date:(\d{2}\/\d{2}\/\d{4})\s+Time:(\d{2}:\d{2}:\d{2})/);
                    if (dateTimeMatch) {
                        header.postingDate = `${dateTimeMatch[1]} ${dateTimeMatch[2]}`;
                    }
                } else if (cuLine.startsWith('CU Invoice N:')) {
                    header.CUNumber = cuLine.substring('CU Invoice N:'.length).trim();
                }
                if (cuLine.includes(EJParser.SECTION_DELIMITER) && i > cuInfoStartIndex) {
                    break; // Stop after processing CU info lines when delimiter is hit
                }
            }
        }

        // Attempt to derive PostalCodeAndCity
        if (header.Address || header.HeadQuarters) {
            header.PostalCodeAndCity = header.HeadQuarters || ''; // Prioritize HQ
            if (!header.PostalCodeAndCity && header.Address) {
                // If HQ is empty, try to extract from address. Simple regex for last word.
                const addressParts = header.Address.split(',').map(p => p.trim());
                if (addressParts.length > 0) {
                    const lastPart = addressParts[addressParts.length - 1];
                    const cityMatch = lastPart.match(/\b[A-Z][A-Z\s]*\b$/); // Matches an uppercase word (or words) at the end
                    if (cityMatch) {
                        header.PostalCodeAndCity = cityMatch[0].trim();
                    }
                }
            }
        }

        return header;
    }

    /**
     * Parses the line items from an invoice block.
     * @param lines An array of strings representing the lines of a single invoice block.
     * @returns An array of InvoiceLine objects.
     */
    private parseLines(lines: string[]): InvoiceLine[] {
        const invoiceLines: InvoiceLine[] = [];
        let itemSectionStart = -1;
        let itemSectionEnd = -1;

        // Find the start and end of the item section using the delimiters
        let delimiterCount = 0;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(EJParser.SECTION_DELIMITER)) {
                delimiterCount++;
                if (delimiterCount === 1) {
                    itemSectionStart = i + 1; // Start after the first delimiter
                } else if (delimiterCount === 2) {
                    itemSectionEnd = i; // End before the second delimiter
                    break; // Found the item section
                }
            }
        }

        if (itemSectionStart === -1 || itemSectionEnd === -1 || itemSectionStart >= itemSectionEnd) {
            return []; // No valid item section found
        }

        const itemLines = lines.slice(itemSectionStart, itemSectionEnd).map(line => line.trim());

        let currentItem: Partial<InvoiceLine> = {};
        let vatClass: string = '';
        let vatRate: number = 0;

        for (const line of itemLines) {
            // Updated item recognition: assume any line not starting with Quantity, Price, Sum is a NamePLU
            // This is more robust for unique item descriptions.
            if (!line.startsWith('Quantity') && !line.startsWith('Price') && !line.startsWith('Sum') && line.length > 0) {
                // New item starts, push previous if valid
                if (currentItem.NamePLU && currentItem.Price !== undefined && currentItem.Quantity !== undefined) {
                    invoiceLines.push(currentItem as InvoiceLine);
                }
                currentItem = {
                    NamePLU: line, // The entire line is now the NamePLU
                    MeasureUnit: '',
                    HSCode: '',
                    HSName: '',
                    DiscAddP: ''
                };
            } else if (line.startsWith('Quantity')) {
                const qtyMatch = line.match(/Quantity\s+(\d+\.\d{3})\s*\d*/);
                if (qtyMatch) {
                    currentItem.Quantity = parseFloat(qtyMatch[1]);
                }
            } else if (line.startsWith('Price')) {
                // This is the unit price, we take Sum for the final price as per request.
            } else if (line.startsWith('Sum')) {
                const sumMatch = line.match(/Sum\s+([\d.]+)\s*([A-Z])?/);
                if (sumMatch) {
                    currentItem.Price = parseFloat(sumMatch[1]);
                    if (sumMatch[2]) {
                        vatClass = sumMatch[2]; // Capture VAT class
                    }
                }
            }
        }
        // Push the last item after the loop
        if (currentItem.NamePLU && currentItem.Price !== undefined && currentItem.Quantity !== undefined) {
            invoiceLines.push(currentItem as InvoiceLine);
        }

        // --- Extract VATGrRate from the Summary Section ---
        // Find the relevant lines for VAT rate after the item section
        const totalTaxARateLineIndex = lines.findIndex(l => l.includes('TOTAL A-') && l.includes('%'));
        if (totalTaxARateLineIndex !== -1) {
            const vatRateLine = lines[totalTaxARateLineIndex].trim();
            const totalTaxAMatch = vatRateLine.match(/TOTAL A-(\d+\.\d{2})%/);
            if (totalTaxAMatch) {
                vatRate = parseFloat(totalTaxAMatch[1]);
            }
        }

        // Apply collected VAT info to all lines (assuming all lines in an invoice have the same VAT class/rate)
        invoiceLines.forEach(line => {
            line.OptionVATClass = vatClass; // This will be the last captured VAT class from 'Sum'
            line.VATGrRate = vatRate; // This will be the last captured VAT rate from 'TOTAL A-'
        });

        return invoiceLines;
    }
}