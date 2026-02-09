
import { CommissionProfile, SalesCategory } from './types';

// CSV Header Mappings
export const CSV_HEADERS = {
  PERSON_SALES: {
    NAME: "نام",
    SUBGROUP: "نام زیرگروه",
    NET_SALES: "فروش خالص با احتساب عوارض و مالیات",
    RETURNS: "برگشت از فروش خالص",
    RETURNS_TAX: "عوارض و مالیات برگشت از فروش",
    IS_BETA: "is beta"
  },
  GOODS_SALES: {
    BUYER: "نام خریدار",
    CODE: "کد کالا",
    NAME: "نام کالا",
    NET_SALES: "فروش خالص با احتساب عوارض و مالیات",
    RETURNS: "برگشت از فروش خالص",
    RETURNS_TAX: "عوارض و مالیات برگشت از فروش"
  },
  EXPENSES: {
    EXECUTOR: "نام مجری", 
    AMOUNT: "مبلغ", 
    DESC: "شرح" 
  }
};

// Default Commission Profiles extracted from user images
// Note: values are in Rials (20,000,000,000 = 20 Billion)
export const DEFAULT_COMMISSION_PROFILES: CommissionProfile[] = [
  {
    id: 'prof_shahrestan',
    name: 'کارشناس فروش شهرستان',
    rules: [
      {
        category: SalesCategory.TARGET,
        tiers: [
          { min: 20_000_000_000, max: 70_000_000_000, value: 0.2, type: 'percent' },
          { min: 70_000_000_000, max: 100_000_000_000, value: 0.3, type: 'percent' },
          { min: 100_000_000_000, max: 150_000_000_000, value: 0.4, type: 'percent' },
          { min: 150_000_000_000, max: 1_500_000_000_000, value: 0.5, type: 'percent' },
        ]
      },
      { category: SalesCategory.BETA, tiers: [] },
      { category: SalesCategory.OTHER, tiers: [] }
    ]
  },
  {
    id: 'prof_alborz',
    name: 'کارشناس فروش البرز',
    rules: [
      {
        category: SalesCategory.TARGET,
        tiers: [
          { min: 20_000_000_000, max: 100_000_000_000, value: 0.5, type: 'percent' },
          { min: 100_000_000_000, max: 200_000_000_000, value: 0.7, type: 'percent' },
          { min: 200_000_000_000, max: 2_000_000_000_000, value: 0.9, type: 'percent' },
        ]
      },
      { category: SalesCategory.BETA, tiers: [] },
      { category: SalesCategory.OTHER, tiers: [] }
    ]
  },
  {
    id: 'prof_tehran',
    name: 'کارشناس فروش تهران',
    rules: [
      {
        category: SalesCategory.TARGET,
        tiers: [
          { min: 20_000_000_000, max: 100_000_000_000, value: 0.5, type: 'percent' },
          { min: 100_000_000_000, max: 150_000_000_000, value: 0.7, type: 'percent' },
          { min: 150_000_000_000, max: 1_500_000_000_000, value: 0.9, type: 'percent' },
        ]
      },
      { category: SalesCategory.BETA, tiers: [] },
      { category: SalesCategory.OTHER, tiers: [] }
    ]
  },
  {
    id: 'prof_taavoni',
    name: 'کارشناس فروش تعاونی',
    rules: [
      {
        category: SalesCategory.TARGET,
        tiers: [
          { min: 20_000_000_000, max: 70_000_000_000, value: 0.2, type: 'percent' },
          { min: 70_000_000_000, max: 150_000_000_000, value: 0.3, type: 'percent' },
          { min: 150_000_000_000, max: 250_000_000_000, value: 0.4, type: 'percent' },
          { min: 250_000_000_000, max: 2_500_000_000_000, value: 0.5, type: 'percent' },
        ]
      },
      { category: SalesCategory.BETA, tiers: [] },
      { category: SalesCategory.OTHER, tiers: [] }
    ]
  },
  {
    id: 'prof_solhi',
    name: 'کارشناس فروش (آقای صلحی)',
    rules: [
      {
        category: SalesCategory.TARGET,
        tiers: [
          { min: 1, max: 7_000_000_000_000, value: 1.0, type: 'percent' },
        ]
      },
      { category: SalesCategory.BETA, tiers: [] },
      { category: SalesCategory.OTHER, tiers: [] }
    ]
  },
  {
    id: 'prof_abdollahpour',
    name: 'مدیر فروش شهرستان (عبدالله پور)',
    rules: [
      {
        category: SalesCategory.TARGET,
        tiers: [
          { min: 100_000_000_000, max: 300_000_000_000, value: 0.3, type: 'percent' },
          { min: 300_000_000_000, max: 500_000_000_000, value: 0.4, type: 'percent' },
          { min: 500_000_000_000, max: 5_000_000_000_000, value: 0.5, type: 'percent' },
        ]
      },
      { category: SalesCategory.BETA, tiers: [] },
      { category: SalesCategory.OTHER, tiers: [] }
    ]
  },
  {
    id: 'prof_modern',
    name: 'کارشناس فروش فروشگاه های مدرن',
    rules: [
      { category: SalesCategory.TARGET, tiers: [] },
      { category: SalesCategory.BETA, tiers: [] },
      {
        category: SalesCategory.OTHER,
        tiers: [
          { min: 20_000_000_000, max: 100_000_000_000, value: 0.1, type: 'percent' },
          { min: 100_000_000_000, max: 300_000_000_000, value: 0.2, type: 'percent' },
          { min: 300_000_000_000, max: 3_000_000_000_000, value: 0.3, type: 'percent' },
        ]
      }
    ]
  },
  {
    id: 'prof_bazaar',
    name: 'کارشناس فروش بازار، سه راه امین حضور و شوش',
    rules: [
      { category: SalesCategory.TARGET, tiers: [] },
      { category: SalesCategory.BETA, tiers: [] },
      {
        category: SalesCategory.OTHER,
        tiers: [
          { min: 20_000_000_000, max: 70_000_000_000, value: 0.3, type: 'percent' },
          { min: 70_000_000_000, max: 100_000_000_000, value: 0.4, type: 'percent' },
          { min: 100_000_000_000, max: 150_000_000_000, value: 0.5, type: 'percent' },
          { min: 150_000_000_000, max: 1_500_000_000_000, value: 0.6, type: 'percent' },
        ]
      }
    ]
  },
  {
    id: 'prof_transport',
    name: 'کمک هزینه ایاب ذهاب',
    rules: [
      { category: SalesCategory.TARGET, tiers: [] },
      { category: SalesCategory.BETA, tiers: [] },
      {
        category: SalesCategory.OTHER,
        tiers: [
          { min: 20_000_000_000, max: 60_000_000_000, value: 20_000_000, type: 'fixed' },
          { min: 60_000_000_000, max: 100_000_000_000, value: 40_000_000, type: 'fixed' },
          { min: 100_000_000_000, max: 1_000_000_000_000, value: 60_000_000, type: 'fixed' },
        ]
      }
    ]
  }
];
