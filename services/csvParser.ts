import { CSV_HEADERS } from '../constants';
import { PersonSalesRow, GoodsSalesRow, ExpenseRow } from '../types';
import * as XLSX from 'xlsx';

// Helper to safely parse numbers from Excel (which might be numbers or strings)
const parseNumber = (val: any): number => {
  if (val === undefined || val === null) return 0;
  
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }

  if (typeof val === 'string') {
    // Remove commas, spaces, and currency symbols if any
    let clean = val.replace(/,/g, '').trim();
    // Handle accounting negatives in parentheses: (100) -> -100
    if (clean.startsWith('(') && clean.endsWith(')')) {
      clean = '-' + clean.substring(1, clean.length - 1);
    }
    const num = parseFloat(clean);
    return Number.isFinite(num) ? num : 0;
  }
  
  return 0;
};

const parseBoolean = (val: any): boolean => {
  if (!val) return false;
  if (typeof val === 'boolean') return val;
  const v = String(val).toLowerCase().trim();
  return v === 'true' || v === 'yes' || v === 'bale' || v === 'بله';
};

const readExcelData = (data: ArrayBuffer): any[] => {
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  // Convert to JSON, treating the first row as headers
  return XLSX.utils.sheet_to_json(worksheet);
};

// Helper to find a value by checking multiple potential keys
const findValue = (row: any, keys: string[]): any => {
  for (const key of keys) {
    if (row[key] !== undefined) {
      return row[key];
    }
  }
  return undefined;
};

export const parsePersonSales = (fileData: ArrayBuffer): PersonSalesRow[] => {
  try {
    const jsonData = readExcelData(fileData);
    if (jsonData.length === 0) return [];

    // Map Excel columns to our interface based on headers
    return jsonData.map((row: any) => {
      const grossSales = parseNumber(row[CSV_HEADERS.PERSON_SALES.NET_SALES]);
      const returnsNet = parseNumber(row[CSV_HEADERS.PERSON_SALES.RETURNS]);
      const returnsTax = parseNumber(row[CSV_HEADERS.PERSON_SALES.RETURNS_TAX]);
      
      // Calculate true net sales: Gross - (Returns + Tax on Returns)
      const effectiveNetSales = grossSales - returnsNet - returnsTax;

      const subgroup = row[CSV_HEADERS.PERSON_SALES.SUBGROUP] || 'Unassigned';
      
      // Check for Beta in subgroup name if explicit column is missing or false
      let isBeta = parseBoolean(row[CSV_HEADERS.PERSON_SALES.IS_BETA]);
      if (!isBeta && typeof subgroup === 'string') {
        isBeta = subgroup.includes('بتا') || subgroup.toLowerCase().includes('beta');
      }

      return {
        customerName: row[CSV_HEADERS.PERSON_SALES.NAME] || '',
        subgroup: subgroup,
        netSales: effectiveNetSales,
        returns: returnsNet + returnsTax,
        isBeta: isBeta
      };
    }).filter(r => r.customerName && (r.netSales !== 0)); 
  } catch (e) {
    console.error("Error parsing Person Sales Excel:", e);
    return [];
  }
};

export const parseGoodsSales = (fileData: ArrayBuffer): GoodsSalesRow[] => {
  try {
    const jsonData = readExcelData(fileData);
    if (jsonData.length === 0) return [];

    return jsonData.map((row: any) => {
      const salesWithTax = parseNumber(row[CSV_HEADERS.GOODS_SALES.NET_SALES]);
      const netReturns = parseNumber(row[CSV_HEADERS.GOODS_SALES.RETURNS]);
      const returnsTax = parseNumber(row[CSV_HEADERS.GOODS_SALES.RETURNS_TAX]);

      // Formula: Sales With Tax - Net Returns - Return Tax
      const finalNetSales = salesWithTax - netReturns - returnsTax;

      return {
        buyerName: row[CSV_HEADERS.GOODS_SALES.BUYER] || '',
        productCode: row[CSV_HEADERS.GOODS_SALES.CODE] || '',
        // We store the FINAL calculated net sales here to simplify aggregation
        netSales: finalNetSales, 
        // We store total returns for reference, but netSales is already adjusted
        returns: netReturns + returnsTax 
      };
    }).filter(r => r.buyerName && (r.netSales !== 0 || r.returns !== 0));
  } catch (e) {
    console.error("Error parsing Goods Sales Excel:", e);
    return [];
  }
};

export const parseExpenses = (fileData: ArrayBuffer): ExpenseRow[] => {
  try {
    const jsonData = readExcelData(fileData);
    if (jsonData.length === 0) return [];

    // Define possible column names
    const nameKeys = [
        CSV_HEADERS.EXPENSES.EXECUTOR, 
        "نام مجری", "نام طرف حساب", "نام خریدار", "نام", "طرف حساب", "نام تفصیلی"
    ];
    const amountKeys = [
        CSV_HEADERS.EXPENSES.AMOUNT, 
        "جمع کسورات", // Added based on user screenshot
        "مبلغ", "بدهکار", "هزینه", "مبلغ هزینه", "مانده"
    ];
    const descKeys = [
        CSV_HEADERS.EXPENSES.DESC, 
        "شرح", "توضیحات", "بابت", "شرح سند"
    ];

    return jsonData.map((row: any) => {
      const name = findValue(row, nameKeys);
      const amount = findValue(row, amountKeys);
      const desc = findValue(row, descKeys);

      return {
        executorName: name || 'Unknown',
        amount: parseNumber(amount),
        description: desc || 'هزینه ثبت شده'
      };
    }).filter(r => r.amount > 0); // Still filter out zero/invalid amounts
  } catch (e) {
    console.error("Error parsing Expenses Excel:", e);
    return [];
  }
};