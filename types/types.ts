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