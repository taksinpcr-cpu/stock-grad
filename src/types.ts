/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType = 'income' | 'expense';
export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string;
  note?: string;
  createdAt: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  // Expense Categories
  { id: 'food', name: 'อาหาร', icon: 'Utensils', color: '#FFB7B2', type: 'expense' },
  { id: 'transport', name: 'การเดินทาง', icon: 'Car', color: '#B2E2F2', type: 'expense' },
  { id: 'shopping', name: 'ช้อปปิ้ง', icon: 'ShoppingBag', color: '#F2B2E2', type: 'expense' },
  { id: 'entertainment', name: 'บันเทิง', icon: 'Film', color: '#D1B2F2', type: 'expense' },
  { id: 'bills', name: 'บิล/ค่าใช้จ่าย', icon: 'Receipt', color: '#FFD9B2', type: 'expense' },
  { id: 'health', name: 'สุขภาพ', icon: 'HeartPulse', color: '#B2F2D2', type: 'expense' },
  { id: 'other-exp', name: 'อื่นๆ', icon: 'MoreHorizontal', color: '#E0E0E0', type: 'expense' },
  
  // Income Categories
  { id: 'salary', name: 'เงินเดือน', icon: 'Wallet', color: '#B2F2B2', type: 'income' },
  { id: 'business', name: 'ธุรกิจ', icon: 'Briefcase', color: '#B2D2F2', type: 'income' },
  { id: 'bonus', name: 'โบนัส', icon: 'Gift', color: '#F2D2B2', type: 'income' },
  { id: 'invest', name: 'การลงทุน', icon: 'TrendingUp', color: '#D2F2B2', type: 'income' },
  { id: 'other-inc', name: 'อื่นๆ', icon: 'PlusCircle', color: '#E0E0E0', type: 'income' },
];
