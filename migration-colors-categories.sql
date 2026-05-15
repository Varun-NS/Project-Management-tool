-- Migration: Add color to lists, categories to cards, and category library to boards
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/lkhmimjlkscbobdyoubk/sql/new

-- 1. Add color column to lists table (stores hex color string like '#f43f5e')
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS color TEXT;

-- 2. Add categories column to cards table (stores JSONB array of {id, name, color})
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]';

-- 3. Add categories column to boards table (board-level category library)
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT '[]';
