export interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  provider: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  addresses?: any[];
  orderCount?: number;
  totalSpent?: number;
  lastOrderAt?: string;
}
