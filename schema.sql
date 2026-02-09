
-- Enable UUID extension if needed (optional, using string IDs currently)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. جدول پروفایل‌های پورسانت
-- ذخیره قوانین و بازه‌های محاسباتی
CREATE TABLE IF NOT EXISTS commission_profiles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    rules JSONB NOT NULL DEFAULT '[]'::jsonb, -- Stores the tiers and categories as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. جدول مدیران فروش
CREATE TABLE IF NOT EXISTS managers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    profile_id VARCHAR(50) REFERENCES commission_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. جدول زیرمجموعه‌های مدیران
-- لینک کردن نام کارشناس (از اکسل) به مدیر
CREATE TABLE IF NOT EXISTS manager_subordinates (
    manager_id VARCHAR(50) REFERENCES managers(id) ON DELETE CASCADE,
    rep_name VARCHAR(255) NOT NULL,
    PRIMARY KEY (manager_id, rep_name)
);

-- 4. جدول تنظیمات کارشناسان فروش
-- اتصال هر کارشناس به یک پروفایل پورسانت خاص
CREATE TABLE IF NOT EXISTS rep_settings (
    rep_name VARCHAR(255) PRIMARY KEY,
    profile_id VARCHAR(50) REFERENCES commission_profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. جدول نگاشت‌های بتا
-- اتصال نام‌های زیرگروه بتا به کارشناسان اصلی
CREATE TABLE IF NOT EXISTS beta_mappings (
    beta_subgroup VARCHAR(255) PRIMARY KEY,
    assigned_rep_name VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_managers_profile ON managers(profile_id);
CREATE INDEX idx_rep_settings_profile ON rep_settings(profile_id);
