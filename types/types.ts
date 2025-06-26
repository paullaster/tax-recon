export interface TaxItemHeader {
    CompanyName: string;
    ClientPINnum: string;
    HeadQuarters: string;
    Address: string;
    PostalCodeAndCity: string;
    ExemptionNum: string;
    postingDate: string;
    TraderSystemInvNum: string;
    RelatedInvoiceNum: string;
    lines: TaxItemLines[]
};

export interface TaxItemLines {
    NamePLU: string;
    OptionVATClass: string;
    Price: bigint;
    MeasureUnit: string | null;
    HSCode: string | null;
    HSName: string | null;
    VATGrRate: number;
    Quantity: number;
    DiscAddP: string;
};
export interface InvoiceLine {
    NamePLU: string;
    OptionVATClass: string;
    Price: number; // Value from 'Sum' of the line item
    MeasureUnit: string;
    HSCode: string;
    HSName: string;
    VATGrRate: number; // e.g., 16.0
    Quantity: number;
    DiscAddP: string;
}

export interface InvoiceHeader {
    CompanyName: string;
    ClientPINnum: string;
    HeadQuarters: string;
    Address: string;
    PostalCodeAndCity: string;
    ExemptionNum: string;
    postingDate: string; // "DD/MM/YYYY HH:MM:SS"
    TraderSystemInvNum: string;
    CUNumber: string; // From CU Invoice N
}

export interface Invoice {
    header: InvoiceHeader;
    lines: InvoiceLine[];
}